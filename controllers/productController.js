const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json({ success: true, product });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

/* exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find()
            .populate('category')
            .populate('reviews.user', { password: 0, isAdmin: 0 })
            .populate({
                path: 'favorites',
                select: 'product', // Only include product field in favorites
                populate: {
                  path: 'product',
                  select: '_id name', // Only include _id and name in product
                },
              });

        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
}; */

exports.getAllProducts = async (req, res) => {
    try {
      const userId = req.user ? req.user.id : null; // Get user ID if logged in
  
      const products = await Product.find()
        .populate('category')
        .populate('reviews.user', { password: 0, isAdmin: 0, favorites: 0 });
  
      // If user is logged in, fetch their favorites
      if (userId) {
        const userFavorites = await User.findById(userId, 'favorites');
  
        // Create a set of favorite product IDs for efficient lookup
        const favoriteProductIds = new Set(userFavorites.favorites.map(f => f.product));
  
        // Add a `isFavorited` property to each product
        products.forEach(product => {
          product.isFavorited = favoriteProductIds.has(product._id.toString());
        });
      }
  
      res.status(200).json({ success: true, products });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category');
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.status(200).json({ success: true, product });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('category');
        res.status(200).json({ success: true, product });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.status(204).json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
