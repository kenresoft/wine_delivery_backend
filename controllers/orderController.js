const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const ioInstance = require('../utils/ioInstance');
require('dotenv').config();
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createOrder = async (req, res) => {
    try {
        const { note, subTotal, promotionCode } = req.body;
        const user = await User.findById(req.user.id, { password: 0, isAdmin: 0 });

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized access' });
        }

        const cart = await Cart.findOne({ user: user._id });

        if (!cart || !cart.items.length) {
            return res.status(400).json({ message: 'No items in the cart for you to order' });
        }

        // Retrieve the user's default or preferred shipping address
        const shipment = await Shipment.findOne({ user: user._id });

        if (!shipment) {
            console.log('No shipment found for user');
            return res.status(400).json({ message: 'No shipping address found for this user' });
        }

        // Process promotion if applied
        let appliedPromotion = null;
        let shippingCost = shipment.deliveryCost || 0;
        
        if (promotionCode) {
            appliedPromotion = await Promotion.findOne({ 
                code: promotionCode,
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            });
            
            if (appliedPromotion) {
                // Apply promotion logic
                if (appliedPromotion.discountType === 'percentage') {
                    const discountAmount = (subTotal * appliedPromotion.discountValue) / 100;
                    appliedPromotion = {
                        id: appliedPromotion._id,
                        code: appliedPromotion.code,
                        title: appliedPromotion.title,
                        discountType: appliedPromotion.discountType,
                        discountValue: appliedPromotion.discountValue,
                        discountAmount: discountAmount,
                        freeShipping: appliedPromotion.freeShipping
                    };
                } else if (appliedPromotion.discountType === 'fixed') {
                    appliedPromotion = {
                        id: appliedPromotion._id,
                        code: appliedPromotion.code,
                        title: appliedPromotion.title,
                        discountType: appliedPromotion.discountType,
                        discountValue: appliedPromotion.discountValue,
                        discountAmount: appliedPromotion.discountValue,
                        freeShipping: appliedPromotion.freeShipping
                    };
                } else if (appliedPromotion.discountType === 'freeShipping') {
                    appliedPromotion = {
                        id: appliedPromotion._id,
                        code: appliedPromotion.code,
                        title: appliedPromotion.title,
                        discountType: appliedPromotion.discountType,
                        discountValue: 0,
                        discountAmount: 0,
                        freeShipping: true
                    };
                }
                
                if (appliedPromotion.freeShipping) {
                    shippingCost = 0;
                }
            }
        }

        // Calculate tax amount (assuming a standard tax rate of 10%)
        const taxRate = 0.10;
        const taxAmount = subTotal * taxRate;
        
        // Calculate total cost
        let totalCost = subTotal + shippingCost + taxAmount;
        if (appliedPromotion && appliedPromotion.discountAmount) {
            totalCost -= appliedPromotion.discountAmount;
        }

        // Create order document
        const order = new Order({
            user: user._id,
            items: cart.items,
            shipment: shipment._id,
            subTotal: subTotal,
            totalCost: totalCost,
            taxAmount: taxAmount,
            shippingCost: shippingCost,
            note: note || '',
            appliedPromotion: appliedPromotion,
        });

        // Save the order
        await order.save();

        // Clear the user's cart after successful order creation
        await Cart.findOneAndUpdate(
            { user: user._id }, 
            { $set: { items: [] } }
        );

        // Emit a real-time event to notify the user
        const io = ioInstance.getIO();
        io.emit('orderCreated', { order });

        res.status(201).json({ 
            success: true,
            message: 'Order created successfully', 
            order 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error: ' + error.message 
        });
    }
};

