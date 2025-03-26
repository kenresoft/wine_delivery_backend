const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    price: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
    }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    items: [orderItemSchema],
    shipment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shipment',
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['stripe', 'paypal', 'cash_on_delivery'],
    },
    paymentDetails: {
        type: Object,
    },
    subTotal: {
        type: Number,
        required: true,
    },
    totalCost: {
        type: Number,
        required: true,
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: [
            'draft',
            'pending',
            'processing',
            'packaging',
            'shipping',
            'delivered',
            'cancelled',
        ],
        default: 'draft',
    },
    note: {
        type: String,
        trim: true,
        maxlength: 255,
    },
    trackingNumber: {
        type: String,
        trim: true,
    },
    appliedPromotion: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Promotion'
        },
        code: String,
        title: String,
        discountType: {
            type: String,
            enum: ['percentage', 'fixed', 'freeShipping']
        },
        discountValue: Number,
        discountAmount: Number,
        freeShipping: Boolean
    },
    shippingCost: {
        type: Number,
        default: 0
    },
    deliveryDate: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });

// Virtual method to calculate order age in days
OrderSchema.virtual('ageInDays').get(function () {
    const now = new Date();
    const createdDate = this.createdAt;
    const diffTime = Math.abs(now - createdDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update totalCost when promotion is applied
OrderSchema.pre('save', function (next) {
    if (this.isModified('appliedPromotion') && this.appliedPromotion) {
        if (this.appliedPromotion.freeShipping) {
            this.shippingCost = 0;
        }

        // Recalculate total cost with applied discount
        this.totalCost = this.subTotal + this.shippingCost + this.taxAmount - (this.appliedPromotion.discountAmount || 0);
    }
    next();
});

// Index for efficient queries
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ 'appliedPromotion.id': 1 });

module.exports = mongoose.model('Order', OrderSchema);