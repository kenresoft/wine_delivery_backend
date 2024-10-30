// services/NotificationService.js
const admin = require('../config/firebaseAdmin');
const User = require('../models/User');

class NotificationService {

    // Send push notification for cart abandonment
    async sendCartAbandonmentReminder(userId, cartData) {
        const message = {
            notification: {
                title: 'Cart Abandonment',
                body: 'Items are still in your cart! Complete your purchase before they’re gone!',
            },
            data: this.convertDataToStrings(cartData), // Convert values to strings
            token: await this.getUserDeviceToken(userId),
        };

        await this.sendNotification(message);
    }

    async sendPersonalizedRecommendations(userId, recommendations) {
        const message = {
            notification: {
                title: 'Personalized Recommendations',
                body: 'We’ve found some wines you might like!',
            },
            data: recommendations,
            token: await this.getUserDeviceToken(userId),
        };

        await this.sendNotification(message);
    }

    async sendPriceDropOrAvailability(userId, product) {
        const message = {
            notification: {
                title: 'Price Drop or Availability Update',
                body: 'A wine on your wishlist is now available or has a new price.',
            },
            data: product,
            token: await this.getUserDeviceToken(userId),
        };

        await this.sendNotification(message);
    }

    async sendShipmentTracking(userId, trackingInfo) {
        const message = {
            notification: {
                title: 'Shipment Update',
                body: `Your order status has been updated: ${trackingInfo.status}`,
            },
            data: trackingInfo,
            token: await this.getUserDeviceToken(userId),
        };

        await this.sendNotification(message);
    }

    async sendAccountNotification(userId, notificationType, additionalData = {}) {
        const messages = {
            passwordReset: 'Password reset request received. Follow instructions to complete reset.',
            accountVerification: 'Account verification required. Check your email for details.',
            securityAlert: 'Suspicious login detected. Review recent activities on your account.',
        };

        const message = {
            notification: {
                title: notificationType,
                body: messages[notificationType] || 'Account-related notification',
            },
            data: additionalData,
            token: await this.getUserDeviceToken(userId),
        };

        await this.sendNotification(message);
    }

    async getUserDeviceToken(userId) {
        const user = await User.findById(userId);
        if (!user?.deviceToken) {
            console.warn(`No device token found for user ${userId}`);
            return null;
        }
        return user.deviceToken;
    }

    async sendNotification(payload) {
        if (!payload.token) {
            console.warn('Skipping notification: No device token provided.');
            return;
        }

        try {
            const response = await admin.messaging().send(payload);
            console.log('Notification sent successfully:', response);
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    // Helper function to convert all values in an object to strings
    convertDataToStrings(data) {
        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, String(value)])
        );
    }

}

module.exports = NotificationService;
