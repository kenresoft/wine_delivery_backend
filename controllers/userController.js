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

exports.saveDeviceToken = async (req, res) => {
    const { deviceToken } = req.body;

    try {
        const userId = req.user.id;

        const user = await User.findByIdAndUpdate(
            userId,
            { deviceToken },
            { new: true }         // Return the updated user document
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'Device token updated successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error });
    }
};