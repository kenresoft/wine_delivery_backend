const express = require('express');
const { createNotification, getUserNotifications, markNotificationAsRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createNotification);
router.get('/', protect, getUserNotifications);
router.put('/:id/read', protect, markNotificationAsRead);

module.exports = router;
