const express = require('express');
const { getUsers, deleteUser, getUserById, updateUser, getUsersFavorites, getUserFavoritesById } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', protect, admin, getUsers);
router.get('/favorites/', protect, admin, getUsersFavorites);
router.delete('/:id', protect, admin, deleteUser);
router.get('/:id', protect, admin, getUserById);
router.get('/favorites/:productId', protect, admin, getUserFavoritesById);
router.put('/:id', protect, admin, updateUser);

module.exports = router;
