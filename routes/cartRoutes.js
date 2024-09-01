const express = require('express');
const {
    addToCart,
    getCart,
    updateCart,
    removeFromCart,
    incrementCartItem,
    decrementCartItem,
    getCartTotalPrice: getTotalPrice,
    removeAllFromCart,
} = require('../controllers/cartController');

const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/add', protect, addToCart);
router.put('/increment/:itemId', protect, incrementCartItem);
router.put('/decrement/:itemId', protect, decrementCartItem);
router.get('/', protect, getCart);
router.post('/price', protect, getTotalPrice);
router.put('/:itemId', protect, updateCart);
router.delete('/:itemId', protect, removeFromCart);
router.delete('/', protect, removeAllFromCart);

module.exports = router;
