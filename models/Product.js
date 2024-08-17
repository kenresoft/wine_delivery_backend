const mongoose = require('mongoose');
const review = require('./Review');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    alcoholContent: { type: Number, required: true },
    description: { type: String, required: true },
    reviews: [review.schema],
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
