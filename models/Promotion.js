const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ======================
// PROMOTION SCHEMA
// ======================
const promotionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Promotion title is required'],
            trim: true,
            maxlength: [100, 'Title cannot exceed 100 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        code: {
            type: String,
            uppercase: true,
            trim: true,
            validate: {
                validator: function (v) {
                    return v === null || /^[A-Z0-9]{4,20}$/.test(v);
                },
                message: 'Promo code must be 4-20 alphanumeric characters'
            }
        },
        discountType: {
            type: String,
            required: true,
            enum: {
                values: ['percentage', 'fixed', 'freeShipping'],
                message: 'Invalid discount type'
            }
        },
        discountValue: {
            type: Number,
            required: [true, 'Discount value is required'],
            min: [0, 'Discount cannot be negative'],
            validate: {
                validator: function (v) {
                    if (this.discountType === 'percentage') return v <= 100;
                    return true;
                },
                message: 'Percentage discount cannot exceed 100%'
            }
        },
        startDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: [true, 'End date is required'],
            validate: {
                validator: function (v) {
                    return v > this.startDate;
                },
                message: 'End date must be after start date'
            }
        },
        minimumPurchase: {
            type: Number,
            min: [0, 'Minimum purchase cannot be negative'],
            default: 0
        },
        maximumDiscount: {
            type: Number,
            min: [0, 'Maximum discount cannot be negative'],
            default: null
        },
        applicableProducts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        }],
        applicableCategories: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        }],
        isFirstPurchaseOnly: {
            type: Boolean,
            default: false
        },
        usageLimitPerUser: {
            type: Number,
            min: [1, 'Usage limit must be at least 1'],
            default: 1
        },
        totalUsageLimit: {
            type: Number,
            min: [1, 'Total usage limit must be at least 1'],
            default: null
        },
        currentUsageCount: {
            type: Number,
            min: [0, 'Usage count cannot be negative'],
            default: 0
        },
        isVisible: {
            type: Boolean,
            default: true
        },
        locations: {
            type: [String],
            default: [],
            set: function (arr) {
                return arr.map(loc => loc.toLowerCase().trim());
            }
        },
        includedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        excludedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        priority: {
            type: Number,
            default: 1,
            min: [1, 'Priority must be at least 1'],
            max: [100, 'Priority cannot exceed 100']
        },
        stackable: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// ======================
// INDEXES
// ======================
promotionSchema.index({ code: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });
promotionSchema.index({ applicableProducts: 1 });
promotionSchema.index({ applicableCategories: 1 });
promotionSchema.index({ isVisible: 1 });
promotionSchema.index({ isFirstPurchaseOnly: 1 });
promotionSchema.index({ locations: 1 });

// ======================
// VIRTUAL PROPERTIES
// ======================
promotionSchema.virtual('status').get(function () {
    const now = new Date();
    if (now < this.startDate) return 'scheduled';
    if (now > this.endDate) return 'expired';
    if (this.totalUsageLimit && this.currentUsageCount >= this.totalUsageLimit) return 'limit_reached';
    return 'active';
});

// ======================
// STATIC METHODS
// ======================
promotionSchema.statics.findActivePromotions = function (additionalFilters = {}) {
    const now = new Date();
    return this.find({
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { totalUsageLimit: null },
            { $expr: { $lt: ['$currentUsageCount', '$totalUsageLimit'] } }
        ],
        ...additionalFilters
    });
};

promotionSchema.statics.findEligiblePromotions = async function (userId, productIds = [], categoryIds = []) {
    const User = mongoose.model('User'); // Corrected: Moved inside the static method to avoid issues with model loading order.
    const now = new Date();

    const user = await User.findById(userId).select('location orders');

    const promotions = await this.find({
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { applicableProducts: { $in: productIds } },
            { applicableCategories: { $in: categoryIds } },
            {
                $and: [
                    { applicableProducts: { $size: 0 } },
                    { applicableCategories: { $size: 0 } }
                ]
            }
        ],
        $or: [
            { isVisible: true },
            {
                isVisible: false,
                $or: [
                    { includedUsers: user._id },
                    {
                        $and: [
                            { includedUsers: { $size: 0 } },
                            { excludedUsers: { $ne: user._id } }
                        ]
                    }
                ]
            }
        ]
    });

    return promotions.filter(p => p.status === 'active');
};

promotionSchema.statics.findByCode = function (code) {
    return this.findOne({
        code: code.toUpperCase(),
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    }).then(promo => promo?.status === 'active' ? promo : null);
};

promotionSchema.statics.validateProductAndCategoryIds = async function (productIds = [], categoryIds = []) {
    const [Product, Category] = ['Product', 'Category'].map(m => mongoose.model(m));
    
    const [validProductIds, validCategoryIds] = await Promise.all([
        productIds.length ? Product.find({ _id: { $in: productIds } }).distinct('_id') : [],
        categoryIds.length ? Category.find({ _id: { $in: categoryIds } }).distinct('_id') : []
    ]);
    
    return { validProductIds, validCategoryIds };
};