exports.makePurchase = async (req, res) => {
    try {
        const { description, currency, paymentMethod } = req.body;
        const orderId = req.params.id;

        // Find the order by ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Verify order belongs to the current user
        if (order.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized to purchase this order' });
        }

        // Verify order is in draft status
        if (order.status !== 'draft') {
            return res.status(400).json({ success: false, message: `Order is already in ${order.status} status` });
        }

        // Process payment
        const paymentResponse = await processPayment(
            order.totalCost,
            description || `Payment for Order #${order._id}`,
            currency || 'usd',
            paymentMethod
        );

        if (!paymentResponse.success) {
            return res.status(400).json({
                success: paymentResponse.success,
                message: paymentResponse.message,
            });
        }

        // Generate tracking number
        const trackingNumber = generateTrackingNumber(order.user, order.createdAt, order._id);
        console.log('Generated tracking number:', trackingNumber);

        // Update order with payment details
        order.paymentDetails = paymentResponse.data;
        order.status = 'pending';
        order.paymentMethod = paymentMethod;
        order.trackingNumber = trackingNumber;

        // Calculate estimated delivery date (7 days from now)
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 7);
        order.deliveryDate = deliveryDate;

        // Save the updated order
        await order.save();

        // Update product inventory
        for (const item of order.items) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { countInStock: -item.quantity } }
            );
        }

        // Emit a real-time event to notify about the purchase
        const io = ioInstance.getIO();
        io.emit('orderPurchased', { order });

        res.status(200).json({ 
            success: true, 
            message: 'Payment successful', 
            order 
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
};

async function processPayment(amount, description, currency, paymentMethod) {
    try {
        if (paymentMethod === 'cash_on_delivery') {
            return {
                success: true,
                message: 'Cash on delivery payment method set',
                data: {
                    paymentMethod: 'cash_on_delivery',
                    status: 'pending'
                }
            };
        }
        
        // For stripe payments
        if (paymentMethod === 'stripe') {
        const paymentIntent = await Stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents and ensure it's an integer
            currency: currency || 'usd',
            description,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return {
            success: true,
            message: 'Payment processed successfully:' + paymentIntent,
            data: {
                paymentIntent: paymentIntent.client_secret,
                    publishableKey: process.env.PUBLISHABLE_KEY,
                    status: 'pending'
            },
            };
        }
        
        // For PayPal (implementation would depend on your PayPal integration)
        if (paymentMethod === 'paypal') {
            // Implement PayPal payment logic here
            return {
                success: true,
                message: 'PayPal payment initiated',
                data: {
                    // PayPal specific data
                    paymentMethod: 'paypal',
                    status: 'pending'
                }
            };
        }

        return {
            success: false,
            message: 'Invalid payment method',
        };
    } catch (error) {
        console.error('Payment error:', error);
        return {
            success: false,
            message: 'Payment failed',
            error: error.message,
        };
    }
}

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;
        
        // Validate status is from allowed enum values
        const validStatuses = ['pending', 'processing', 'packaging', 'shipping', 'delivered', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid order status provided' 
            });
        }

        // Find the order by ID
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Check if transitioning to cancelled and handle inventory
        if (status === 'cancelled' && order.status !== 'cancelled') {
            // Restore product quantities back to inventory
            for (const item of order.items) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { countInStock: item.quantity } }
                );
            }
        }

        // Update the order status
        order.status = status;
        
        // Update delivery date if status is shipping
        if (status === 'shipping') {
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 3); // Estimated 3 days for delivery
            order.deliveryDate = deliveryDate;
        }

        // Save the updated order
        await order.save();

        // Emit real-time update to clients
        const io = ioInstance.getIO();
        io.emit('orderUpdated', { order });

        res.status(200).json({ 
            success: true, 
            order 
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        // Get filter parameters from query
        const { status, startDate, endDate, search, page = 1, limit = 10 } = req.query;
        
        // Build filter object
        const filter = {};
        
        if (status) {
            filter.status = status;
        }
        
        // Date range filtering
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            filter.createdAt = { $gte: new Date(startDate) };
        } else if (endDate) {
            filter.createdAt = { $lte: new Date(endDate) };
        }
        
        // Search by tracking number or order ID
        if (search) {
            filter.$or = [
                { trackingNumber: { $regex: search, $options: 'i' } },
                { _id: mongoose.Types.ObjectId.isValid(search) ? search : null }
            ];
        }
        
        // Calculate pagination parameters
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Fetch orders with pagination and populate necessary fields
        const orders = await Order.find(filter)
            .populate('user', 'name email')
            .populate('shipment')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        // Get total count for pagination
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / parseInt(limit));
        
        // Return response with pagination metadata
        res.status(200).json({
            success: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                pageSize: parseInt(limit),
                totalOrders
            }
        });
    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve orders', 
            error: error.message 
        });
    }
};

