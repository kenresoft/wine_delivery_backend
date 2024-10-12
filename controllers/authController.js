const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { setOtpForUser, sendOtpEmail } = require('../utils/otp');

// Function to check if a user is currently logged in
exports.checkAuthStatus = (req, res) => {
    res.status(200).json({
        success: true,
        message: 'User is authenticated',
        user: req.user,
    });
};


/* exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const user = await User.create({ username, email, password });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ success: true, token });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
}; */

exports.register = async (req, res) => {
    try {
        const { username, email } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpires = Date.now() + 1 * 60 * 1000;  // Expires in 5 minutes

        // Create user with OTP (without setting the password yet)
        user = await User.create({ username, email, otp, otpExpires });

        // Send OTP to user
        await sendOTP(email, otp);

        res.status(201).json({ success: true, message: 'OTP sent to email' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.loginWithPasswordAndOtp = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Password is valid, now generate and send OTP
        const otp = await setOtpForUser(user);
        
        // Send OTP email and handle any potential email errors
        await sendOtpEmail(user, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent to your email. Please verify.',
        });
    } catch (error) {
        // Send an appropriate error response if something fails
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};


/* exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5h' });
        // const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        // Store the refresh token in the database
        await RefreshToken.create({
            userId: user._id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        });

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
}; */

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(403).json({ success: false, message: 'Refresh token required' });
    }

    try {
        const tokenDoc = await RefreshToken.findOne({ token: refreshToken });

        if (!tokenDoc) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        // Verify refresh token
        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
            }

            // Generate new access token
            const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '5h' });
            // const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

            res.status(200).json({ success: true, accessToken: newAccessToken });
        });
    } catch (error) {
        console.error('Refresh Token Error:', error);
        res.status(500).json({ success: false, message: 'Server error' + error.message });
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


// Request OTP (via email or phone)
exports.requestOtp = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate OTP and save it to the user record
        const otp = await setOtpForUser(user);

        // Send OTP (Email/SMS)
        await sendOtpEmail(user, otp);

        res.status(200).json({ success: true, message: 'OTP sent to your email' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error sending OTP' });
    }
};

// Verify OTP and login
exports.verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !user.compareOtp(otp)) {
            return res.status(401).json({ success: false, message: 'Invalid OTP' });
        }

        // OTP is valid, generate JWT token
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '5h' });
        const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        // Store the refresh token in the database
        await RefreshToken.create({
            userId: user._id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        });

        res.status(200).json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error verifying OTP' });
    }
};
