const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.isAuthenticated = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided. Access denied.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found. Access denied.' });
        }

        req.user = user;
        req.isAdmin = user.isAdmin;
        next();
    } catch (error) {
        console.error('Authentication Error:', error.message);
        res.status(401).json({ success: false, message: 'Invalid or expired token. Access denied.' });
    }
};

exports.isSocketAuthenticated = async (socket, next) => {
    try {
        const authHeader = socket.handshake.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next({ success: false, message: 'No token provided. Access denied.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return next({ success: false, message: 'User not found. Access denied.' });
        }

        socket.user = user;
        next();
    } catch (error) {
        console.error('Authentication Error:', error.message);
        next({ success: false, message: 'Invalid or expired token. Access denied.' });
    }
};


exports.admin = async (req, res, next) => {
    try {
        // Fetch the user from the database
        const user = await User.findById(req.user.id);

        // Check if the user is an admin
        if (user && user.isAdmin) {
            return next();
        } else {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
