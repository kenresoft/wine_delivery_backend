const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Flash sale title is required']
    },
    description: {
        type: String,
        required: [true, 'Flash sale description is required']
    },
    startDate: {
        type: Date,
        required: [true, 'Flash sale start date is required'],
    },
    endDate: {
        type: Date,
        required: [true, 'Flash sale end date is required'],
    },
    discountPercentage: {
        type: Number,
        required: [true, 'Discount percentage is required'],
        min: [0, 'Discount cannot be negative'],
        max: [100, 'Discount cannot exceed 100%']
    },
    flashSaleProducts: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        specialPrice: {
            type: Number,
            required: false
        }
    }],
    isActive: {
        type: Boolean,
        default: false
    },
    maxPurchaseQuantity: {
        type: Number,
        default: null
    },
    minPurchaseAmount: {
        type: Number,
        default: 0
    },
    totalStock: {
        type: Number,
        default: null
    },
    stockRemaining: {
        type: Number,
        default: null
    },
    soldCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for efficient querying of active flash sales
flashSaleSchema.index({ startDate: 1, endDate: 1, isActive: 1 });

// Pre-save middleware to ensure consistent data
flashSaleSchema.pre('save', function (next) {
    // Initialize stockRemaining if totalStock is provided
    if (this.totalStock !== null && this.stockRemaining === null) {
        this.stockRemaining = this.totalStock;
    }

    // Ensure endDate is after startDate
    if (this.startDate >= this.endDate) {
        return next(new Error('End date must be after start date'));
    }

    next();
});

// Instance methods
flashSaleSchema.methods.isCurrentlyActive = function () {
    const now = new Date();
    return this.isActive &&
        now >= this.startDate &&
        now <= this.endDate &&
        (this.stockRemaining === null || this.stockRemaining > 0);
};

flashSaleSchema.methods.getTimeRemaining = function () {
    const now = new Date();
    if (now > this.endDate) return 0;
    return this.endDate.getTime() - now.getTime();
};

const FlashSale = mongoose.model('FlashSale', flashSaleSchema);
module.exports = FlashSale;