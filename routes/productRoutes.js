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
    addReview,
    searchProducts,
    getProductsByCategory,
    getTopRatedProducts,
    getNewArrivals,
    getProductsOnSale,
    getRelatedProducts,
    getPopularProducts,
    getProductWithPricing
} = require('../controllers/productController');

const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const router = express.Router();

// Core CRUD operations
router.post('/',/*  protect, admin, */ createProduct);
router.get('/', getAllProducts);
router.get('/ids/:ids', getProductsByIds);
router.get('/:id', getProductById);
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);
router.put('/image/:id', protect, admin, updateProductImage);
router.post('/review/:id', protect, addReview);

// Advanced operations with search, filter, sort, and pagination
router.get('/search/products', searchProducts);
router.get('/category/:categoryId', getProductsByCategory);

// Specialized product listings
router.get('/listings/popular', getPopularProducts); //✅ 
router.get('/listings/top-rated', getTopRatedProducts); // ✅
router.get('/listings/new-arrivals', getNewArrivals); // ✅
router.get('/listings/on-sale', getProductsOnSale); // ✅
router.get('/related/:productId', getRelatedProducts);

router.get('/:productId/with-pricing', getProductWithPricing);

module.exports = router;
