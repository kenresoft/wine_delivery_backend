const mongoose = require('mongoose');
const path = require('path');
const Product = require('../models/Product');
const Category = require('../models/Category');
const upload = require('../middleware/upload'); // Assuming you have upload middleware
const {
    calculateRelatedProducts,
    getProductDetails,
    deleteOldFile,
} = require('../utils/product');

// Create a new product with image upload
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


// Fetch product details with default and supplier-specific prices, quantity, discount, and related products
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

            if (product.images.length > 0) {
                product.image = product.images[0];
            } else {
                product.image = null;
            }
        }

        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};


// Get multiple products by their IDs with default and supplier-specific values
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

            if (product.images.length > 0) {
                product.image = product.images[0];
            } else {
                product.image = null;
            }

            // Add `isFavorited` property
            product.isFavorited = favoriteProductIds.has(product._id.toString());
        };

        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get a single product by ID with default and supplier-specific values
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

        if (product.images.length > 0) {
            product.image = product.images[0];
        } else {
            product.image = null;
        }

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

// Update a product by ID
/* exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Update suppliers and recalculate price, quantity, and discount if suppliers are updated
        if (updatedData.suppliers) {
            const { suppliers } = updatedData;
            product.defaultPrice = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / suppliers.length : 0;
            product.defaultQuantity = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + supplier.quantity, 0) : 0;
            product.defaultDiscount = suppliers.length > 0 ? suppliers.reduce((sum, supplier) => sum + (supplier.discount || 0), 0) / suppliers.length : 0;
        }

        Object.assign(product, updatedData);
        await product.save();

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; */

// Update an existing product with optional image upload
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


// Delete a product by ID
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

// Add a review to a product
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

// Update stock status
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

// Update product variants
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

// Update product tags
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

// Update product dimensions
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

/// NEW
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
