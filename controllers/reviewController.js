const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');

exports.createReview = async (req, res) => {
    try {
        const { productId, rating, review } = req.body;
        const user = await User.findById(req.user.id, { password: 0, isAdmin: 0 });  // exclude password

        const userReview = await Review.create({
            user,
            rating,
            review,
        });

        // Update product rating
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        product.reviews.push(userReview);
        await product.save();

        res.status(201).json({ success: true, review: userReview });

    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId).populate('reviews.user', { password: 0, isAdmin: 0 });
        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
        }
        else {
            res.status(200).json({ success: true, reviews: product.reviews });
        }
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

        await product.save();

        res.status(204).json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
