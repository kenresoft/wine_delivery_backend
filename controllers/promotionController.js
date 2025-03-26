const Promotion = require('../models/Promotion');
const User = require('../models/User');
const Order = require('../models/Order');

// Create a new promotion
exports.createPromotion = async (req, res) => {
    try {
        const promotion = await Promotion.create(req.body);

        res.status(201).json({
            success: true,
            promotion
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Get all promotions with filtering
exports.getAllPromotions = async (req, res) => {
    try {
        const { active, firstPurchaseOnly } = req.query;

        const filter = {};

        // Filter by active status
        if (active === 'true') {
            const now = new Date();
            filter.startDate = { $lte: now };
            filter.endDate = { $gte: now };
            filter.isActive = true;
        }

        // Filter by first purchase promotions
        if (firstPurchaseOnly === 'true') {
            filter.isFirstPurchaseOnly = true;
        }

        const promotions = await Promotion.find(filter);

        res.status(200).json({
            success: true,
            count: promotions.length,
            promotions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get promotion by ID
exports.getPromotionById = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id);

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found'
            });
        }

        res.status(200).json({
            success: true,
            promotion
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update promotion
exports.updatePromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found'
            });
        }

        res.status(200).json({
            success: true,
            promotion
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete promotion
exports.deletePromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id);

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found'
            });
        }

        await promotion.remove();

        res.status(200).json({
            success: true,
            message: 'Promotion deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Validate promotion code
exports.validatePromotionCode = async (req, res) => {
    try {
        const { code, userId, cartTotal } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Promotion code is required'
            });
        }

        // Find the promotion by code
        const promotion = await Promotion.findOne({
            code: code.toUpperCase(),
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired promotion code'
            });
        }

        // Check if promotion has reached usage limit
        if (promotion.totalUsageLimit !== null &&
            promotion.currentUsageCount >= promotion.totalUsageLimit) {
            return res.status(400).json({
                success: false,
                message: 'This promotion has reached its usage limit'
            });
        }

        // Validate minimum purchase requirement
        if (cartTotal < promotion.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase amount of $${promotion.minimumPurchase} required`,
                minimumPurchase: promotion.minimumPurchase
            });
        }

        // Check if first purchase only
        if (promotion.isFirstPurchaseOnly && userId) {
            const previousOrders = await Order.countDocuments({
                user: userId,
                status: { $in: ['completed', 'delivered'] }
            });

            if (previousOrders > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This promotion is valid for first-time customers only'
                });
            }
        }

        // Check user-specific usage limit
        if (promotion.usageLimitPerUser !== null && userId) {
            const userUsageCount = await Order.countDocuments({
                user: userId,
                'appliedPromotion.id': promotion._id
            });

            if (userUsageCount >= promotion.usageLimitPerUser) {
                return res.status(400).json({
                    success: false,
                    message: `You've reached the maximum usage limit for this promotion`
                });
            }
        }

        // Calculate discount amount
        let discountAmount = 0;

        if (promotion.discountType === 'percentage') {
            discountAmount = (cartTotal * promotion.discountValue) / 100;

            // Apply maximum discount cap if applicable
            if (promotion.maximumDiscount !== null &&
                discountAmount > promotion.maximumDiscount) {
                discountAmount = promotion.maximumDiscount;
            }
        } else if (promotion.discountType === 'fixed') {
            discountAmount = promotion.discountValue;
        }

        res.status(200).json({
            success: true,
            promotion: {
                _id: promotion._id,
                code: promotion.code,
                title: promotion.title,
                discountType: promotion.discountType,
                discountValue: promotion.discountValue
            },
            discountAmount,
            finalAmount: cartTotal - discountAmount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};