/* const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 }
    }],
    appliedCoupon: {
        code: String,
        discount: Number,
        discountAmount: Number
    },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart; */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define CartItemSchema to enhance modularity
const CartItemSchema = new Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    }
});

// Define a dedicated CartPricingSchema for improved encapsulation
const CartPricingSchema = new Schema({
    subtotal: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    }
});

// Define consistent CouponReferenceSchema that aligns with Coupon model
const CouponReferenceSchema = new Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    code: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
    }
});

const CartSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    items: [CartItemSchema],
    appliedCoupon: CouponReferenceSchema,
    pricing: CartPricingSchema,
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Middleware to calculate pricing before save
CartSchema.pre('save', async function (next) {
    // Skip calculation if it's just an update to the pricing field itself
    if (this.isModified('pricing') && !this.isModified('items') && !this.isModified('appliedCoupon')) {
        return next();
    }

    try {
        // Calculate pricing whenever items or appliedCoupon changes
        if (this.items && this.items.length > 0) {
            // We need to populate product details to calculate pricing
            await this.populate('items.product', 'defaultPrice');

            // Calculate subtotal
            let subtotal = 0;
            for (const item of this.items) {
                if (item.product && item.product.defaultPrice) {
                    subtotal += item.product.defaultPrice * item.quantity;
                }
            }

            // Calculate discount if coupon applied
            let discount = 0;
            if (this.appliedCoupon) {
                if (this.appliedCoupon.discountType === 'percentage') {
                    discount = subtotal * (this.appliedCoupon.discount / 100);
                } else {
                    discount = Math.min(subtotal, this.appliedCoupon.discount);
                }
            }

            // Calculate total
            const total = Math.max(0, subtotal - discount);

            // Update pricing object
            this.pricing = {
                subtotal: Number(subtotal.toFixed(2)),
                discount: Number(discount.toFixed(2)),
                total: Number(total.toFixed(2))
            };
        } else {
            // Reset pricing for empty cart
            this.pricing = {
                subtotal: 0,
                discount: 0,
                total: 0
            };
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Method to handle coupon application with validation
CartSchema.methods.applyCoupon = async function (coupon) {
    // Store coupon reference
    this.appliedCoupon = {
        _id: coupon._id,
        code: coupon.code,
        discount: coupon.discount,
        discountType: coupon.discountType
    };

    // Save will trigger pricing recalculation via middleware
    await this.save();
    return this;
};

// Method to remove coupon
CartSchema.methods.removeCoupon = async function () {
    this.appliedCoupon = undefined;

    // Save will trigger pricing recalculation via middleware
    await this.save();
    return this;
};

const Cart = mongoose.model('Cart', CartSchema);
module.exports = Cart;