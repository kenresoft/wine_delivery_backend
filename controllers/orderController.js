const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const ioInstance = require('../utils/ioInstance');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
require('dotenv').config();
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Creates a new order from user's cart
 * @route POST /api/orders
 * @access Private
 */
exports.createOrder = asyncHandler(async (req, res) => {
    const { note, subTotal, promotionCode } = req.body;

    // Retrieve user with selective projection for security
    const user = await User.findById(req.user.id, { password: 0, isAdmin: 0 });

    if (!user) {
        throw new AppError('Unauthorized access', 401);
    }

    // Retrieve cart with populated product data for order creation
    const cart = await Cart.findOne({ user: user._id })
        .populate({
            path: 'items.product',
            select: 'name defaultPrice image defaultQuantity',
            model: 'Product'
        });

    if (!cart || !cart.items || cart.items.length === 0) {
        throw new AppError('No items in the cart for you to order', 400);
    }

    // Comprehensive validation for product data integrity
    const itemsWithMissingData = cart.items.filter(item =>
        !item.product ||
        typeof item.product.defaultPrice === 'undefined' ||
        typeof item.product.defaultQuantity === 'undefined'
    );

    if (itemsWithMissingData.length > 0) {
        throw new AppError('Some products in cart have missing data', 400, {
            problematicItems: itemsWithMissingData.map(item => ({
                productId: item.product?._id || 'unknown',
                missingFields: {
                    price: !item.product || typeof item.product.defaultPrice === 'undefined',
                    stock: !item.product || typeof item.product.defaultQuantity === 'undefined'
                }
            }))
        });
    }

    // Inventory verification before order creation
    const outOfStockItems = cart.items.filter(item =>
        item.product.defaultQuantity < item.quantity
    );

    if (outOfStockItems.length > 0) {
        throw new AppError(`Insufficient stock for ${outOfStockItems.length} item(s)`, 400, {
            outOfStockItems: outOfStockItems.map(item => ({
                productId: item.product._id,
                productName: item.product.name,
                requestedQuantity: item.quantity,
                availableStock: item.product.defaultQuantity
            }))
        });
    }

    // Transform cart items to order items with optimized mapping
    const orderItems = cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.defaultPrice,
        name: item.product.name,
        image: item.product.image || ''
    }));

    // Retrieve shipping configuration with error handling
    const shipment = await Shipment.findOne({ user: user._id });

    if (!shipment) {
        throw new AppError('No shipping address found for this user', 400);
    }

    // Promotion application with comprehensive validation
    let appliedPromotion = null;
    let shippingCost = shipment.deliveryCost || 0;

    if (promotionCode) {
        // Find valid promotion with comprehensive criteria
        appliedPromotion = await Promotion.findOne({
            code: promotionCode,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            minimumOrderAmount: { $lte: subTotal }
        });

        if (appliedPromotion) {
            let discountAmount = 0;
            let freeShipping = false;

            // Apply promotion based on type
            if (appliedPromotion.discountType === 'percentage') {
                discountAmount = (subTotal * appliedPromotion.discountValue) / 100;
            } else if (appliedPromotion.discountType === 'fixed') {
                discountAmount = appliedPromotion.discountValue;
            } else if (appliedPromotion.discountType === 'freeShipping') {
                freeShipping = true;
            }

            // Structured promotion data for order
            appliedPromotion = {
                id: appliedPromotion._id,
                code: appliedPromotion.code,
                title: appliedPromotion.title,
                discountType: appliedPromotion.discountType,
                discountValue: appliedPromotion.discountValue,
                discountAmount,
                freeShipping
            };

            if (appliedPromotion.freeShipping) {
                shippingCost = 0;
            }
        }
    }

    // Calculate costs with precision handling for decimal values
    const taxRate = parseFloat(process.env.TAX_RATE || 0.10);
    const taxAmount = Number((subTotal * taxRate).toFixed(2));

    let totalCost = Number((subTotal + shippingCost + taxAmount).toFixed(2));
    if (appliedPromotion && appliedPromotion.discountAmount) {
        totalCost = Number((totalCost - appliedPromotion.discountAmount).toFixed(2));
    }

    // Create order with comprehensive data model
    const order = new Order({
        user: user._id,
        items: orderItems,
        shipment: shipment._id,
        subTotal: Number(subTotal.toFixed(2)),
        totalCost,
        taxAmount,
        shippingCost: Number(shippingCost.toFixed(2)),
        note: note || '',
        appliedPromotion,
        status: 'draft'
    });

    // Save order and handle potential errors
    const savedOrder = await order.save();

    // Clear cart after successful order creation
    await Cart.findOneAndUpdate(
        { user: user._id },
        { $set: { items: [] } }
    );

    // Emit real-time order event
    const io = ioInstance.getIO();
    io.emit('orderCreated', {
        orderId: savedOrder._id,
        userId: user._id,
        status: savedOrder.status
    });

    logger.info(`Order created: ${savedOrder._id} for user ${user._id}`);

    res.status(201).json({
        success: true,
        data: savedOrder,
        message: 'Order created successfully'
    });
});