exports.getOrderStats = async (req, res) => {
    try {
        // Get date range for dashboard stats
        const { period } = req.query;
        
        let startDate = new Date();
        const endDate = new Date();
        
        // Set time range based on period
        switch (period) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                // Default to last 30 days
                startDate.setDate(startDate.getDate() - 30);
        }
        
        // Get overall order metrics
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const processingOrders = await Order.countDocuments({ status: 'processing' });
        const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
        const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
        
        // Calculate revenue metrics
        const revenueStats = await Order.aggregate([
            {
                $match: {
                    status: { $ne: 'cancelled' },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalCost' },
                    averageOrderValue: { $avg: '$totalCost' },
                    ordersCount: { $sum: 1 }
                }
            }
        ]);
        
        // Get time-series data for the specified period
        const timeSeriesRevenue = await Order.aggregate([
            {
                $match: {
                    status: { $ne: 'cancelled' },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: period === 'year' ? '%Y-%m' : '%Y-%m-%d', 
                            date: '$createdAt' 
                        } 
                    },
                    revenue: { $sum: '$totalCost' },
                    orders: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);
        
        // Get top-selling products
        const topProducts = await Order.aggregate([
            {
                $match: {
                    status: { $ne: 'cancelled' },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    productName: { $first: '$items.name' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);
        
        res.status(200).json({
            success: true,
            stats: {
                orderCounts: {
                    total: totalOrders,
                    pending: pendingOrders,
                    processing: processingOrders,
                    delivered: deliveredOrders,
                    cancelled: cancelledOrders
                },
                revenue: revenueStats.length > 0 ? {
                    total: revenueStats[0].totalRevenue,
                    averageOrderValue: revenueStats[0].averageOrderValue,
                    ordersCount: revenueStats[0].ordersCount
                } : {
                    total: 0,
                    averageOrderValue: 0,
                    ordersCount: 0
                },
                timeSeriesData: timeSeriesRevenue,
                topProducts
            }
        });
    } catch (error) {
        console.error('Order stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve order statistics', 
            error: error.message 
        });
    }
};

exports.getUserOrders = async (req, res) => {
    try {
        // Default page to 1 and limit to 10 if not provided
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        
        // Calculate skip value
        const skip = (page - 1) * limit;
        
        // Build filter object
        const filter = { user: req.user.id };
        
        if (status) {
            filter.status = status;
        }
        
        // Fetch orders with pagination and populate necessary references
        const orders = await Order.find(filter)
            .populate('shipment')
            .populate('items.product', 'name price image')
            .skip(skip)
            .limit(limit) // Limit to the current page's orders
            .sort({ createdAt: -1 }); // Optional: order by date, latest first

        // Get total count for pagination metadata
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        res.status(200).json({
            success: true,
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                pageSize: limit,
                totalOrders
            }
        });
    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email')
            .populate('shipment')
            .populate('items.product');
            
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        // Check if the order belongs to the current user or if the user is an admin
        /* if (order.user._id.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized to view this order' 
            });
        } */ // TODO: uncomment this line later. i commented it out jus to test sth.

        res.status(200).json({ 
            success: true, 
            order 
        });
    } catch (error) {
        console.error('Get order by ID error:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
};

function generateTrackingNumber(userId, orderDate, orderId) {
    // Extract the last 4 digits from each ID
    const userIdPart = userId.toString().slice(-4);
    const orderIdPart = orderId.toString().slice(-4);

    // Format the date as YYYYMMDD
    const datePart = orderDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Combine the parts and convert to uppercase
    const trackingNumber = `TRK-${userIdPart}${datePart.slice(-4)}${orderIdPart}`.toUpperCase();

    return trackingNumber;
}