const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    uppercase: true,
    trim: true,
    minlength: [4, 'Coupon code must be at least 4 characters'],
    maxlength: [20, 'Coupon code cannot exceed 20 characters']
  },
  discount: {
    type: Number,
    required: [true, 'Discount amount is required'],
    min: [0, 'Discount cannot be negative'],
    max: [1000, 'Discount cannot exceed 1000']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage',
    required: [true, 'Discount type is required']
  },
  minimumPurchaseAmount: {
    type: Number,
    min: [0, 'Minimum purchase amount cannot be negative'],
    default: 0
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Expiry date must be in the future'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster querying
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });

// Virtual property for coupon status
couponSchema.virtual('status').get(function() {
  return this.expiryDate > new Date() ? 'active' : 'expired';
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;