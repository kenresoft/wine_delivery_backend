const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
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
