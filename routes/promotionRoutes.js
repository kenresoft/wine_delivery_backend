const express = require('express');
const {
    createPromotion,
    getAllPromotions,
    getPromotionById,
    updatePromotion,
    deletePromotion,
    validatePromotionCode
} = require('../controllers/promotionController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

// Admin routes - protected with authentication and admin middleware
router.post('/', protect, admin, createPromotion);
router.get('/admin/all', protect, admin, getAllPromotions);
router.put('/:id', protect, admin, updatePromotion);
router.delete('/:id', protect, admin, deletePromotion);

// Public routes - accessible to all users
router.get('/:id', getPromotionById);
router.post('/validate', validatePromotionCode);

module.exports = router;
