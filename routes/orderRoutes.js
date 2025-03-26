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
router.post('/', protect, createOrder);
router.get('/user', protect, getUserOrders);
// router.get('/my-orders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/purchase', protect, makePurchase);

// Admin order routes
router.get('/', protect, admin, getAllOrders);
router.put('/:id/status', protect, admin, updateOrderStatus);
router.get('/stats/dashboard', protect, admin, getOrderStats);



module.exports = router;
