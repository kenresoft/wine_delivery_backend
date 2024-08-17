const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    // userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    review: { type: String, required: true }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    // category: { type: String, required: true },
    category: { type: mongoose.Schema.Types.String, ref: 'Category', required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    rating: { type: Number, required: true },
    alcoholContent: { type: Number, required: true },
    description: { type: String, required: true },
    reviews: [reviewSchema]
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
