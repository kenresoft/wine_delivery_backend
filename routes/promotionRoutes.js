const express = require('express');
const {
    createPromotion,
    getAllPromotions,
    getPromotion,
    updatePromotion,
    deletePromotion,
    getProductsByPromotion,
    checkBulkEligibility
} = require('../controllers/promotionController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// ADMIN ROUTES (Protected + Admin-only)
router.post('/', protect, admin, createPromotion);
router.get('/admin', protect, admin, getAllPromotions); // Filterable admin view
router.put('/:id', protect, admin, updatePromotion);
router.delete('/:id', protect, admin, deletePromotion);

// PUBLIC ROUTES (Protected)
router.get('/', protect, getAllPromotions); // Filterable public view
router.get('/:id', protect, getPromotion);

// PROMOTION APPLICATION ROUTES
router.get('/:promotionCode/products', protect, getProductsByPromotion); // Get discounted products
router.post('/check-eligibility', protect, checkBulkEligibility); // Bulk eligibility check

module.exports = router;