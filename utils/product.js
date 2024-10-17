const Product = require('../models/Product');

const calculateRelatedProducts = async (product) => {
    try {
        const queryConditions = [];
        const matchedFieldsMap = {};

        // Add condition for tags if present
        if (product.tags && product.tags.length > 0) {
            queryConditions.push({ tags: { $in: product.tags } });
            matchedFieldsMap['tags'] = true;
        }

        // Add condition for brand if present
        if (product.brand) {
            queryConditions.push({ brand: product.brand });
            matchedFieldsMap['brand'] = true;
        }

        // Add condition for dimensions if present
        if (product.dimensions) {
            queryConditions.push({ dimensions: { $elemMatch: { $eq: product.dimensions } } });
            matchedFieldsMap['dimensions'] = true;
        }

        // Add condition for weight if present
        if (product.weight) {
            queryConditions.push({ weight: { $eq: product.weight } });
            matchedFieldsMap['weight'] = true;
        }

        // Add condition for suppliers if present
        if (product.suppliers && product.suppliers.length > 0) {
            queryConditions.push({ suppliers: { $in: product.suppliers } });
            matchedFieldsMap['suppliers'] = true;
        }

        // If no query conditions are available, return an empty array
        if (queryConditions.length === 0) {
            return [];
        }

        // Perform the query using $or to match any of the conditions
        const relatedProducts = await Product.find({
            $or: queryConditions,
            _id: { $ne: product._id }  // Exclude the current product
        }).limit(5).exec();

        // Add matched fields information for each related product
        const resultsWithMatchedFields = relatedProducts.map(relatedProduct => {
            let matchedFields = [];

            // Check which fields matched
            if (product.tags && relatedProduct.tags && relatedProduct.tags.some(tag => product.tags.includes(tag))) {
                matchedFields.push('tags');
            }
            if (product.brand && relatedProduct.brand === product.brand) {
                matchedFields.push('brand');
            }
            if (product.dimensions && JSON.stringify(relatedProduct.dimensions) === JSON.stringify(product.dimensions)) {
                matchedFields.push('dimensions');
            }
            if (product.weight && relatedProduct.weight === product.weight) {
                matchedFields.push('weight');
            }
            if (product.suppliers && product.suppliers.some(supplier => relatedProduct.suppliers.includes(supplier))) {
                matchedFields.push('suppliers');
            }

            // Return product with matched fields
            return {
                productId: relatedProduct._id,
                matchedFields: matchedFields,               
            };
        });

        return resultsWithMatchedFields;

    } catch (error) {
        console.error("Error calculating related products: ", error);
        return [];
    }
};

exports.calculateRelatedProducts = calculateRelatedProducts;
