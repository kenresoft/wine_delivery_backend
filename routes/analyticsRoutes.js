const express = require('express');
const {
    getSalesAnalytics,
    getPromotionPerformance,
    getFlashSalePerformance,
    getProductPerformance,
    getDashboardMetrics
} = require('../controllers/analyticsController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

// All analytics routes are protected for admin access only 
router.get('/sales', protect, admin, getSalesAnalytics);
router.get('/dashboard', protect, admin, getDashboardMetrics);
router.get('/promotions', protect, admin, getPromotionPerformance);
router.get('/flash-sales', protect, admin, getFlashSalePerformance);
router.get('/products/:productId?', protect, admin, getProductPerformance);

module.exports = router;