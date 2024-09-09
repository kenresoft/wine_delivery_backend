const express = require('express');
const { createProduct, getAllProducts, getProductById, updateProduct, deleteProduct, getProductsByIds } = require('../controllers/productController');
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, admin, createProduct);
router.get('/', getAllProducts);
router.get('/ids/:ids', getProductsByIds);
router.get('/:id', getProductById);
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

module.exports = router;
