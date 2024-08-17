const express = require('express');
const { createPromotion, getAllPromotions, getPromotionById, updatePromotion, deletePromotion } = require('../controllers/promotionController');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, admin, createPromotion);
router.get('/', getAllPromotions);
router.get('/:id', getPromotionById);
router.put('/:id', protect, admin, updatePromotion);
router.delete('/:id', protect, admin, deletePromotion);

module.exports = router;
