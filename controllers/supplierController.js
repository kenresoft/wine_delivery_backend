const { Supplier } = require('../models/Suppliers');

// Create a new supplier
exports.createSupplier = async (req, res) => {
    try {
        const { name, contact, location } = req.body;

        const newSupplier = new Supplier({ name, contact, location });
        const savedSupplier = await newSupplier.save();

        res.status(201).json({ success: true, supplier: savedSupplier });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all suppliers
exports.getAllSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find();
        res.status(200).json({ success: true, suppliers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get supplier by ID
exports.getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = await Supplier.findById(id);

        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        res.status(200).json({ success: true, supplier });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update supplier details
exports.updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact, location } = req.body;

        const updatedSupplier = await Supplier.findByIdAndUpdate(id, { name, contact, location }, { new: true });

        if (!updatedSupplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        res.status(200).json({ success: true, supplier: updatedSupplier });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a supplier
exports.deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedSupplier = await Supplier.findByIdAndDelete(id);
        if (!deletedSupplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
