const express = require('express');
const { createReview, getProductReviews, deleteReview } = require('../controllers/reviewController');
const { isAuthenticated: protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createReview);
router.get('/:productId', getProductReviews);
router.delete('/:id', protect, deleteReview);

module.exports = router;
