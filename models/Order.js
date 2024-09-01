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
},);

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
        enum: ['pending', 'processing', 'shipped', 'cancelled'],
        default: 'pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Order', OrderSchema);