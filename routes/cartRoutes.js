const express = require('express');
const {
    addToCart,
    getCart,
    updateCart,
    removeFromCart,
    incrementCartItem,
    decrementCartItem,
    getCartTotalPrice,
    clearCart,
    getCartItemQuantity,
    applyCoupon,
    removeCoupon,
} = require('../controllers/cartController');

const { isAuthenticated: protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.put('/increment/:itemId', protect, incrementCartItem);
router.put('/decrement/:itemId', protect, decrementCartItem);
router.get('/quantity/:itemId', protect, getCartItemQuantity);
router.post('/apply-coupon', protect, applyCoupon);
router.delete('/remove-coupon', protect, removeCoupon);
router.get('/price', protect, getCartTotalPrice);
// router.get('/total', protect, getCartTotalPrice);

router.post('/add', protect, addToCart);
router.get('/', protect, getCart);
router.put('/:itemId', protect, updateCart);
router.delete('/:itemId', protect, removeFromCart);
router.delete('/', protect, clearCart);

module.exports = router;
