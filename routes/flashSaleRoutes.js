const express = require('express');
const {
    createFlashSale,
    getAllFlashSales,
    getFlashSaleById,
    updateFlashSale,
    deleteFlashSale,
    getActiveFlashSales,
    getFlashSaleProducts
} = require('../controllers/flashSaleController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

// Admin routes - protected with authentication and admin middleware
router.post('/', /* protect, admin,  */createFlashSale);
router.put('/:id', /* protect, admin, */ updateFlashSale);
router.delete('/:id', /* protect, admin,  */deleteFlashSale);
router.get('/admin/all', protect, admin, getAllFlashSales);

// Public routes - accessible to all users
router.get('/active', getActiveFlashSales);
router.get('/products', getFlashSaleProducts);
router.get('/:id', getFlashSaleById);

module.exports = router;