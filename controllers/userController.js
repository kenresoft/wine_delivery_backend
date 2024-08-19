const User = require('../models/User');

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(204).json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

/* exports.addToFavorites = async (req, res) => {
    try {
        const userId = req.user._id; // Extract user ID from the request
        const productId = req.body.productId; // Get product ID from request body

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.favorites.includes(productId)) {
            return res.status(400).json({ success: false, message: 'Product already in favorites' });
        }

        user.favorites.push(productId);
        await user.save();

        res.status(200).json({ success: true, message: 'Product added to favorites' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.removeFromFavorites = async (req, res) => {
    try {
        const userId = req.user._id;
        const productId = req.body.productId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if product is in favorites
        const index = user.favorites.indexOf(productId);
        if (index === -1) {
            return res.status(400).json({ success: false, message: 'Product not in favorites' });
        }

        // Remove product from favorites
        user.favorites.splice(index, 1);
        await user.save();

        res.status(200).json({ success: true, message: 'Product removed from favorites' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
}; */