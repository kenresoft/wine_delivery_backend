// routes/productRoutes.js
const express = require('express');
const {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductsByIds,
    updateProductImage,
    addReview
} = require('../controllers/productController');

const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, admin, createProduct);           // Create product
router.get('/', getAllProducts);                           // Get all products
router.get('/ids/:ids', getProductsByIds);                 // Get products by multiple IDs
router.get('/:id', getProductById);                        // Get single product by ID
router.put('/:id', protect, admin, updateProduct);         // Update product by ID
router.delete('/:id', protect, admin, deleteProduct);      // Delete product by ID

router.put('/image/:id', protect, admin, updateProductImage); // Update product image by ID
router.post('/review/:id', protect, admin, addReview); // Add review to product

module.exports = router;
