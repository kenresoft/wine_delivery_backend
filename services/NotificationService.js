const admin = require('../config/firebaseAdmin');
const {
    getUserDeviceTokens,
    saveNotification,
    chunkArray,
    convertDataToJSON,
    constructMulticastPayload,
} = require('../utils/NotificationUtils');

class NotificationService {

    async sendNotificationToAllUsers(notificationData) {
        try {
            const tokens = await getUserDeviceTokens(); // Get tokens for all users without condition
            if (!tokens.length) {
                console.warn('No valid tokens found for sending notifications to all users.');
                return;
            }

            await this.sendNotification(tokens, notificationData);
            console.log('Notification sent to all users.');
        } catch (error) {
            console.error('Error sending notification to all users:', error);
        }
    }
    async sendUserNotification(userIdOrCondition, notificationData) {
        let tokens = [];
        if (typeof userIdOrCondition === 'string') {
            tokens = await getUserDeviceTokens({ _id: userIdOrCondition });
        } else {
            tokens = await getUserDeviceTokens({ _id: userIdOrCondition });
            // tokens = await getUserDeviceTokens(userIdOrCondition);
        }

        if (!tokens.length) {
            console.warn('No valid tokens found for sending notifications.');
            return;
        }

        await this.sendNotification(tokens, notificationData);

        if (typeof userIdOrCondition === 'string') {
            await saveNotification(userIdOrCondition, notificationData);
        } else {
            await saveNotification(userIdOrCondition, notificationData);
            // console.log('Notification sent to custom user set; saving skipped.');
        }
    }

    async sendNotification(tokens, notificationData) {
        const tokenBatches = chunkArray(tokens, 500);
        for (const batch of tokenBatches) {
            const message = constructMulticastPayload(batch, notificationData);
            try {
                const response = await admin.messaging().sendEachForMulticast(message);
                console.log(`Successfully sent messages to batch:`, response);
                // Handle invalid tokens, similar to the original code
            } catch (error) {
                console.error(`Error sending message to tokens:`, error);
            }
        }
    }


    // Sends cart abandonment reminder to user’s devices
    async sendCartAbandonmentReminder(userId, cartData) {
        const notificationData = {
            title: 'Cart Abandonment',
            body: 'Items are still in your cart! Complete your purchase before they’re gone!',
            data: convertDataToJSON(cartData),
        };
        await this.sendUserNotification(userId, notificationData);
    }

    async sendPersonalizedRecommendations(userId, recommendations) {
        const notificationData = {
            title: 'Personalized Recommendations',
            body: 'We’ve found some wines you might like!',
            data: convertDataToJSON(recommendations),
        };
        await this.sendUserNotification(userId, notificationData);
    }

    async sendPriceDropOrAvailability(userId, product) {
        const notificationData = {
            title: 'Price Drop or Availability Update',
            body: 'A wine on your wishlist is now available or has a new price.',
            data: convertDataToJSON(product),
        };
        await this.sendUserNotification(userId, notificationData);
    }

    async sendShipmentTracking(userId, trackingInfo) {
        const notificationData = {
            title: 'Shipment Update',
            body: `Your order status has been updated: ${trackingInfo.status}`,
            data: convertDataToJSON(trackingInfo),
        };
        await this.sendUserNotification(userId, notificationData);
    }

    async sendAccountNotification(userId, notificationType, additionalData = {}) {
        const messages = {
            passwordReset: 'Password reset request received. Follow instructions to complete reset.',
            accountVerification: 'Account verification required. Check your email for details.',
            securityAlert: 'Suspicious login detected. Review recent activities on your account.',
        };
        const notificationData = {
            title: notificationType,
            body: messages[notificationType] || 'Account-related notification',
            data: convertDataToJSON(additionalData),
        };
        await this.sendUserNotification(userId, notificationData);
    }

    async sendLoginAttemptNotifications(user, attemptData) {
        const notificationData = {
            title: 'New Login Attempt',
            body: `A login attempt was made from IP ${attemptData.ip}, on device ${attemptData.device}.`,
            data: convertDataToJSON(attemptData),
        };
        await this.sendUserNotification(user, notificationData);
    }

}

module.exports = NotificationService;
