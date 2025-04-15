const mongoose = require('mongoose');

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
            // unique: true,
            // sparse: true,
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
        isActive: {
            type: Boolean,
            default: true
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
promotionSchema.index({ isActive: 1, isVisible: 1 });
promotionSchema.index({ isFirstPurchaseOnly: 1 });
promotionSchema.index({ locations: 1 });

// ======================
// VIRTUAL PROPERTIES
// ======================
promotionSchema.virtual('calculatedDiscount').get(function () {
    return (orderValue) => {
        if (!orderValue || orderValue < this.minimumPurchase) return 0;

        let discount = 0;
        if (this.discountType === 'percentage') {
            discount = (orderValue * this.discountValue) / 100;
            if (this.maximumDiscount !== null && discount > this.maximumDiscount) {
                discount = this.maximumDiscount;
            }
        } else if (this.discountType === 'fixed') {
            discount = this.discountValue;
        }

        return Math.min(discount, orderValue); // Ensure discount doesn't exceed order value
    };
});

promotionSchema.virtual('status').get(function () {
    const now = new Date();
    if (!this.isActive) return 'inactive';
    if (now < this.startDate) return 'scheduled';
    if (now > this.endDate) return 'expired';
    if (this.totalUsageLimit && this.currentUsageCount >= this.totalUsageLimit) return 'limit_reached';
    return 'active';
});

// ======================
// STATIC METHODS
// ======================
promotionSchema.statics.findActivePromotions = function () {
    const now = new Date();
    return this.find({
        isActive: true,
        isVisible: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { totalUsageLimit: null },
            { currentUsageCount: { $lt: "$totalUsageLimit" } }
        ]
    });
};

promotionSchema.statics.findEligiblePromotions = async function (userId, productIds = []) {
    const user = await mongoose.model('User').findById(userId).select('location orderHistory');
    const now = new Date();

    return this.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
            { applicableProducts: { $in: productIds } },
            { applicableCategories: { $exists: true, $ne: [] } }
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
};

// ======================
// INSTANCE METHODS
// ======================
promotionSchema.methods.checkEligibility = async function (user) {
    // Location check
    if (this.locations.length > 0 && user?.location) {
        if (!this.locations.includes(user.location.toLowerCase())) {
            return false;
        }
    }

    // First-purchase check
    if (this.isFirstPurchaseOnly && user?.orderHistory?.length > 0) {
        return false;
    }

    // User inclusion/exclusion
    if (user?._id) {
        if (this.includedUsers.length > 0 && !this.includedUsers.includes(user._id)) {
            return false;
        }
        if (this.excludedUsers.includes(user._id)) {
            return false;
        }
    }

    return true;
};

promotionSchema.methods.applyPromotion = function (orderValue) {
    if (this.status !== 'active') {
        throw new Error(`Cannot apply promotion with status: ${this.status}`);
    }

    const discount = this.calculatedDiscount(orderValue);
    this.currentUsageCount += 1;
    return discount;
};

// ======================
// HOOKS
// ======================
promotionSchema.pre('save', async function (next) {
    // Auto-deactivate expired promotions
    if (this.endDate < new Date()) {
        this.isActive = false;
    }

    // Validate no overlapping promotions for same products/categories
    if (this.isModified('applicableProducts') || this.isModified('applicableCategories')) {
        const overlap = await this.constructor.findOne({
            _id: { $ne: this._id },
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

// Update product references when promotion is deleted
promotionSchema.post('remove', async function (doc) {
    await mongoose.model('Product').updateMany(
        { eligiblePromotions: doc._id },
        { $pull: { eligiblePromotions: doc._id } }
    );
});

const Promotion = mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;
