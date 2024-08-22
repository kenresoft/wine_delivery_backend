const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Product = require('../models/Product');

exports.addToFavorites = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.id;

        const favorite = await Favorite.findOne({ user: userId, product: productId });
        if (favorite) {
            return res.status(400).json({ success: false, message: 'Product already in favorites' });
        }

        const newFavorite = new Favorite({ user: userId, product: productId });
        await newFavorite.save();

        // Update the user's favorites array
        const user = await User.findByIdAndUpdate(userId,
            { $push: { favorites: newFavorite._id } },
            { new: true }).select('-password -isAdmin').populate(
                {
                    path: 'favorites',
                    select: 'product',
                    populate: {
                        path: 'product',
                        select: '_id name'
                    }
                }
            );

        res.status(201).json({ success: true, message: 'Product added to favorites', user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getFavoriteById = async (req, res) => {
    const { productId } = req.params; // Access product ID from params

    try {
        const user = await User.findById(req.user.id)
            .select('-password -isAdmin') // Exclude password and isAdmin
            .populate({
                path: 'favorites',
                match: { product: productId }, // Filter favorites by product ID
                select: 'product', // Only include product field in favorites
                populate: {
                    path: 'product',
                    select: '_id', // Only include _id and name in product
                    // select: '_id name', // Only include _id and name in product
                },
            });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const favorite = user.favorites.filter(
            (favorite) => favorite.product._id.toString() === productId
        ); // Filter again in case of duplicates

        res.status(200).json({ success: true, favorite: favorite });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUserFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -isAdmin').populate(
            {
                path: 'favorites',
                select: 'product',
                populate: {
                    path: 'product',
                    select: '_id'
                }
            }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const favorite = user.favorites;

        res.status(200).json({ success: true, favorite });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.removeFromFavorites = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.id;

        const favorite = await Favorite.findOneAndDelete({ user: userId, product: productId });
        if (!favorite) {
            return res.status(400).json({ success: false, message: 'Product not in favorites' });
        }

        // Update the user's favorites array
        const user = await User.findByIdAndUpdate(userId, { $pull: { favorites: favorite._id } }, { new: true }).select('-password -isAdmin');

        res.status(200).json({ success: true, message: 'Product removed from favorites', user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getAllFavorites = async (req, res) => {
    try {
        const users = await User.find().select('-password -isAdmin').populate(
            {
                path: 'favorites',
                select: 'product',
                populate: {
                    path: 'product',
                    select: '_id name'
                }
            }
        );
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

