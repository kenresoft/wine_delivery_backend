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
    upload.uploadProfileImage(req, res, async (uploadErr) => {
        if (uploadErr) {
            return res.status(400).json({ success: false, error: uploadErr.message || uploadErr });
        }

        try {
            const { id } = req.params;
            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const {
                username,
                email,
                password,
                gender,
                phone,
                bio,
                location,
                isAdmin,
                status,
            } = req.body;

            // Update scalar fields if provided
            if (username) user.username = username;
            if (email) user.email = email;
            if (password) user.password = password; // will be hashed by schema
            if (gender) user.gender = gender;
            if (phone) user.phone = phone;
            if (bio) user.bio = bio;
            if (typeof isAdmin !== 'undefined') user.isAdmin = isAdmin;
            if (typeof status !== 'undefined') user.status = status;

            // Update location if provided
            if (location && typeof location === 'object') {
                user.location.country = location.country || user.location.country;
                user.location.state = location.state || user.location.state;
                user.location.city = location.city || user.location.city;
            }

            // Handle profile image
            if (req.file) {
                user.profileImage = `/uploads/profileImages/${req.file.filename}`;
            }

            // Save updated user
            await user.save();

            // Remove password and populate favorites
            const updatedUser = await User.findById(user._id)
                .select('-password')
                .populate({
                    path: 'favorites',
                    select: 'product',
                });

            res.status(200).json({ success: true, user: updatedUser });
        } catch (error) {
            console.error('Update User Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
};

exports.updatePassword = async (req, res) => {
    try {
        const userId = req.user.id; // from authenticated token
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
        }

        user.password = newPassword; // Schema handles hashing
        await user.save(); // triggers pre('save') and hashes it

        res.status(200).json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Update Password Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};


exports.saveDeviceToken = async (req, res) => {
    const { deviceToken } = req.body;

    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the deviceToken already exists in the array
        if (!user.deviceTokens.includes(deviceToken)) {
            user.deviceTokens.push(deviceToken);
            await user.save();
        }

        res.status(200).json({ message: 'Device token saved successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error });
    }
};
