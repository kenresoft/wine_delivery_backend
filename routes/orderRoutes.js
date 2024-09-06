const express = require('express');
const { createOrder, getUserOrders, getOrderById, updateOrderStatus } = require('../controllers/orderController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createOrder);
router.get('/user', protect, getUserOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, admin, updateOrderStatus);

module.exports = router;
