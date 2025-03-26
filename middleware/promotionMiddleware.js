const Promotion = require('../models/Promotion');
const Order = require('../models/Order');

exports.validatePromotionMiddleware = async (req, res, next) => {
    try {
        const { promotionCode, cartItems } = req.body;

        // Skip validation if no promotion code provided
        if (!promotionCode) {
            return next();
        }

        // Calculate cart total
        const cartTotal = cartItems.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        // Find promotion
        const promotion = await Promotion.findOne({
            code: promotionCode.toUpperCase(),
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        if (!promotion) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired promotion code'
            });
        }

        // Perform all validation checks
        // 1. Check usage limits
        if (promotion.totalUsageLimit !== null &&
            promotion.currentUsageCount >= promotion.totalUsageLimit) {
            return res.status(400).json({
                success: false,
                message: 'This promotion has reached its usage limit'
            });
        }

        // 2. Check minimum purchase amount
        if (cartTotal < promotion.minimumPurchase) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase amount of $${promotion.minimumPurchase} required`,
                minimumPurchase: promotion.minimumPurchase
            });
        }

        // 3. Check first purchase requirement
        if (promotion.isFirstPurchaseOnly && req.user) {
            const previousOrders = await Order.countDocuments({
                user: req.user._id,
                status: { $in: ['completed', 'delivered'] }
            });

            if (previousOrders > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'This promotion is valid for first-time customers only'
                });
            }
        }

        // 4. Check per-user usage limit
        if (promotion.usageLimitPerUser !== null && req.user) {
            const userUsageCount = await Order.countDocuments({
                user: req.user._id,
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
        } else if (promotion.discountType === 'freeShipping') {
            // Free shipping logic would be handled in order creation
            discountAmount = 0;
        }

        // Attach validated promotion to request
        req.validatedPromotion = {
            id: promotion._id,
            code: promotion.code,
            title: promotion.title,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            discountAmount,
            freeShipping: promotion.discountType === 'freeShipping'
        };

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
