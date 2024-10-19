const User = require('../models/User');
const upload = require('../middleware/upload'); // Import the multer configuration

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
        const user = await User.findById(req.params.id).select('-password').populate({
            path: 'favorites',
            select: 'product',
        });
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
        // Handle file upload if a profile image is provided
        upload.uploadProfileImage(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err });
            }

            const { id } = req.params;
            const updates = req.body;

            // If a new profile image is uploaded, update the path in the user data
            if (req.file) {
                updates.profileImage = `/uploads/profileImages/${req.file.filename}`;
            }

            const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password').populate({
                path: 'favorites',
                select: 'product',
            });

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            res.status(200).json({ success: true, user });
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};