promotionSchema.statics.buildFilters = function (queryParams, isAdmin) {
    const { status, discountType, search } = queryParams;
    const filter = {};

    if (status) {
        const now = new Date();
        switch (status) {
            case 'active':
                filter.startDate = { $lte: now };
                filter.endDate = { $gte: now };
                filter.$or = [{ totalUsageLimit: null }, { $expr: { $lt: ['$currentUsageCount', '$totalUsageLimit'] } }];
                break;
            case 'expired': filter.endDate = { $lt: now }; break;
            case 'scheduled': filter.startDate = { $gt: now }; break;
            case 'limit_reached':
                filter.totalUsageLimit = { $ne: null };
                filter.$expr = { $gte: ['$currentUsageCount', '$totalUsageLimit'] };
                break;
        }
    }

    if (discountType && ['percentage', 'fixed', 'freeShipping'].includes(discountType)) filter.discountType = discountType;
    if (search) filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
    ];
    if (!isAdmin) {
        filter.isVisible = true;
        filter.startDate = { $lte: new Date() };
        filter.endDate = { $gte: new Date() };
        filter.$or = [{ totalUsageLimit: null }, { $expr: { $lt: ['$currentUsageCount', '$totalUsageLimit'] } }];
    }
    return filter;
};

// ======================
// INSTANCE METHODS
// ======================
promotionSchema.methods.checkEligibility = async function (user) {
    if (!user) return true;
    if (this.status !== 'active') return false;

    // Location check
    if (this.locations.length > 0 && user.location) {
        const { country, state, city } = user.location;
        const locationMatches = this.locations.some(loc => 
            [country?.toLowerCase(), state?.toLowerCase(), city?.toLowerCase()].includes(loc)
        );
        if (!locationMatches) return false;
    }

    // First-purchase and user checks
    return !(
        (this.isFirstPurchaseOnly && user.orders?.length > 0) ||
        (this.includedUsers.length > 0 && !this.includedUsers.some(id => id.equals(user._id))) ||
        this.excludedUsers.some(id => id.equals(user._id))
    );
};

promotionSchema.methods.calculateDiscountedPrice = function (originalPrice) {
    if (!originalPrice) return originalPrice;

    let discountedPrice = originalPrice;

    switch (this.discountType) {
        case 'percentage':
            discountedPrice = originalPrice * (1 - (this.discountValue / 100));
            break;
        case 'fixed':
            discountedPrice = Math.max(0, originalPrice - this.discountValue);
            break;
        case 'freeShipping':
            // No price change for free shipping
            break;
    }

    // Apply maximum discount cap if specified
    if (this.maximumDiscount) {
        const discountAmount = originalPrice - discountedPrice;
        if (discountAmount > this.maximumDiscount) {
            discountedPrice = originalPrice - this.maximumDiscount;
        }
    }

    return parseFloat(discountedPrice.toFixed(2));
};

promotionSchema.methods.applyPromotion = async function (user, orderValue) {
    if (this.status !== 'active') {
        throw new Error(`Cannot apply promotion with status: ${this.status}`);
    }

    const isEligible = await this.checkEligibility(user);
    if (!isEligible) {
        throw new Error('User is not eligible for this promotion');
    }

    if (orderValue < this.minimumPurchase) {
        throw new Error(`Order must be at least ${this.minimumPurchase} to apply this promotion`);
    }

    if (user && this.usageLimitPerUser > 0) {
        const Order = mongoose.model('Order');  // Corrected: Moved inside the instance method
        const userUsageCount = await Order.countDocuments({
            user: user._id,
            'appliedPromotions.code': this.code
        });

        if (userUsageCount >= this.usageLimitPerUser) {
            throw new Error(`Usage limit of ${this.usageLimitPerUser} reached for this user`);
        }
    }

    if (this.totalUsageLimit !== null && this.currentUsageCount >= this.totalUsageLimit) {
        throw new Error(`Total usage limit of ${this.totalUsageLimit} reached for this promotion`);
    }

    const discount = this.calculateDiscountedPrice(orderValue); // Changed to calculateDiscountedPrice
    this.currentUsageCount += 1;
    await this.save();

    return discount;
};

// ======================
// HOOKS
// ======================
promotionSchema.pre('save', async function (next) {
    // Validate no overlapping promotions with same code
    if (this.isModified('code') && this.code) {
        const codeExists = await this.constructor.findOne({
            _id: { $ne: this._id },
            code: this.code
        });

        if (codeExists) {
            throw new Error(`Promotion with code ${this.code} already exists`);
        }
    }

    // Check for conflicts if stackable is false
    if (!this.stackable && (this.isModified('applicableProducts') || this.isModified('applicableCategories'))) {
        const overlap = await this.constructor.findOne({
            _id: { $ne: this._id },
            stackable: false,
            $or: [
                { applicableProducts: { $in: this.applicableProducts } },
                { applicableCategories: { $in: this.applicableCategories } }
            ],
            startDate: { $lte: this.endDate },
            endDate: { $gte: this.startDate }
        });

        if (overlap) {
            throw new Error(`Conflicting promotion exists (ID: ${overlap._id})`);
        }
    }
    next();
});

promotionSchema.post('remove', async function (doc) {
    const Product = mongoose.model('Product'); // Corrected: Moved inside the post hook.
    try {
        await Product.updateMany(
            { eligiblePromotions: doc._id },
            { $pull: { eligiblePromotions: doc._id } }
        );
        logger.info(`Removed promotion ${doc._id} from all products`);
    } catch (err) {
        logger.error(`Error removing promotion reference: ${err.message}`);
    }
});

// Helper function to generate promotion codes - moved from controller
promotionSchema.statics.generatePromoCode = function () {
    return `PROMO-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
};

const Promotion = mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;