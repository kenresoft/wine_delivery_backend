const Category = require('../models/Category');

exports.createCategory = async (req, res) => {
    try {
        const category = await Category.findOne({ name: req.body.name });
        if (category) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const newCategory = await Category.create(req.body);
        res.status(201).json({ success: true, category: newCategory });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json({ success: true, categories });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, category });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, category });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.status(204).json({ success: true, message: 'Category deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
