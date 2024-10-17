const mongoose = require('mongoose');

// Define the basic Supplier schema
const supplierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contact: { type: String },
    location: { type: String }
}, {
    timestamps: true
});

// Define the Product-Supplier relationship schema
const suppliersSchema = new mongoose.Schema({
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },  // Reference to the Supplier model
    price: { type: Number, required: true },  // Supplier-specific price
    quantity: { type: Number, required: true },  // Supplier-specific quantity
    discount: { type: Number, default: 0 },  // Supplier-specific discount (default is 0)
    restockDate: { type: Date }  // Expected restock date for the supplier
}, {
    timestamps: true
});

// Create the models from the schemas
const Supplier = mongoose.model('Supplier', supplierSchema);
const Suppliers = mongoose.model('Suppliers', suppliersSchema);

module.exports = { Supplier, Suppliers, supplierSchema, suppliersSchema };
