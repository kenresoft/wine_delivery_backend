const mongoose = require('mongoose');
const path = require('path');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const upload = require('../middleware/upload');
const {
    calculateRelatedProducts,
    getProductDetails,
    deleteOldFile,
} = require('../utils/product');
const dotenv = require('dotenv');

dotenv.config();

exports.createProduct = async (req, res) => {
    try {
        // Handle file upload
        upload.uploadProductImages(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err });
            }

            const {
                name, category, alcoholContent, description, sku, brand, tags, weight, dimensions, expirationDate,
                isFeatured, isNewArrival, isOnSale, variants, shippingCost, relatedProducts, reviews, suppliers
            } = req.body;

            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(400).json({ message: 'Invalid category' });
            }

            // Calculate default price, quantity, and discount from suppliers
            const defaultPrice = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / suppliers.length : 0;
            const defaultQuantity = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0) : 0;
            const defaultDiscount = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + (supplier.discount || 0), 0) / suppliers.length : 0;

            // Handle image paths
            const images = req.files ? req.files.map(file => `/uploads/products/${file.filename}`) : [];

            // Add image path if uploaded
            // const imagePath = req.file ? `/uploads/productImages/${req.file.filename}` : null;

            const product = new Product({
                name, category, alcoholContent, description, sku, brand, tags, weight, dimensions, expirationDate,
                isFeatured, isNewArrival, isOnSale, variants, shippingCost, relatedProducts, reviews,
                suppliers, defaultPrice, defaultQuantity, defaultDiscount, images
            });

            await product.save();
            res.status(201).json({ success: true, product });
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('suppliers relatedProducts');

        // Calculate average default price, total quantity, and average discount
        product.defaultPrice = product.defaultPrice ||
            (product.suppliers.length > 0 ?
                product.suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / product.suppliers.length
                : 0);

        product.defaultQuantity = product.defaultQuantity ||
            (product.suppliers.length > 0 ?
                product.suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0)
                : 0);

        product.defaultDiscount = product.defaultDiscount ||
            (product.suppliers.length > 0 ?
                product.suppliers.reduce((sum, supplier) => sum + supplier.discount, 0) / product.suppliers.length
                : 0);

        // Calculate related products based on tag, brand, dimensions, weight, and supplier
        const relatedResult = await calculateRelatedProducts(product);
        product.relatedProducts = relatedResult.relatedProducts;

        res.json({ product, matchInfo: relatedResult.matchInfo });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product details' });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null; // Get user ID if logged in

        const products = await Product.find()
            .populate('category')
            .populate('suppliers.supplier')
            .populate('relatedProducts', '-_id')
            .populate('reviews.user', { password: 0, isAdmin: 0, favorites: 0, profileImage: 0 });

        // If user is logged in, fetch their favorites
        if (userId) {
            const userFavorites = await User.findById(userId, 'favorites');

            // Create a set of favorite product IDs for efficient lookup
            const favoriteProductIds = new Set(userFavorites.favorites.map(f => f.product));

            // Add an `isFavorited` property to each product
            products.forEach(product => {
                product.isFavorited = favoriteProductIds.has(product._id.toString());
            });
        }

        // Process products sequentially using for...of
        for (const product of products) {
            // Calculate default price, quantity, and discount from suppliers
            product.defaultPrice = product.defaultPrice ||
                (product.suppliers.length > 0 ?
                    product.suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / product.suppliers.length
                    : 0);

            product.defaultQuantity = product.defaultQuantity ||
                (product.suppliers.length > 0 ?
                    product.suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0)
                    : 0);

            product.defaultDiscount = product.defaultDiscount ||
                (product.suppliers.length > 0 ?
                    product.suppliers.reduce((sum, supplier) => sum + (supplier.discount || 0), 0) / product.suppliers.length
                    : 0);

            getProductDetails(product);

            // Calculate related products
            const matchedProducts = await calculateRelatedProducts(product);
            product.relatedProducts = matchedProducts;
        }

        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getProductsByIds = async (req, res) => {
    try {
        const productIds = req.params.ids;
        const userId = req.user ? req.user.id : null; // Get user ID if logged in

        if (!productIds || productIds.length === 0) {
            return res.status(400).json({ message: 'Invalid product IDs' });
        }

        // Split and filter valid ObjectIds
        const idsArray = productIds.split(',')
            .map(id => id.trim())
            .filter(id => mongoose.Types.ObjectId.isValid(id));

        if (idsArray.length === 0) {
            return res.status(400).json({ message: 'No valid product IDs provided' });
        }

        const products = await Product.find({ _id: { $in: idsArray } })
            .populate('category')
            .populate('suppliers.supplier')
            .populate('relatedProducts')
            .populate('reviews.user', { password: 0, isAdmin: 0 });

        if (products.length === 0) {
            return res.status(404).json({ success: false, message: 'No products found for the provided IDs' });
        }

        // If user is logged in, fetch their favorites
        let favoriteProductIds = new Set();
        if (userId) {
            const userFavorites = await User.findById(userId, 'favorites');
            favoriteProductIds = new Set(userFavorites.favorites.map(f => f.product.toString()));
        }

        // Calculate default values and related products for each product
        for (const product of products) {
            // Calculate default price, quantity, and discount from suppliers
            product.defaultPrice = product.defaultPrice ||
                (product.suppliers.length > 0 ?
                    product.suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / product.suppliers.length
                    : 0);

            product.defaultQuantity = product.defaultQuantity ||
                (product.suppliers.length > 0 ?
                    product.suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0)
                    : 0);

            product.defaultDiscount = product.defaultDiscount ||
                (product.suppliers.length > 0 ?
                    product.suppliers.reduce((sum, supplier) => sum + (supplier.discount || 0), 0) / product.suppliers.length
                    : 0);

            getProductDetails(product);

            // Calculate related products
            const matchedProducts = await calculateRelatedProducts(product);
            product.relatedProducts = matchedProducts;

            // Add `isFavorited` property
            product.isFavorited = favoriteProductIds.has(product._id.toString());
        };

        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null; // Get user ID if logged in

        const product = await Product.findById(req.params.id)
            .populate('category')
            .populate('suppliers.supplier')
            .populate('relatedProducts', '-_id') // Exclude _id field
            .populate('reviews.user', { password: 0, isAdmin: 0 });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Calculate default price, quantity, and discount from suppliers
        product.defaultPrice = product.defaultPrice ||
            (product.suppliers.length > 0 ?
                product.suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / product.suppliers.length
                : 0);

        product.defaultQuantity = product.defaultQuantity ||
            (product.suppliers.length > 0 ?
                product.suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0)
                : 0);

        product.defaultDiscount = product.defaultDiscount ||
            (product.suppliers.length > 0 ?
                product.suppliers.reduce((sum, supplier) => sum + (supplier.discount || 0), 0) / product.suppliers.length
                : 0);

        getProductDetails(product);

        // Calculate related products
        const matchedProducts = await calculateRelatedProducts(product);
        product.relatedProducts = matchedProducts;

        // Add `isFavorited` if the user is logged in
        if (userId) {
            const userFavorites = await User.findById(userId, 'favorites');
            const isFavorited = userFavorites.favorites.some(f => f.product.equals(product._id));
            product.isFavorited = isFavorited;
        }

        res.status(200).json({ success: true, product });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        // Handle file upload
        upload.uploadProductImages(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err });
            }

            const { id } = req.params;
            const updatedData = req.body;

            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            const categoryExists = await Category.findById(updatedData.category);
            if (!categoryExists) {
                return res.status(400).json({ message: 'Invalid category' });
            }

            // Update suppliers and recalculate price, quantity, and discount if suppliers are updated
            if (updatedData.suppliers) {
                const { suppliers } = updatedData;
                product.defaultPrice = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / suppliers.length : 0;
                product.defaultQuantity = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0) : 0;
                product.defaultDiscount = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + (supplier.discount || 0), 0) / suppliers.length : 0;
            }

            // If new images are uploaded, update the product's images array
            if (req.files) {
                updates.images = req.files.map(file => `/uploads/products/${file.filename}`);
            }

            // If a new product image is uploaded, update the image path
            // if (req.file) {
            //     updatedData.image = `/uploads/productImages/${req.file.filename}`;
            // }

            Object.assign(product, updatedData);
            await product.save();

            res.status(200).json({ success: true, product });
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateProductImage = async (req, res) => {
    try {
        // Handle file upload for new images
        upload.uploadProductImages(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err });
            }

            const { id } = req.params;
            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            if (req.files && req.files.length > 0) {
                const newImages = req.files.map(file => `${file.destination.replace(/^\./, '')}/${file.filename}`);

                // Preserve existing images not being replaced, and delete old ones
                const imagesToDelete = product.images.filter(img => !newImages.includes(img));

                // Delete old images asynchronously
                await Promise.all(imagesToDelete.map(img => deleteOldFile(path.join(__dirname, '..', img))));

                // Update product images with the new images
                product.images = newImages;
            }

            await product.save();
            res.status(200).json({ success: true, product });
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.deleted = true;
        await product.save();
        res.status(200).json({ message: 'Product marked as deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const newReview = {
            rating,
            comment,
            user: req.user._id
        };

        product.reviews.push(newReview);
        product.rating = product.calculateAverageRating();
        product.reviewCount = product.reviews.length;

        await product.save();
        res.status(201).json({ message: 'Review added successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateStockStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { stockStatus } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.stockStatus = stockStatus;
        await product.save();

        res.status(200).json({ message: 'Stock status updated successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateVariants = async (req, res) => {
    try {
        const { id } = req.params;
        const { variants } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.variants = variants;
        await product.save();

        res.status(200).json({ message: 'Variants updated successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateTags = async (req, res) => {
    try {
        const { id } = req.params;
        const { tags } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.tags = tags;
        await product.save();

        res.status(200).json({ message: 'Tags updated successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateDimensions = async (req, res) => {
    try {
        const { id } = req.params;
        const { dimensions } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.dimensions = dimensions;
        await product.save();

        res.status(200).json({ message: 'Dimensions updated successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getDiscountedPrice = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Use the default discount for the product, or calculate based on suppliers
        const discountedPrice = product.defaultPrice * (1 - product.defaultDiscount / 100);
        res.status(200).json({ discountedPrice });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSupplierDetails = async (req, res) => {
    try {
        const { productId, supplierId } = req.params;
        const { price, quantity, discount, restockDate } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const supplier = product.suppliers.find(sup => sup.supplier.toString() === supplierId);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found for this product' });
        }

        // Update supplier-specific details
        supplier.price = price || supplier.price;
        supplier.quantity = quantity || supplier.quantity;
        supplier.discount = discount || supplier.discount;
        supplier.restockDate = restockDate || supplier.restockDate;

        // Recalculate default price, quantity, and discount
        product.defaultPrice = product.suppliers.length > 0 ? product.suppliers.reduce((sum, sup) => sum + sup.price, 0) / product.suppliers.length : 0;
        product.defaultQuantity = product.suppliers.reduce((sum, sup) => sum + sup.quantity, 0);
        product.defaultDiscount = product.suppliers.reduce((sum, sup) => sum + (sup.discount || 0), 0) / product.suppliers.length;

        await product.save();
        res.status(200).json({ message: 'Supplier details updated successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update restock date for a specific supplier
exports.updateRestockDate = async (req, res) => {
    try {
        const { id } = req.params;  // Product ID
        const { supplierId, restockDate } = req.body;  // Supplier ID and new restock date

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Find the specific supplier within the product
        const supplier = product.suppliers.find(supplier => supplier.supplier.toString() === supplierId);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found for this product' });
        }

        // Update the restock date for this supplier
        supplier.restockDate = restockDate;
        await product.save();

        res.status(200).json({ message: 'Restock date updated successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get discounted price based on supplier data
exports.getDiscountedPrice = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate('suppliers.supplier');  // Populate suppliers

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Calculate discounted price from the supplier data
        if (product.suppliers.length > 0) {
            const totalDiscountedPrice = product.suppliers.reduce((sum, supplier) => {
                const supplierPrice = supplier.price || 0;
                const supplierDiscount = supplier.discount || 0;
                return sum + (supplierPrice - (supplierPrice * supplierDiscount / 100));
            }, 0);
            const discountedPrice = totalDiscountedPrice / product.suppliers.length;

            return res.status(200).json({ discountedPrice });
        } else {
            return res.status(200).json({ discountedPrice: product.defaultPrice }); // Fallback to default price
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Search products with advanced filtering, sorting, and pagination
exports.searchProducts = async (req, res) => {
    try {
        // Extract query parameters
        const {
            keyword,
            category,
            minPrice,
            maxPrice,
            brand,
            alcoholContent,
            inStock,
            isOnSale,
            isFeatured,
            isNewArrival,
            sortBy,
            sortOrder,
            page = 1,
            limit = 10
        } = req.query;

        // Build filter object
        const filter = {};

        // Keyword search across multiple fields
        if (keyword) {
            filter.$or = [
                { name: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } },
                { brand: { $regex: keyword, $options: 'i' } },
                { tags: { $regex: keyword, $options: 'i' } }
            ];
        }

        // Category filter
        if (category) {
            // Support for multiple categories
            if (Array.isArray(category)) {
                filter.category = { $in: category.map(c => ObjectId(c)) };
            } else {
                filter.category = ObjectId(category);
            }
        }

        // Price range filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            filter.defaultPrice = {};
            if (minPrice !== undefined) filter.defaultPrice.$gte = Number(minPrice);
            if (maxPrice !== undefined) filter.defaultPrice.$lte = Number(maxPrice);
        }

        // Brand filter
        if (brand) {
            // Support for multiple brands
            if (Array.isArray(brand)) {
                filter.brand = { $in: brand };
            } else {
                filter.brand = brand;
            }
        }

        // Alcohol content filter
        if (alcoholContent) {
            const [min, max] = alcoholContent.split('-').map(Number);
            filter.alcoholContent = { $gte: min, $lte: max };
        }

        // Stock status filter
        if (inStock === 'true') {
            filter.stockStatus = 'In Stock';
        } else if (inStock === 'false') {
            filter.stockStatus = { $ne: 'In Stock' };
        }

        // Boolean filters
        if (isOnSale) filter.isOnSale = isOnSale === 'true';
        if (isFeatured) filter.isFeatured = isFeatured === 'true';
        if (isNewArrival) filter.isNewArrival = isNewArrival === 'true';

        // Only include non-deleted products
        filter.deleted = false;

        // Build sort object
        const sort = {};
        if (sortBy) {
            // Default to ascending order
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            // Default sort by creation date (newest first)
            sort.createdAt = -1;
        }

        // Calculate pagination values
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Execute query with pagination
        const products = await Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name')
            .lean();

        // Get total count for pagination metadata
        const totalProducts = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limitNum);

        res.status(200).json({
            success: true,
            currentPage: pageNum,
            totalPages,
            totalProducts,
            resultsPerPage: limitNum,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? null : error.stack
        });
    }
};

// Get products by category with filtering and pagination
exports.getProductsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        // Validate category existence
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Calculate pagination values
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query
        const products = await Product.find({
            category: categoryId,
            deleted: false
        })
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .populate('category', 'name')
            .lean();

        // Get total count for pagination
        const totalProducts = await Product.countDocuments({
            category: categoryId,
            deleted: false
        });

        const totalPages = Math.ceil(totalProducts / limitNum);

        res.status(200).json({
            success: true,
            category: category.name,
            currentPage: pageNum,
            totalPages,
            totalProducts,
            resultsPerPage: limitNum,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? null : error.stack
        });
    }
};

// Get popular products based on order metrics
exports.getPopularProducts = async (req, res) => {
    try {
        const { limit = 8, days = 30 } = req.query;

        // Calculate date threshold for recent popularity (last X days)
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

        const popularProducts = await Order.aggregate([
            // Match orders from the specified period
            {
                $match: {
                    createdAt: { $gte: dateThreshold },
                    status: { $in: ['completed', 'delivered', 'pending'] } // we can remove `pending` later.
                }
            },

            // Unwind order items to process each product separately
            { $unwind: '$items' },

            // Group by product ID and sum quantities
            {
                $group: {
                    _id: '$items.product',
                    totalQuantity: { $sum: '$items.quantity' },
                    orderCount: { $sum: 1 }
                }
            },

            // Sort by total quantity sold (descending)
            { $sort: { totalQuantity: -1 } },

            // Limit results
            { $limit: parseInt(limit) },

            // Lookup product details
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },

            // Unwind product details
            { $unwind: '$productDetails' },

            // Filter out deleted products
            { $match: { 'productDetails.deleted': false } },

            // Project only necessary fields
            {
                $project: {
                    _id: '$productDetails._id',
                    name: '$productDetails.name',
                    image: '$productDetails.image',
                    defaultPrice: '$productDetails.defaultPrice',
                    brand: '$productDetails.brand',
                    category: '$productDetails.category',
                    isOnSale: '$productDetails.isOnSale',
                    defaultDiscount: '$productDetails.defaultDiscount',
                    totalQuantitySold: '$totalQuantity',
                    popularityScore: {
                        $add: [
                            { $multiply: ['$totalQuantity', 1] },  // Weight for quantity sold
                            { $multiply: ['$orderCount', 0.5] }    // Weight for order count
                        ]
                    }
                }
            },

            // Final sort by popularity score
            { $sort: { popularityScore: -1 } }
        ]);

        // Populate category information
        await Product.populate(popularProducts, { path: 'category', select: 'name' });

        res.status(200).json({
            success: true,
            timeFrame: `${days} days`,
            products: popularProducts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? null : error.stack
        });
    }
};

// Get top-rated products
exports.getTopRatedProducts = async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        // Find products with reviews, calculate average rating using aggregation
        const products = await Product.aggregate([
            // Match only non-deleted products with at least one review
            { $match: { deleted: false, 'reviews.0': { $exists: true } } },

            // Unwind reviews array to process each review
            { $unwind: '$reviews' },

            // Group back by product id and calculate average rating
            {
                $group: {
                    _id: '$_id',
                    name: { $first: '$name' },
                    image: { $first: '$image' },
                    defaultPrice: { $first: '$defaultPrice' },
                    brand: { $first: '$brand' },
                    category: { $first: '$category' },
                    isOnSale: { $first: '$isOnSale' },
                    defaultDiscount: { $first: '$defaultDiscount' },
                    averageRating: { $avg: '$reviews.rating' },
                    reviewCount: { $sum: 1 }
                }
            },

            // Sort by average rating (descending)
            { $sort: { averageRating: -1 } },

            // Limit results
            { $limit: parseInt(limit, 10) }
        ]);

        // Populate category information
        await Product.populate(products, { path: 'category', select: 'name' });

        res.status(200).json({
            success: true,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get recently added products
exports.getNewArrivals = async (req, res) => {
    try {
        const { limit = 8 } = req.query;

        const products = await Product.find({
            deleted: false,
            isNewArrival: true
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10))
            .populate('category', 'name')
            .lean();

        res.status(200).json({
            success: true,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get products on sale
exports.getProductsOnSale = async (req, res) => {
    try {
        const { limit = 8 } = req.query;

        const products = await Product.find({
            deleted: false,
            isOnSale: true,
            defaultDiscount: { $gt: 0 }
        })
            .sort({ defaultDiscount: -1 })
            .limit(parseInt(limit, 10))
            .populate('category', 'name')
            .lean();

        res.status(200).json({
            success: true,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get related products
exports.getRelatedProducts = async (req, res) => {
    try {
        const { productId } = req.params;
        const { limit = 4 } = req.query;

        // Find the product and its related products
        const product = await Product.findById(productId)
            .select('relatedProducts category brand tags alcoholContent')
            .populate({
                path: 'relatedProducts.product',
                select: 'name image defaultPrice brand isOnSale defaultDiscount'
            });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Extract related products 
        let relatedProducts = product.relatedProducts.map(rp => rp.product);

        // If not enough related products are explicitly defined,
        // find similar products based on category, brand, etc.
        if (relatedProducts.length < parseInt(limit, 10)) {
            const additionalProducts = await Product.find({
                _id: { $ne: productId },
                deleted: false,
                $or: [
                    { category: product.category },
                    { brand: product.brand },
                    { tags: { $in: product.tags } },
                    {
                        alcoholContent: {
                            $gte: product.alcoholContent - 5,
                            $lte: product.alcoholContent + 5
                        }
                    }
                ]
            })
                .limit(parseInt(limit, 10) - relatedProducts.length)
                .select('name image defaultPrice brand isOnSale defaultDiscount')
                .lean();

            // Combine explicit related products with additional similar products
            relatedProducts = [...relatedProducts, ...additionalProducts];
        }

        res.status(200).json({
            success: true,
            relatedProducts: relatedProducts.slice(0, parseInt(limit, 10))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}; 