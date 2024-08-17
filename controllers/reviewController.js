const Review = require('../models/Review');
const Product = require('../models/Product');

exports.createReview = async (req, res) => {
    try {
        const { productId, rating, review } = req.body;
        const userReview = await Review.create({
            userId: req.user.id,
            // productId,
            // rating,
            review,
        });

        // Update product rating
        const product = await Product.findById(productId);
        product.reviews.push(userReview);
        // product.numReviews = product.reviews.length;
        // product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

        await product.save();

        res.status(201).json({ success: true, review: userReview });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ productId: req.params.productId }).populate('userId', 'name');
        res.status(200).json({ success: true, reviews });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);

        // Update product rating
        const product = await Product.findById(req.body.productId);
        product.reviews = product.reviews.filter((rev) => rev.id !== req.params.id);
        product.numReviews = product.reviews.length;
        product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

        await product.save();

        res.status(204).json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
