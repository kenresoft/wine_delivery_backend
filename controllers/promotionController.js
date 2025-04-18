const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const Promotion = require('../models/Promotion');
const Product = require('../models/Product');
const User = require('../models/User');
const { performance } = require('perf_hooks');
const promotionTransformer = require('../transformers/promotionTransformer');

/**
 * Constructs optimal query conditions for fetching relevant products
 * @param {Object} promotion - The promotion document
 * @returns {Object} MongoDB query object
 */
const buildProductQuery = (promotion) => {
    const query = { defaultQuantity: { $gt: 0 } };
    const conditions = [];

    if (promotion.applicableProducts?.length > 0) {
        conditions.push({ _id: { $in: promotion.applicableProducts } });
    }

    if (promotion.applicableCategories?.length > 0) {
        conditions.push({ category: { $in: promotion.applicableCategories } });
    }

    if (conditions.length > 0) {
        query.$or = conditions;
    }

    return query;
};

/**
 * Creates response data for promotion with optional product data
 * @private
 */
const enhancePromotionWithProducts = async (promotion, user = null) => {
    const startTime = performance.now();

    // Check eligibility
    const isEligible = user ? await promotion.checkEligibility(user) : true;

    const query = buildProductQuery(promotion);

    // Fetch relevant products
    const products = await Product.find(query)
        .select('name description category defaultPrice defaultQuantity stockStatus image')
        .lean();

    // Transform products with discount info
    const promotionProducts = products.map(product => {
        const originalPrice = product.defaultPrice;
        const discountedPrice = promotion.calculateDiscountedPrice(originalPrice);
        const discountAmount = parseFloat((originalPrice - discountedPrice).toFixed(2));

        return {
            product,
            originalPrice,
            discountedPrice,
            discountAmount,
            discountPercentage: parseFloat(((discountAmount / originalPrice) * 100).toFixed(2)),
        };
    });

    const duration = performance.now() - startTime;
    logger.debug(`Product enhancement completed in ${duration.toFixed(2)}ms for ${promotion.code}`);

    return { promotion, promotionProducts, isEligible };
};

/**
 * @desc    Create new promotion
 * @route   POST /api/promotions
 * @access  Private/Admin
 */
exports.createPromotion = asyncHandler(async (req, res) => {
    const { body } = req;

    const promotionData = {
        ...body,
        code: body.code || Promotion.generatePromoCode()
    };

    const promotion = await Promotion.create(promotionData);

    logger.info(`Promotion created: ${promotion.code} (ID: ${promotion._id})`);

    const transformedPromotion = promotionTransformer.transformPromotion(promotion, {
        isAdmin: true
    });

    res.status(201).json({
        success: true,
        data: transformedPromotion
    });
});

/**
 * @desc    Update promotion
 * @route   PUT /api/promotions/:id
 * @access  Private/Admin
 */
exports.updatePromotion = asyncHandler(async (req, res, next) => {
    const { params: { id: promotionId }, body: { code } } = req;
    const promotion = await Promotion.findById(promotionId);

    if (!promotion) {
        logger.warn(`Promotion not found for update: ${promotionId}`);
        return next(new AppError(`Promotion not found with ID: ${promotionId}`, 404, { code: 'PROMO_NOT_FOUND' }));
    }

    if (code && promotion.code !== code && promotion.currentUsageCount > 0) {
        logger.warn(`Code modification attempted: ${promotion.code} -> ${code}`);
        return next(new AppError('Promotion code cannot be modified once used', 400, { code: 'IMMUTABLE_CODE' }));
    }

    const updatedPromotion = await Promotion.findByIdAndUpdate(
        promotionId,
        req.body,
        { new: true, runValidators: true }
    );

    logger.info(`Updated promotion: ${updatedPromotion.code} (ID: ${updatedPromotion._id})`);

    const transformedPromotion = promotionTransformer.transformPromotion(updatedPromotion, {
        isAdmin: true
    });

    res.status(200).json({
        success: true,
        data: transformedPromotion
    });
});

