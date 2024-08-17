const Order = require('../models/Order');
const Product = require('../models/Product');

exports.createOrder = async (req, res) => {
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
};

exports.getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).populate('items.productId');
        res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.productId');
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
