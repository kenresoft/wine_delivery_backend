const Cart = require('../models/Cart');

exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const cart = await Cart.findOne({ userId: req.user.id });
        if (cart) {
            const item = cart.items.find(item => item.productId.toString() === productId);
            if (item) {
                item.quantity += quantity;
            } else {
                cart.items.push({ productId, quantity });
            }
            await cart.save();
        } else {
            await Cart.create({ userId: req.user.id, items: [{ productId, quantity }] });
        }
        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        const item = cart.items.find(item => item.productId.toString() === req.params.itemId);
        if (item) {
            item.quantity = req.body.quantity;
            await cart.save();
            res.status(200).json({ success: true, cart });
        } else {
            res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        const itemIndex = cart.items.findIndex(item => item.productId.toString() === req.params.itemId);
        if (itemIndex !== -1) {
            cart.items.splice(itemIndex, 1);
            await cart.save();
            res.status(200).json({ success: true, cart });
        } else {
            res.status(404).json({ success: false, message: 'Item not found in cart' });
        }
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
