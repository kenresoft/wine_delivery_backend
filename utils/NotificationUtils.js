const User = require('../models/User');
const Notification = require('../models/Notification');

// Utility to get device tokens based on custom criteria
async function getUserDeviceTokens(condition = {}) {
    const users = await User.find(condition).select('deviceTokens');
    const tokens = users.reduce((acc, user) => {
        if (user.deviceTokens && user.deviceTokens.length) {
            acc.push(...user.deviceTokens);
        }
        return acc;
    }, []);
    return [...new Set(tokens)]; // Remove duplicates
}

// Utility to save notifications to the database
async function saveNotification(userId, notificationData) {
    try {
        await Notification.create({
            user: userId,
            type: notificationData.title, 
            message: notificationData.body,
            data: notificationData.data,
        });
        console.log('Notification saved to database');
    } catch (error) {
        console.error('Error saving notification to database:', error);
    }
}

// Helper to chunk arrays into smaller batches
function chunkArray(array, size) {
    return array.reduce((acc, _, i) => (i % size) ? acc : [...acc, array.slice(i, i + size)], []);
}

// Helper to convert data to JSON strings, handling nested objects
function convertDataToJSON(data) {
    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
            key,
            typeof value === 'object' ? JSON.stringify(value) : String(value),
        ])
    );
}

// Helper to construct a multicast message payload
function constructMulticastPayload(tokens, notificationData) {
    return {
        notification: {
            title: notificationData.title,
            body: notificationData.body,
        },
        data: notificationData.data || {},
        tokens: tokens,
    };
}

module.exports = {
    getUserDeviceTokens,
    saveNotification,
    chunkArray,
    convertDataToJSON,
    constructMulticastPayload,
};
