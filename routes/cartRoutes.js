const express = require('express');
const { addToCart, getCart, updateCart, removeFromCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/add', protect, addToCart);
router.get('/', protect, getCart);
router.put('/:itemId', protect, updateCart);
router.delete('/:itemId', protect, removeFromCart);

module.exports = router;
