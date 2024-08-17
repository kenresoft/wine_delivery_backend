const Notification = require('../models/Notification');

exports.createNotification = async (req, res) => {
    try {
        const notification = await Notification.create({
            userId: req.user.id,
            ...req.body,
        });
        res.status(201).json({ success: true, notification });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUserNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id });
        res.status(200).json({ success: true, notifications });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.markNotificationAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
        res.status(200).json({ success: true, notification });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
