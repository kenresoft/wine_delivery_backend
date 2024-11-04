// services/NotificationService.js
const admin = require('../config/firebaseAdmin');
const User = require('../models/User');

class NotificationService {
    // Send push notification for cart abandonment
    async sendCartAbandonmentReminder(userId, cartData) {
        const topic = `user_${userId}_notifications`;  // Unique topic for each user
        const notificationData = {
            title: 'Cart Abandonment',
            body: 'Items are still in your cart! Complete your purchase before they’re gone!',
            data: this.convertDataToJSON(cartData),
        };

        await this.sendTopicNotification(topic, notificationData);
    }

    async sendPersonalizedRecommendations(userId, recommendations) {
        const topic = `user_${userId}_notifications`;
        const notificationData = {
            title: 'Personalized Recommendations',
            body: 'We’ve found some wines you might like!',
            data: this.convertDataToJSON(recommendations),
        };

        await this.sendTopicNotification(topic, notificationData);
    }

    async sendPriceDropOrAvailability(userId, product) {
        const topic = `user_${userId}_notifications`;
        const notificationData = {
            title: 'Price Drop or Availability Update',
            body: 'A wine on your wishlist is now available or has a new price.',
            data: this.convertDataToJSON(product),
        };

        await this.sendTopicNotification(topic, notificationData);
    }

    async sendShipmentTracking(userId, trackingInfo) {
        const topic = `user_${userId}_notifications`;
        const notificationData = {
            title: 'Shipment Update',
            body: `Your order status has been updated: ${trackingInfo.status}`,
            data: this.convertDataToJSON(trackingInfo),
        };

        await this.sendTopicNotification(topic, notificationData);
    }

    async sendAccountNotification(userId, notificationType, additionalData = {}) {
        const topic = `user_${userId}_notifications`;
        const messages = {
            passwordReset: 'Password reset request received. Follow instructions to complete reset.',
            accountVerification: 'Account verification required. Check your email for details.',
            securityAlert: 'Suspicious login detected. Review recent activities on your account.',
        };

        const notificationData = {
            title: notificationType,
            body: messages[notificationType] || 'Account-related notification',
            data: this.convertDataToJSON(additionalData),
        };

        await this.sendTopicNotification(topic, notificationData);
    }

    // Subscribe device token to a topic
    async subscribeToTopic(userId, deviceToken) {
        const topic = `user_${userId}_notifications`;  // Unique topic per user
        try {
            const response = await admin.messaging().subscribeToTopic([deviceToken], topic);
            console.log(`Successfully subscribed to topic ${topic}:`, response);
        } catch (error) {
            console.error(`Error subscribing to topic ${topic}:`, error);
        }
    }

    // Unsubscribe device token from a topic (optional for cleanup)
    async unsubscribeFromTopic(userId, deviceToken) {
        const topic = `user_${userId}_notifications`;
        try {
            const response = await admin.messaging().unsubscribeFromTopic([deviceToken], topic);
            console.log(`Successfully unsubscribed from topic ${topic}:`, response);
        } catch (error) {
            console.error(`Error unsubscribing from topic ${topic}:`, error);
        }
    }

    // Send a notification to a topic
    async sendTopicNotification(topic, notificationData) {
        const message = {
            notification: {
                title: notificationData.title,
                body: notificationData.body,
            },
            data: notificationData.data || {},
            topic: topic,
        };

        try {
            const response = await admin.messaging().send(message);
            console.log(`Successfully sent message to topic ${topic}:`, response);
        } catch (error) {
            console.error(`Error sending message to topic ${topic}:`, error);
        }
    }

    async sendNotifications(tokens, notificationData) {
        const message = {
            notification: {
                title: notificationData.title,
                body: notificationData.body,
            },
            data: notificationData.data || {},
            tokens: tokens,
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`Successfully sent message to tokens ${tokens}:`, response);
        } catch (error) {
            console.error(`Error sending message to tokens ${tokens}:`, error);
        }
    }

    // Example: Send login attempt notification to a specific topic
/*     async sendLoginAttemptNotifications(userId, attemptData) {
        const topic = `user_${userId}_notifications`;
        const notificationData = {
            title: 'New Login Attempt',
            body: `A login attempt was made on ${attemptData.date} at ${attemptData.time} from IP ${attemptData.ip}, on device ${attemptData.device}.`,
            data: this.convertDataToJSON(attemptData),
        };

        await this.sendTopicNotification(topic, notificationData);
    } */

    // Example: Send login attempt notification to a all logged in devices.
    async sendLoginAttemptNotifications(user, attemptData) {
        const tokens = await this.getUserDeviceTokens(user);
        const notificationData = {
            title: 'New Login Attempt',
            body: `A login attempt was made on ${attemptData.date} at ${attemptData.time} from IP ${attemptData.ip}, on device ${attemptData.device}.`,
            data: this.convertDataToJSON(attemptData),
        };

        await this.sendNotifications(tokens, notificationData);
    }

    async sendLoginAttemptNotification(user, attemptData) {
        const { date, time, ip, device } = attemptData;
        
        const message = {
            notification: {
                title: 'New Login Attempt',
                body: `A login attempt was made on ${date} at ${time} from IP ${ip}, on device ${device}.`,
            },
            data: attemptData,
            token: await this.getUserDeviceToken(user),
        };

        await this.sendNotification(message);
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

    // Helper function to convert all values in an object to JSON strings
    convertDataToJSON(data) {
        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, JSON.stringify(value)])
        );
    }

    async getUserDeviceTokens(user) {
        if (!user?.deviceTokens) {
            console.warn(`No device token found for user ${user.id}`);
            return null;
        }
        return user.deviceTokens || [];
    }

    async getUserDeviceToken(user) {
        if (!user?.deviceTokens) {
            console.warn(`No device token found for user ${user.id}`);
            return null;
        }
        return user.deviceTokens[0];
    }

}

module.exports = NotificationService;
