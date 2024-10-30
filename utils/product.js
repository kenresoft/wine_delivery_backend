const fs = require('fs');
const Product = require('../models/Product');

const getProductDetails = (product) => {
    // Fix New Arrival Logic
    const THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    product.isNewArrival = product.createdAt && (Date.now() - new Date(product.createdAt).getTime()) <= THRESHOLD;

    // Fix Stock Status
    const stockThreshold = 6; // Threshold for stock to be considered "In Stock"

    // Default to "Out of Stock"
    product.stockStatus = 'Out of Stock';

    // If default quantity is greater than stock threshold, mark as "In Stock"
    if (product.defaultQuantity > stockThreshold) {
        product.stockStatus = 'In Stock';
    }
    // If quantity is more than 0 but less than or equal to threshold, mark as "Low Stock"
    else if (product.defaultQuantity > 0 && product.defaultQuantity <= stockThreshold) {
        product.stockStatus = 'Low Stock';
    }
    // If no stock, check for the earliest restock date from suppliers
    else if (product.suppliers.length > 0) {
        const validRestockDates = product.suppliers
            .filter(supplier => supplier.restockDate) // Ensure restock date is valid
            .map(supplier => new Date(supplier.restockDate).getTime());

        if (validRestockDates.length > 0) {
            const earliestRestockDate = new Date(Math.min(...validRestockDates));
            product.stockStatus = 'Coming Soon';
        }
    }

    // Fix UpdatedAt timestamp if changes are made
    // product.updatedAt = new Date();

    return product;
};

const calculateRelatedProducts = async (product) => {
    try {
        const queryConditions = [];

        // Helper function to check if a field exists, is valid, and is not zero
        const isValid = (field) => field !== null && field !== undefined && field !== 0;

        // Add query conditions for fields that are valid and not zero
        if (isValid(product.tags) && Array.isArray(product.tags) && product.tags.length > 0) {
            queryConditions.push({ tags: { $in: product.tags } });
        }

        if (isValid(product.brand)) {
            queryConditions.push({ brand: product.brand });
        }

        if (isValid(product.dimensions?.length) && isValid(product.dimensions.width) && isValid(product.dimensions.height)) {
            queryConditions.push({
                "dimensions.length": product.dimensions.length,
                "dimensions.width": product.dimensions.width,
                "dimensions.height": product.dimensions.height
            });
        }

        if (isValid(product.weight)) {
            queryConditions.push({ weight: product.weight });
        }

        if (isValid(product.suppliers) && Array.isArray(product.suppliers) && product.suppliers.length > 0) {
            const supplierIds = product.suppliers.map(supplier => supplier._id);
            queryConditions.push({ 'suppliers._id': { $in: supplierIds } });
        }

        // If no query conditions are available, return an empty array
        if (!queryConditions.length) {
            return [];
        }

        // Find related products using the query conditions
        const relatedProducts = await Product.find({
            $or: queryConditions,
            _id: { $ne: product._id } // Exclude the original product from results
        }).limit(5).exec();

        // Map related products and determine matched fields
        return relatedProducts.map(relatedProduct => {
            const matchedFields = [];

            if (isValid(product.tags) && isValid(relatedProduct.tags) && relatedProduct.tags.some(tag => product.tags.includes(tag))) {
                matchedFields.push('tags');
            }
            if (isValid(product.brand) && product.brand === relatedProduct.brand) {
                matchedFields.push('brand');
            }
            if (isValid(product.dimensions) && isValid(relatedProduct.dimensions) &&
                isValid(product.dimensions.length) && isValid(relatedProduct.dimensions.length) &&
                isValid(product.dimensions.width) && isValid(relatedProduct.dimensions.width) &&
                isValid(product.dimensions.height) && isValid(relatedProduct.dimensions.height)
            ) {
                matchedFields.push('dimensions');
            }
            if (isValid(product.weight) && product.weight === relatedProduct.weight) {
                matchedFields.push('weight');
            }
            if (isValid(product.suppliers) && isValid(relatedProduct.suppliers) &&
                product.suppliers.some(supplier =>
                    relatedProduct.suppliers.some(rSupplier => rSupplier._id.equals(supplier._id))
                )
            ) {
                matchedFields.push('suppliers');
            }

            // Determine relationship type based on matched fields
            let relationshipType = "none";  // Default to none
            const matchCount = matchedFields.length;

            if (matchCount === 0) {
                relationshipType = "none"; // No matches
            } else if (matchCount >= 4) {
                relationshipType = "exact"; // All relevant fields match
            } else if (matchCount >= 2) {
                relationshipType = "similar"; // Some fields match
            } else if (matchCount === 1) {
                relationshipType = "related"; // At least one field matches
            }

            return {
                product: relatedProduct._id,
                matchedFields,
                relationshipType,  // Enhanced relationship type logic
                priority: matchCount // More matched fields indicate higher priority
            };
        });

    } catch (error) {
        console.error("Error calculating related products: ", error);
        return [];
    }
};

// Helper to delete old files
const deleteOldFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                console.log('Old file deleted:', filePath);
            }
        });
    }
};

module.exports = { calculateRelatedProducts, getProductDetails, deleteOldFile };
