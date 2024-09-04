const express = require('express');
const { addToFavorites, removeFromFavorites, getFavoriteById, getUserFavorites } = require('../controllers/favoriteController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/add', protect, addToFavorites);
router.get('/:productId', protect, admin, getFavoriteById);
router.get('/', protect, admin, getUserFavorites);
router.delete('/remove', protect, removeFromFavorites);

module.exports = router;