/**
 * Process payment for an order
 * @route PUT /api/orders/:id/purchase
 * @access Private
 */
exports.makePurchase = asyncHandler(async (req, res) => {
    const { description, currency, paymentMethod } = req.body;
    const orderId = req.params.id;

    // Find and validate order with comprehensive error handling
    const order = await Order.findById(orderId);
    if (!order) {
        throw new AppError('Order not found', 404);
    }

    // Authorization validation
    if (order.user.toString() !== req.user.id) {
        throw new AppError('Unauthorized to purchase this order', 403);
    }

    // State validation
    if (order.status !== 'draft') {
        throw new AppError(`Order is already in ${order.status} status`, 400);
    }

    // Inventory revalidation for each order item
    for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (!product || product.defaultQuantity < item.quantity) {
            throw new AppError(`Product "${item.name}" is no longer available in sufficient quantity`, 400);
        }
    }

    // Process payment with error isolation
    const paymentResponse = await processPayment(
        order.totalCost,
        description || `Payment for Order #${order._id}`,
        currency || 'usd',
        paymentMethod
    );

    if (!paymentResponse.success) {
        throw new AppError(paymentResponse.message, 400);
    }

    // Generate tracking identifier
    const trackingNumber = generateTrackingNumber(order.user, order.createdAt, order._id);

    // State transition with appropriate date calculation
    order.paymentDetails = paymentResponse.data;
    order.status = 'pending';
    order.paymentMethod = paymentMethod;
    order.trackingNumber = trackingNumber;

    // Calculate estimated delivery date
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7); // 7 days for delivery estimate
    order.deliveryDate = deliveryDate;

    // Save updated order
    await order.save();

    // Update inventory with parallel operations
    const inventoryUpdatePromises = order.items.map(item =>
        Product.findByIdAndUpdate(
            item.product,
            { $inc: { defaultQuantity: -item.quantity } },
            { new: true }
        )
    );

    await Promise.all(inventoryUpdatePromises);

    // Emit real-time order event
    const io = ioInstance.getIO();
    io.emit('orderPurchased', {
        orderId: order._id,
        userId: order.user,
        status: order.status,
        trackingNumber: order.trackingNumber
    });

    logger.info(`Order purchased: ${order._id}, tracking: ${trackingNumber}`);

    res.status(200).json({
        success: true,
        data: order,
        message: 'Payment processed successfully'
    });
});

/**
 * Process payment through various payment gateways
 * @private
 */
