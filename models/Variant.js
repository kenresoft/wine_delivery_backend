// models/Variant.js
const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    type: { type: String, required: true }, // e.g., 'size', 'color'
    value: { type: String, required: true } // e.g., 'Large', 'Red'
});

const Variant = mongoose.model('Variant', variantSchema);
module.exports = { Variant, variantSchema };
