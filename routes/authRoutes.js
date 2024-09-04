const express = require('express');
const { register, login, getUserProfile, updateUserProfile, checkAuthStatus, refreshToken } = require('../controllers/authController');
const { isAuthenticated: protect, } = require('../middleware/authMiddleware');

const router = express.Router();

// Public Routes
router.post('/register', register);
router.post('/login', login);

// Protected Routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.get('/check', protect, checkAuthStatus);
router.post('/refresh', refreshToken);

module.exports = router;
