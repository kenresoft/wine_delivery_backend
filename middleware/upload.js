const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Product = require('../models/Product'); // Assuming you have a Product model
const { deleteOldFile } = require('../utils/product');

// Define storage engine based on the type of file being uploaded
const getStorage = (folder, type) => multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, folder); // Set the upload destination folder
    },
    filename: async (req, file, cb) => {
        let fileName;
        try {
            if (type === 'profile') {
                // Profile image: use user ID in filename
                const userId = req.user._id || 'anonymous';
                const extension = path.extname(file.originalname);
                fileName = `${userId}-${Date.now()}${extension}`;

                // Update user's profile image in the database (asynchronously)
                const user = await User.findById(req.user._id);
                if (user && user.profileImage) {
                    await deleteOldFile(path.join(__dirname, '..', user.profileImage));
                }
                user.profileImage = path.join(folder, fileName);
                await user.save();

                cb(null, fileName);
            } else if (type === 'product') {
                // Initialize the counter to reset for each product
                if (!req.imageCounter) {
                    req.imageCounter = 1;
                }

                // Fetch the product by ID (asynchronously)
                const product = await Product.findById(req.params.id);
                if (!product) {
                    return cb(new Error('Product not found'));
                }

                // Product image: use product ID, timestamp, and position in filename
                const productId = req.params.id || 'unknown-product';
                const extension = path.extname(file.originalname);
                const fileName = `${productId}-${req.imageCounter}${extension}`;
                // const fileName = `${productId}-${Date.now()}-${req.imageCounter}${extension}`;

                // Increment the counter for the next image in this product
                req.imageCounter++;

                // Return the file name to multer
                cb(null, fileName);
            }
        } catch (err) {
            cb(err);
        }
    }
});

// File filter to allow only specific file types (jpeg, jpg, png)
const fileFilter = (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Error: Images Only! (jpeg, jpg, png)');
    }
};

// Function to configure multer for single or multiple file uploads
const setupUpload = (folder, fieldName, type, maxCount = 1) => {
    return multer({
        storage: getStorage(folder, type),
        limits: { fileSize: 10 * 1000000 }, // Limit file size to 1MB
        fileFilter: fileFilter
        // }).array(fieldName, maxCount); // Use dynamic field name
    })[maxCount === 1 ? 'single' : 'array'](fieldName, maxCount); // Use dynamic field name
};

// Exporting specific upload configurations
module.exports = {
    // Profile image upload (single file with field name 'profileImage')
    uploadProfileImage: setupUpload('./uploads/profileImages', 'profileImage', 'profile', 1),

    // Product images upload (multiple files with field name 'images', max 3)
    uploadProductImages: setupUpload('./uploads/products', 'images', 'product', 4)
};
