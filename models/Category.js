const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    image: { type: String },
    description: { type: String },
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
