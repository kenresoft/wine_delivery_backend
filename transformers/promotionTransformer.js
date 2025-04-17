/**
 * @file promotionTransformer.js
 * Transformation layer for promotion API responses
 */

/**
 * Transforms promotion data based on user role and request context
 * Implements strategic field selection to optimize response payload
 * 
 * @param {Object} promotion - Raw promotion document or object
 * @param {Object} options - Transformation options
 * @param {Boolean} options.isAdmin - Whether request is from admin
 * @param {Boolean} options.includeProducts - Whether to include product data
 * @param {Boolean} options.isEligible - User eligibility status
 * @param {Array} options.promotionProducts - Enhanced product data
 * @returns {Object} Optimized promotion response
 */
exports.transformPromotion = (promotion, options = {}) => {
    const {
        isAdmin = false,
        includeProducts = false,
        isEligible = true,
        promotionProducts = []
    } = options;

    // Convert mongoose document to plain object if needed
    const promotionData = promotion.toObject ? promotion.toObject() : { ...promotion };

    // Base fields for all users
    const baseFields = {
        id: promotionData._id,
        title: promotionData.title,
        description: promotionData.description,
        code: promotionData.code,
        discountType: promotionData.discountType,
        discountValue: promotionData.discountValue,
        startDate: promotionData.startDate,
        endDate: promotionData.endDate,
        status: promotionData.status,
        minimumPurchase: promotionData.minimumPurchase,
        maximumDiscount: promotionData.maximumDiscount,
        isFirstPurchaseOnly: promotionData.isFirstPurchaseOnly,
        stackable: promotionData.stackable,
        priority: promotionData.priority,
        isEligible,
    };

    // Admin-only fields for enhanced control and visibility
    const adminFields = isAdmin ? {
        createdAt: promotionData.createdAt,
        updatedAt: promotionData.updatedAt,
        currentUsageCount: promotionData.currentUsageCount,
        totalUsageLimit: promotionData.totalUsageLimit,
        usageLimitPerUser: promotionData.usageLimitPerUser,
        isVisible: promotionData.isVisible,
        locations: promotionData.locations,
        applicableProducts: promotionData.applicableProducts,
        applicableCategories: promotionData.applicableCategories,
        includedUsers: promotionData.includedUsers,
        excludedUsers: promotionData.excludedUsers,
    } : {};

    // Build response object with conditional sections
    const response = {
        promotion: {
            ...baseFields,
            ...adminFields,
        }
    };

    // Add transformed product data if requested
    if (includeProducts && promotionProducts.length > 0) {
        response.promotionProducts = promotionProducts.map(item => ({
            productId: item.product._id,
            name: item.product.name,
            description: item.product.description,
            category: item.product.category,
            stockStatus: item.product.stockStatus,
            imageUrl: item.product.images?.[0]?.url || null,
            pricing: {
                originalPrice: item.originalPrice,
                discountedPrice: item.discountedPrice,
                discountAmount: item.discountAmount,
                discountPercentage: item.discountPercentage
            }
        }));
    }

    return response;
};

/**
 * Transforms a collection of promotions
 * 
 * @param {Array} promotions - Array of promotion objects/documents
 * @param {Object} options - Transformation options
 * @returns {Array} Transformed promotion collection
 */
exports.transformPromotionCollection = (promotions, options = {}) => {
    return promotions.map(promo => {
        // Extract product data if available in enhanced structure
        const promotionProducts = promo.promotionProducts || [];

        // Handle different input formats (raw mongoose vs enhanced)
        const promotionData = promo.promotion || promo;
        const isEligible = promo.isEligible !== undefined ? promo.isEligible : options.isEligible;

        return this.transformPromotion(promotionData, {
            ...options,
            isEligible,
            promotionProducts
        });
    });
};

/**
 * Generates pagination metadata for collection responses
 * 
 * @param {Number} total - Total items in collection
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
exports.createPaginationMetadata = (total, page, limit) => ({
    totalItems: total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page, 10),
    itemsPerPage: parseInt(limit, 10)
});
