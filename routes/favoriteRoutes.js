const express = require('express');
const { addToFavorites, removeFromFavorites } = require('../controllers/favoriteController');
const {protect} = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/add', protect, addToFavorites);
router.delete('/remove', protect, removeFromFavorites);

module.exports = router;