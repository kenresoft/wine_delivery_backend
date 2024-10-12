const express = require('express');
const {
    register,
    loginWithPasswordAndOtp,
    requestOtp, // New route for requesting OTP 
    verifyOtp,
    getUserProfile,
    updateUserProfile,
    checkAuthStatus,
    refreshToken
} = require('../controllers/authController');
const { isAuthenticated: protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes
router.post('/register', register);                      // Registration route
router.post('/login', loginWithPasswordAndOtp);          // Password + OTP-based login
router.post('/request-otp', requestOtp);                 // Route to request OTP via email/SMS
router.post('/verify-otp', verifyOtp);                   // OTP verification route

// Protected Routes (require authentication)
router.get('/profile', protect, getUserProfile);         // Get user profile
router.put('/profile', protect, updateUserProfile);      // Update user profile
router.get('/check', protect, checkAuthStatus);          // Check if user is authenticated
router.post('/refresh', refreshToken);                   // Refresh JWT token

module.exports = router;
