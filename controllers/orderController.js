const Order = require('../models/Order');
const Product = require('../models/Product');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const d = require('./cartController');
require('dotenv').config();
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/* exports.createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, totalPrice } = req.body;

        // Check stock availability for each product
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (product.countInStock < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for product: ${product.name}` });
            }
        }

        const order = await Order.create({
            userId: req.user.id,
            items,
            shippingAddress,
            paymentMethod,
            totalPrice,
            isPaid: false,
            isDelivered: false
        });

        // Reduce the stock count for each product
        for (const item of items) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: -item.quantity } });
        }

        res.status(201).json({ success: true, order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
}; */

exports.createOrder = async (req, res) => {
    try {
        const { subTotal, description, currency } = req.body;
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
            user: user._id, // Only store user ID
            items: cart.items,
            shipment: shipment._id, // Only store shipment ID
            subTotal: subTotal,
            totalCost: subTotal + shipment.deliveryCost,
        });

        // const customerId = user ? user._id.toString() : null;

        const paymentResponse = await processPayment(
            subTotal,
            description,
            currency,
        );

        if (!paymentResponse.success) {
            return res.status(400).json({
                success: paymentResponse.success,
                message: paymentResponse.message,
            });
        }

        order.paymentDetails = paymentResponse.data; // Store payment details in order

        // Save the order
        await order.save();

        // Reduce the stock count for each product
        /* for (const item of cart) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { countInStock: -item.quantity } });
        } */

        res.status(201).json({ message: 'Order created successfully', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error: ' + error });
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
        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
