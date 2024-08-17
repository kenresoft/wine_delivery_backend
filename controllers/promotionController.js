const Promotion = require('../models/Promotion');

exports.createPromotion = async (req, res) => {
    try {
        const promotion = await Promotion.create(req.body);
        res.status(201).json({ success: true, promotion });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.find();
        res.status(200).json({ success: true, promotions });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getPromotionById = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id);
        if (!promotion) {
            return res.status(404).json({ success: false, message: 'Promotion not found' });
        }
        res.status(200).json({ success: true, promotion });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updatePromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, promotion });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deletePromotion = async (req, res) => {
    try {
        await Promotion.findByIdAndDelete(req.params.id);
        res.status(204).json({ success: true, message: 'Promotion deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
