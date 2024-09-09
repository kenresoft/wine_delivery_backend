const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // Replace with your Product model reference
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
}, { _id: false }); // Avoid creating a separate ID for orderItem

const OrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    items: [
        orderItemSchema
    ],
    shipment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shipment',
        required: true,
    },
    paymentMethod: {
        type: String,
    },
    paymentDetails: { // Store relevant payment information (e.g., transaction ID)
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
    createdAt: {
        type: Date,
        default: Date.now,
    },


    // - taxAmount: { type: Number }, // Amount of tax applied

});

module.exports = mongoose.model('Order', OrderSchema);