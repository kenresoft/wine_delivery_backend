const express = require('express');
const { getUsers, deleteUser, getUserById, updateUser } = require('../controllers/userController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', protect, admin, getUsers);
router.delete('/:id', protect, admin, deleteUser);
router.get('/:id', protect, admin, getUserById);
router.put('/:id', protect, /* admin, */ updateUser);
module.exports = router;
