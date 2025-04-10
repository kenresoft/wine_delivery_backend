const express = require('express');
const {
    createOrder,
    getUserOrders,
    getOrderById,
    updateOrderStatus,
    makePurchase,
    getAllOrders,
    getOrderStats
} = require('../controllers/orderController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

// Customer order routes
router.route('/')
    .post(protect, createOrder) // Create a new order from cart
    .get(protect, admin, getAllOrders); // Get all orders (admin only)

// User-specific order routes
router.get('/user', protect, getUserOrders); // Get orders for authenticated user

// Order processing routes
router.route('/:id/purchase')
    .put(protect, makePurchase); // Process payment for an order

// Order status management (admin only)
router.route('/:id/status')
    .put(protect, admin, updateOrderStatus); // Update order status

// Order details
router.get('/:id', protect, getOrderById); // Get order details (user or admin)

// Admin analytics
router.get('/stats/dashboard', protect, admin, getOrderStats); // Get order statistics for dashboard

module.exports = router;
