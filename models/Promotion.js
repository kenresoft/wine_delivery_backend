const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed', 'freeShipping'],
        default: 'percentage'
    },
    discountValue: {
        type: Number,
        required: true,
        min: [0, 'Discount value cannot be negative']
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    minimumPurchase: {
        type: Number,
        default: 0
    },
    maximumDiscount: {
        type: Number,
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
        default: null
    },
    totalUsageLimit: {
        type: Number,
        default: null
    },
    currentUsageCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
promotionSchema.index({ startDate: 1, endDate: 1, isActive: 1 });
promotionSchema.index({ isFirstPurchaseOnly: 1 });

// Static methods
promotionSchema.statics.findActivePromotions = function () {
    const now = new Date();
    return this.find({
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: true,
        $or: [
            { totalUsageLimit: null },
            { currentUsageCount: { $lt: "$totalUsageLimit" } }
        ]
    });
};

// Virtual for discount calculation
promotionSchema.virtual('calculatedDiscount').get(function (orderValue) {
    if (!orderValue) return 0;

    if (orderValue < this.minimumPurchase) return 0;

    let discount = 0;
    if (this.discountType === 'percentage') {
        discount = (orderValue * this.discountValue) / 100;
        if (this.maximumDiscount !== null && discount > this.maximumDiscount) {
            discount = this.maximumDiscount;
        }
    } else if (this.discountType === 'fixed') {
        discount = this.discountValue;
    }

    return discount;
});

const Promotion = mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;

// Update Product model to include flash sale and promotion references
const productSchema = mongoose.model('Product').schema;

// Add flash sale field if not already present
if (!productSchema.path('currentFlashSale')) {
    productSchema.add({
        currentFlashSale: {
            flashSale: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'FlashSale'
            },
            specialPrice: {
                type: Number
            },
            startDate: Date,
            endDate: Date
        }
    });
}

// Add eligible promotions field if not already present
if (!productSchema.path('eligiblePromotions')) {
    productSchema.add({
        eligiblePromotions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Promotion'
        }]
    });
}

// Add virtual for calculating final price with promotions/flash sales
productSchema.virtual('finalPrice').get(function () {
    // Start with default price
    let price = this.defaultPrice;

    // Check if product is on sale
    if (this.isOnSale && this.defaultDiscount) {
        price = price * (1 - this.defaultDiscount / 100);
    }

    // Check if product is in an active flash sale
    const now = new Date();
    if (this.currentFlashSale &&
        this.currentFlashSale.startDate <= now &&
        this.currentFlashSale.endDate >= now) {
        return this.currentFlashSale.specialPrice || price;
    }

    return price;
});