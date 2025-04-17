const express = require('express');
const {
    createPromotion,
    getAllPromotions,
    getPromotion,
    updatePromotion,
    deletePromotion,
    getPromotionStats
} = require('../controllers/promotionController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// ADMIN ROUTES (Protected + Admin-only)
router.post('/', protect, admin, createPromotion);
router.put('/:id', protect, admin, updatePromotion);
router.delete('/:id', protect, admin, deletePromotion);
// Analytical routes
router.get('/stats/:promotionId?', protect, admin, getPromotionStats);

// PUBLIC ROUTES (Protected)
router.get('/', protect, getAllPromotions);
router.get('/:id', protect, getPromotion);

module.exports = router;
