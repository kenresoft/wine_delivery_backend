const User = require('../models/User');

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUsersFavorites = async (req, res) => {
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

exports.deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(204).json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getUserFavoritesById = async (req, res) => {
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
            select: '_id name', // Only include _id and name in product
          },
        });
  
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      const favorites = user.favorites.filter(
        (favorite) => favorite.product._id.toString() === productId
      ); // Filter again in case of duplicates
  
      res.status(200).json({ success: true, favorites });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
