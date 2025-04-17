const express = require('express');
const {
    getUsers,
    deleteUser,
    getUserById,
    updateUser,
    saveDeviceToken,
    updatePassword,
} = require('../controllers/userController');

const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, admin, getUsers);
router.put('/deviceToken', protect, saveDeviceToken);
router.put('/updatePassword', protect, updatePassword);

router.delete('/:id', protect, admin, deleteUser);
router.get('/:id', protect, admin, getUserById);
router.put('/:id', protect, updateUser);

module.exports = router;
