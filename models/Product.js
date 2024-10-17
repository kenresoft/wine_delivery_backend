const mongoose = require('mongoose');
const { reviewSchema } = require('./Review');
const { suppliersSchema } = require('./Suppliers');
const { variantSchema } = require('./Variant');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Category',
        required: true
    },
    image: {
        type: String,
        required: true
    },
    // Price management
    defaultPrice: { type: Number }, // Average price calculated from suppliers
    defaultQuantity: { type: Number }, // Total quantity calculated from suppliers
    defaultDiscount: { type: Number }, // Average discount calculated from suppliers
    suppliers: [suppliersSchema], // For product-supplier relation
    alcoholContent: { type: Number, required: true, min: [0, 'Alcohol content cannot be negative'], max: [100, 'Alcohol content cannot exceed 100%'] },
    description: { type: String, required: true },
    deleted: { type: Boolean, default: false },
    sku: { type: String, unique: true }, // Optional (remove if not needed)
    brand: { type: String },
    tags: [{ type: String }],
    weight: { type: Number }, // in grams or kg
    dimensions: {
        length: { type: Number },
        width: { type: Number },
        height: { type: Number }
    },
    expirationDate: { type: Date },
    // Derived fields (calculated)
    stockStatus: {
        type: String,
        enum: ['In Stock', 'Out of Stock', 'Discontinued'],
        default: 'In Stock',
        get() {
            // Consider using the earliest restockDate among suppliers for a more accurate overall stock status
            const earliestRestockDate = this.suppliers.length > 0 ? Math.min(...this.suppliers.map(supplier => supplier.restockDate)) : null;
            const threshold = 10; // Adjust threshold for "In Stock"
            return this.defaultQuantity > threshold ? 'In Stock' : (earliestRestockDate ? 'Coming Soon' : 'Out of Stock');
        }
    },
    isNewArrival: {
        type: Boolean,
        default: false,
        get() {
            // Calculate new arrival based on a date threshold (adjust as needed)
            const threshold = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 1 week ago
            return this.createdAt && this.createdAt >= threshold;
        }
    },
    isFeatured: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },
    variants: [variantSchema],
    shippingCost: { type: Number, default: 0 },
    relatedProducts: [{
        productId: { type: String },
        matchedFields: [{ type: String }]
    }],
    // relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    reviews: [reviewSchema],
}, {
    timestamps: true,
    versionKey: 'version'
});

// Virtual fields for price calculations (consider using getters instead)
productSchema.virtual('formattedPrice').get(function () {
    // Use defaultPrice if set, otherwise calculate average from suppliers
    const price = this.defaultPrice || this.suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / this.suppliers.length;
    return `$${price.toFixed(2)}`;
});

productSchema.virtual('discountedPrice').get(function () {
    const price = this.defaultPrice || this.suppliers.reduce((sum, supplier) => sum + supplier.price, 0) / this.suppliers.length;
    return price * (1 - this.discountPercentage / 100);
});

// Methods for calculating average rating (consider using a middleware)
productSchema.methods.calculateAverageRating = function () {
    if (this.reviews.length === 0) return 0;
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / this.reviews.length;
};

// Indexing (consider using a compound index if needed)
productSchema.index({ category: 1, price: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