/**
 * @desc    Delete promotion
 * @route   DELETE /api/promotions/:id
 * @access  Private/Admin
 */
exports.deletePromotion = asyncHandler(async (req, res, next) => {
    const { params: { id: promotionId } } = req;
    const promotion = await Promotion.findById(promotionId);

    if (!promotion) {
        logger.warn(`Promotion not found for deletion: ${promotionId}`);
        return next(new AppError(`Promotion not found with ID: ${promotionId}`, 404, { code: 'PROMO_NOT_FOUND' }));
    }

    if (promotion.currentUsageCount > 0) {
        logger.warn(`Attempted deletion of used promotion: ${promotion.code}`);
        return next(new AppError('Cannot delete promotion that has been used. Consider deactivating instead.', 400, { code: 'PROMOTION_IN_USE' }));
    }

    await promotion.deleteOne();
    logger.info(`Deleted promotion: ${promotion.code} (ID: ${promotion._id})`);
    res.status(200).json({ success: true, data: {} });
});

/**
 * @desc    Get all promotions with filtering
 * @route   GET /api/promotions
 * @access  Public/Admin
 */
exports.getAllPromotions = asyncHandler(async (req, res) => {
    const startTime = performance.now();
    const user = req.user ? await User.findById(req.user.id) : null;
    const {
        query: {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = -1,
            includeProducts = 'false',
            ...filterParams
        },
        isAdmin
    } = req;

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const sortOptions = { [sortBy]: parseInt(sortOrder, 10) };
    const options = {
        skip: (parsedPage - 1) * parsedLimit,
        limit: parsedLimit,
        sort: sortOptions
    };

    const [promotions, total] = await Promise.all([
        Promotion.find(Promotion.buildFilters(filterParams, isAdmin), null, options),
        Promotion.countDocuments(Promotion.buildFilters(filterParams, isAdmin)),
    ]);

    // Process promotions based on user context
    const includeProductsFlag = includeProducts.toLowerCase() === 'true';
    const enhancedPromotions = includeProductsFlag
        ? await Promise.all(promotions.map(p => enhancePromotionWithProducts(p, user)))
        : await Promise.all(promotions.map(async p => {
            const isEligible = user ? await p.checkEligibility(user) : true;
            return { promotion: p, isEligible };
        }));

    // Transform using our new transformer
    const transformedPromotions = promotionTransformer.transformPromotionCollection(
        enhancedPromotions,
        {
            isAdmin,
            includeProducts: includeProductsFlag
        }
    );

    const duration = performance.now() - startTime;
    logger.info(`Fetched ${promotions.length} promotions in ${duration.toFixed(2)}ms`);

    res.status(200).json({
        success: true,
        count: transformedPromotions.length,
        pagination: promotionTransformer.createPaginationMetadata(total, parsedPage, parsedLimit),
        data: transformedPromotions,
        performance: { executionTime: `${duration.toFixed(2)}ms` },
    });
});

/**
 * @desc    Get single promotion by ID
 * @route   GET /api/promotions/:id
 * @access  Public/Admin
 */
exports.getPromotion = asyncHandler(async (req, res, next) => {
    const startTime = performance.now();
    const { id: promotionId } = req.params;
    const user = req.user ? await User.findById(req.user.id) : null;
    const isAdmin = req.isAdmin;

    if (!promotionId) {
        return next(new AppError('Promotion ID is required', 400, { code: 'MISSING_PROMO_ID' }));
    }

    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
        return next(new AppError(`Promotion not found with ID: ${promotionId}`, 404, { code: 'PROMO_NOT_FOUND' }));
    }

    const includeProducts = req.query.includeProducts?.toLowerCase() === 'true';

    // Enhance promotion with products if needed
    const enhancedPromotion = includeProducts
        ? await enhancePromotionWithProducts(promotion, user)
        : {
            promotion,
            isEligible: user ? await promotion.checkEligibility(user) : true,
            promotionProducts: []
        };

    // Transform the response
    const transformedPromotion = promotionTransformer.transformPromotion(
        enhancedPromotion.promotion,
        {
            isAdmin,
            includeProducts,
            isEligible: enhancedPromotion.isEligible,
            promotionProducts: enhancedPromotion.promotionProducts
        }
    );

    const duration = performance.now() - startTime;
    logger.info(`Fetched promotion: ${promotion.code} in ${duration.toFixed(2)}ms`);

    res.status(200).json({
        success: true,
        data: transformedPromotion,
        performance: { duration: `${duration.toFixed(2)}ms` }
    });
});