async function processPayment(amount, description, currency, paymentMethod) {
    try {
        // Cash on delivery handling
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

        // Stripe payment processing
        if (paymentMethod === 'stripe') {
            if (!process.env.PUBLISHABLE_KEY) {
                throw new Error('Stripe secret key not configured');
            }

            const paymentIntent = await Stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency || 'usd',
                description,
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return {
                success: true,
                message: 'Payment processed successfully',
                data: {
                    paymentIntent: paymentIntent.client_secret,
                    publishableKey: process.env.PUBLISHABLE_KEY,
                    status: 'pending'
                },
            };
        }

        // PayPal payment processing
        if (paymentMethod === 'paypal') {
            // PayPal implementation to be added
            return {
                success: true,
                message: 'PayPal payment initiated',
                data: {
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
        logger.error('Payment processing error:', error);
        return {
            success: false,
            message: 'Payment failed: ' + error.message,
        };
    }
}

/**
 * Update an order's status
 * @route PUT /api/orders/:id/status
 * @access Private/Admin
 */
exports.updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;

    // Validate status transition
    const validStatuses = ['pending', 'processing', 'packaging', 'shipping', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
        throw new AppError('Invalid order status provided', 400);
    }

    // Find order with validation
    const order = await Order.findById(orderId);

    if (!order) {
        throw new AppError('Order not found', 404);
    }

    // Special handling for cancellation
    if (status === 'cancelled' && order.status !== 'cancelled') {
        // Restore inventory
        const inventoryRestorePromises = order.items.map(item =>
            Product.findByIdAndUpdate(
                item.product,
                { $inc: { defaultQuantity: item.quantity } }
            )
        );

        await Promise.all(inventoryRestorePromises);
    }

    // Update order status with tracking of previous state
    const prevStatus = order.status;
    order.status = status;

    // Status-specific business logic
    if (status === 'shipping') {
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 3);
        order.deliveryDate = deliveryDate;
    } else if (status === 'delivered') {
        order.deliveryDate = new Date();
    }

    // Save updated order
    const updatedOrder = await order.save();

    // Emit real-time order update event
    const io = ioInstance.getIO();
    io.emit('orderUpdated', {
        orderId: updatedOrder._id,
        userId: updatedOrder.user,
        previousStatus: prevStatus,
        newStatus: updatedOrder.status
    });

    logger.info(`Order ${orderId} status updated from ${prevStatus} to ${status}`);

    res.status(200).json({
        success: true,
        data: updatedOrder,
        message: `Order status updated to ${status}`
    });
});

/**
 * Get all orders with advanced filtering and pagination
 * @route GET /api/orders
 * @access Private/Admin
 */
exports.getAllOrders = asyncHandler(async (req, res) => {
    // Extract query parameters with defaults
    const {
        status,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 10,
        sort = '-createdAt'
    } = req.query;

    // Build dynamic filter object
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

    // Enhanced search capabilities
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
            { trackingNumber: searchRegex },
            { 'paymentDetails.paymentId': searchRegex }
        ];

        // Add ObjectId search if valid
        if (mongoose.Types.ObjectId.isValid(search)) {
            filter.$or.push({ _id: search });
        }
    }

    // Normalize pagination parameters
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination and sorting
    const [orders, totalOrders] = await Promise.all([
        Order.find(filter)
            .populate('user', 'name email')
            .populate('shipment')
            .sort(sort)
            .skip(skip)
            .limit(limitNum),
        Order.countDocuments(filter)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalOrders / limitNum);

    res.status(200).json({
        success: true,
        data: orders,
        pagination: {
            currentPage: pageNum,
            totalPages,
            pageSize: limitNum,
            totalOrders
        }
    });
});

/**
 * Get order statistics for dashboard visualization
 * @route GET /api/orders/stats/dashboard
 * @access Private/Admin
 */
