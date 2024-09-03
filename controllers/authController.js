const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Function to check if a user is currently logged in
exports.checkAuthStatus = (req, res) => {
    res.status(200).json({
        success: true,
        message: 'User is authenticated',
        user: req.user,
    });
};


exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const user = await User.create({ username, email, password });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ success: true, token });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

exports.refreshToken = (req, res) => {
    const { refreshToken } = req.body;
  
    if (!refreshToken) {
      return res.status(403).json({ success: false, message: 'Refresh token required' });
    }
  
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  
      res.status(200).json({
        success: true,
        accessToken: newAccessToken,
      });
    } catch (error) {
      console.error('Refresh Token Error:', error);
      res.status(403).json({ success: false, message: 'Invalid refresh token' });
    }
  };
  


exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password').populate({
            path: 'favorites',
            select: 'product',
        });
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true }).select('-password');
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