//  Get promotion usage statistics
exports.getPromotionStats = asyncHandler(async (req, res, next) => {
    if (!req.isAdmin) {
        return next(
            new AppError("Unauthorized access to analytics", 403, {
                code: "UNAUTHORIZED",
            })
        );
    }

    const { promotionId } = req.params;
    const { startDate, endDate } = req.query;

    const matchCriteria = {};
    if (promotionId) {
        matchCriteria._id = mongoose.Types.ObjectId(promotionId);
    }

    if (startDate && endDate) {
        matchCriteria.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const stats = await Promotion.aggregate([
        { $match: matchCriteria },
        {
            $lookup: {
                from: 'orders',
                let: { promoCode: '$code' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: [
                                    '$$promoCode',
                                    {
                                        $map: {
                                            input: { $ifNull: ['$appliedPromotions', []] },
                                            in: '$$this.code'
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ],
                as: 'orders'
            }
        },
        {
            $project: {
                code: 1,
                title: 1,
                discountType: 1,
                discountValue: 1,
                startDate: 1,
                endDate: 1,
                currentUsageCount: 1,
                totalUsageLimit: 1,
                status: {
                    $cond: [
                        { $gt: [new Date(), '$endDate'] },
                        'expired',
                        {
                            $cond: [
                                { $lt: [new Date(), '$startDate'] },
                                'scheduled',
                                {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$totalUsageLimit', null] },
                                                { $gte: ['$currentUsageCount', '$totalUsageLimit'] }
                                            ]
                                        },
                                        'limit_reached',
                                        'active'
                                    ]
                                }
                            ]
                        }
                    ]
                },
                totalRevenue: {
                    $sum: '$orders.total'
                },
                orderCount: {
                    $size: '$orders'
                },
                averageOrderValue: {
                    $cond: [
                        { $eq: [{ $size: '$orders' }, 0] },
                        0,
                        { $divide: [{ $sum: '$orders.total' }, { $size: '$orders' }] }
                    ]
                },
                totalDiscountAmount: {
                    $sum: {
                        $map: {
                            input: '$orders',
                            as: 'order',
                            in: {
                                $reduce: {
                                    input: {
                                        $filter: {
                                            input: '$$order.appliedPromotions',
                                            as: 'promo',
                                            cond: { $eq: ['$$promo.code', '$code'] }
                                        }
                                    },
                                    initialValue: 0,
                                    in: { $add: ['$$value', '$$this.discountAmount'] }
                                }
                            }
                        }
                    }
                },
                usagePercent: {
                    $cond: [
                        { $eq: ['$totalUsageLimit', null] },
                        null,
                        {
                            $multiply: [
                                { $divide: ['$currentUsageCount', '$totalUsageLimit'] },
                                100
                            ]
                        }
                    ]
                },
                remainingUsages: {
                    $cond: [
                        { $eq: ['$totalUsageLimit', null] },
                        null,
                        { $subtract: ['$totalUsageLimit', '$currentUsageCount'] }
                    ]
                }
            }
        }
    ]);

    logger.info(`Generated statistics for ${stats.length} promotions`);
    res.status(200).json({
        success: true,
        count: stats.length,
        data: stats,
    });
});