const express = require('express');
const { getUsers, deleteUser, getUserById, updateUser, saveDeviceToken } = require('../controllers/userController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, admin, getUsers);
router.put('/deviceToken', protect, saveDeviceToken); // Place this route before `/:id` to prevent clash with other `put` methods.
router.delete('/:id', protect, admin, deleteUser);
router.get('/:id', protect, admin, getUserById);
router.put('/:id', protect, /* admin, */ updateUser);

module.exports = router;
