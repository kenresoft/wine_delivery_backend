const mongoose = require('mongoose');
const { reviewSchema } = require('./Review');
const { suppliersSchema } = require('./Suppliers');
const { variantSchema } = require('./Variant');

// Schema for related products
const relatedProductSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    matchedFields: {
        type: [String],
        required: true,
    },
    relationshipType: {  // Define the relationship type like 'related', 'similar', etc.
        type: String,
        default: 'related'
    },
    priority: {  // Priority based on number of matched fields or other logic
        type: Number,
        default: 0
    },
});

// Main product schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    images: [String], // Array to store multiple image paths
    /*     image: {
        type: String,
        required: true
    }, */
    // Price management
    defaultPrice: { type: Number }, // Average price calculated from suppliers
    defaultQuantity: { type: Number }, // Total quantity calculated from suppliers
    defaultDiscount: { type: Number }, // Average discount calculated from suppliers
    suppliers: [suppliersSchema], // For product-supplier relation
    alcoholContent: {
        type: Number,
        required: true,
        min: [0, 'Alcohol content cannot be negative'],
        max: [100, 'Alcohol content cannot exceed 100%']
    },
    description: { type: String, required: true },
    deleted: { type: Boolean, default: false },
    /*     sku: {
            type: String,
            unique: true,
        }, */
    brand: { type: String, default: 'Generic Brand' },
    tags: { type: [String], default: [] },
    weight: { type: Number, default: 0 },
    dimensions: {
        length: { type: Number, default: 0 },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 }
    },
    expirationDate: { type: Date },
    // Derived fields (calculated)
    stockStatus: {
        type: String,
        enum: ['In Stock', 'Out of Stock', 'Low Stock', 'Coming Soon'],
    },
    createdAt: { type: Date, default: Date.now }, // Ensure createdAt is defined
    isNewArrival: {
        type: Boolean,
        default: false,
    },
    isFeatured: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },
    variants: [variantSchema],
    shippingCost: { type: Number, default: 0 },
    relatedProducts: [relatedProductSchema],
    reviews: [reviewSchema],
}, {
    timestamps: true, // This will add createdAt and updatedAt fields
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
productSchema.index({ category: 1, defaultPrice: 1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
module.exports = Product;