exports.getOrderStats = asyncHandler(async (req, res) => {
    // Dynamic date range
    const { period = 'month' } = req.query;

    let startDate = new Date();
    const endDate = new Date();

    // Calculate time period
    switch (period) {
        case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        default:
            startDate.setDate(startDate.getDate() - 30);
    }

    // Execute parallel queries for performance
    const [
        totalOrders,
        pendingOrders,
        processingOrders,
        deliveredOrders,
        cancelledOrders,
        revenueStats,
        timeSeriesRevenue,
        topProducts
    ] = await Promise.all([
        // Order counts by status
        Order.countDocuments(),
        Order.countDocuments({ status: 'pending' }),
        Order.countDocuments({ status: 'processing' }),
        Order.countDocuments({ status: 'delivered' }),
        Order.countDocuments({ status: 'cancelled' }),

        // Revenue statistics
        Order.aggregate([
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
        ]),

        // Time series revenue data
        Order.aggregate([
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
            { $sort: { '_id': 1 } }
        ]),

        // Top products by sales
        Order.aggregate([
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
        ])
    ]);

    // Structure response with numerical precision
    res.status(200).json({
        success: true,
        data: {
            orderCounts: {
                total: totalOrders,
                pending: pendingOrders,
                processing: processingOrders,
                delivered: deliveredOrders,
                cancelled: cancelledOrders
            },
            revenue: revenueStats.length > 0 ? {
                total: Number(revenueStats[0].totalRevenue.toFixed(2)),
                averageOrderValue: Number(revenueStats[0].averageOrderValue.toFixed(2)),
                ordersCount: revenueStats[0].ordersCount
            } : {
                total: 0,
                averageOrderValue: 0,
                ordersCount: 0
            },
            timeSeriesData: timeSeriesRevenue.map(item => ({
                period: item._id,
                revenue: Number(item.revenue.toFixed(2)),
                orders: item.orders
            })),
            topProducts: topProducts.map(product => ({
                productId: product._id,
                name: product.productName,
                quantity: product.totalQuantity,
                revenue: Number(product.totalRevenue.toFixed(2))
            }))
        }
    });
});

/**
 * Get orders for the authenticated user
 * @route GET /api/orders/user
 * @access Private
 */
exports.getUserOrders = asyncHandler(async (req, res) => {
    // Extract pagination and filter parameters
    const {
        page = 1,
        limit = 10,
        status,
        sort = '-createdAt'
    } = req.query;

    // Normalize pagination parameters
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build dynamic filter with user constraint
    const filter = { user: req.user.id };

    if (status) {
        filter.status = status;
    }

    // Execute parallel queries for performance
    const [orders, totalOrders] = await Promise.all([
        Order.find(filter)
            .populate({
                path: 'shipment',
                select: 'address city state postalCode country'
            })
            .populate({
                path: 'items.product',
                select: 'name defaultPrice image'
            })
            .sort(sort)
            .skip(skip)
            .limit(limitNum),
        Order.countDocuments(filter)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalOrders / limitNum);

    logger.info(`Retrieved ${orders.length} orders for user ${req.user.id}`);

    res.status(200).json({
        success: true,
        data: orders,
        pagination: {
            currentPage: pageNum,
            totalPages,
            pageSize: limitNum,
            totalOrders
        }
    });
});

/**
 * Get detailed order information by ID
 * @route GET /api/orders/:id
 * @access Private
 */
exports.getOrderById = asyncHandler(async (req, res) => {
    const orderId = req.params.id;

    // Strategic population with selective field retrieval
    const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate({
            path: 'shipment',
            select: 'address city state postalCode country deliveryCost'
        })
        .populate({
            path: 'items.product',
            select: 'name defaultPrice image defaultQuantity'
        });

    if (!order) {
        throw new AppError('Order not found', 404);
    }

    // Authorization verification
    if (req.user && (order.user._id.toString() !== req.user.id && !req.user.isAdmin)) {
        throw new AppError('Unauthorized to view this order', 403);
    }

    logger.info(`Order ${orderId} retrieved by user ${req.user.id}`);

    res.status(200).json({
        success: true,
        data: order
    });
});

/**
 * Generate a unique tracking number with entropy
 * @private
 */
function generateTrackingNumber(userId, orderDate, orderId) {
    // Extract identifier components
    const userIdPart = userId.toString().slice(-4);
    const orderIdPart = orderId.toString().slice(-4);

    // Format date with timezone-safe approach
    const datePart = orderDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Add entropy component for uniqueness
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    // Construct tracking number with domain-specific prefix
    return `TRK-${userIdPart}${datePart.slice(-4)}${orderIdPart}${randomPart}`.toUpperCase();
}