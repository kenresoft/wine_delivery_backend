const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const ioInstance = require('../utils/ioInstance');
require('dotenv').config();
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createOrder = async (req, res) => {
    try {
        const { note, subTotal } = req.body;
        const user = await User.findById(req.user.id, { password: 0, isAdmin: 0 });

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized access' });
        }

        const cart = await Cart.findOne({ user: user._id });

        if (!cart) {
            return res.status(400).json({ message: 'No items in the cart for you to order' });
        }

        // Retrieve the user's default or preferred shipping address
        const shipment = await Shipment.findOne({ user: user });

        if (!shipment) {
            return res.status(400).json({ message: 'No shipping address found for this user' });
        }

        // Create order document
        const order = new Order({
            user: user._id,
            items: cart.items,
            shipment: shipment._id,
            subTotal: subTotal,
            totalCost: subTotal + shipment.deliveryCost,
            note: note || '',
        });

        // const customerId = user ? user._id.toString() : null;

        // Save the order
        await order.save();

        // Reduce the stock count for each product
        /* for (const item of cart) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: -item.quantity } });
        } */ 

        // Emit a real-time event to notify the user
        const io = ioInstance.getIO();
        io.emit('orderCreated', { order });

        res.status(201).json({ message: 'Order created successfully', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error: ' + error });
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

        const paymentResponse = await processPayment(
            order.totalCost,
            description,
            currency,
        );

        if (!paymentResponse.success) {
            return res.status(400).json({
                success: paymentResponse.success,
                message: paymentResponse.message,
            });
        }

        const trackingNumber = generateTrackingNumber(order.user, order.createdAt, order._id);
        console.log('Generated tracking number:', trackingNumber);

        order.paymentDetails = paymentResponse.data;
        order.status = 'pending';
        order.paymentMethod = paymentMethod;
        order.trackingNumber = trackingNumber;

        // Save the updated order
        await order.save();

        res.status(200).json({ success: true, message: 'Payment successful', order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

async function processPayment(amount, description, currency) {
    try {
        const paymentIntent = await Stripe.paymentIntents.create({
            amount: amount * 100,
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
                publishableKey: process.env.PUBLISHABLE_KEY
            },
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

exports.updateOrder = async (req, res) => {
    try {
        const { status, paymentMethod, paymentDetails } = req.body;
        const orderId = req.params.id;

        // Find the order by ID
        const order = await Order.findById(orderId).populate('items.product');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.status = status;
        order.paymentMethod = paymentMethod;
        order.paymentDetails = paymentDetails;

        // Save the updated order
        await order.save();

        // Emit real-time update to clients
        const io = ioInstance.getIO();
        io.emit('orderUpdated', { order });

        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })/* .populate('items.product') */;
        res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)/* .populate('items.product') */;
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        // Emit real-time update to clients
        const io = ioInstance.getIO();
        io.emit('orderUpdated', { order });

        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

function generateTrackingNumber(userId, orderDate, orderId) {
    // Extract the last 4 digits from each ID
    const userIdPart = userId.toString().slice(-4);
    const orderIdPart = orderId.toString().slice(4);

    // Format the date as YYYYMMDD
    const datePart = orderDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Combine the parts and convert to uppercase
    const trackingNumber = `${userIdPart}${orderIdPart}${datePart}`.toUpperCase();

    // If the tracking number is longer than 10 characters, truncate it
    if (trackingNumber.length > 10) {
        return trackingNumber.slice(0, 10);
    }

    return trackingNumber;
}
