const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    discount: { type: Number, required: true },
    validUntil: { type: Date, required: true }
});

const Promotion = mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;
