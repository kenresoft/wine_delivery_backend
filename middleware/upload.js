/* const multer = require('multer');
const path = require('path');
const User = require('../models/User');

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
                const userId = req.user._id || 'anonymous'; // Handle cases without username
                const extension = path.extname(file.originalname);
                fileName = `${userId}-${Date.now()}${extension}`;
            } else if (type === 'product') {
                // Product image: use product ID in filename
                const productId = req.params.id || 'unknown-product'; // Fallback if productName isn't provided
                const extension = path.extname(file.originalname);
                fileName = `${productId}-${Date.now()}${extension}`;
            }
            cb(null, fileName);
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
        limits: { fileSize: 1000000 }, // Limit file size to 1MB
        fileFilter: fileFilter
    })[maxCount === 1 ? 'single' : 'array'](fieldName, maxCount); // Use dynamic field name
};

// Exporting specific upload configurations
module.exports = {
    // Profile image upload (single file with field name 'profileImage')
    uploadProfileImage: setupUpload('./uploads/profileImages', 'profileImage', 'profile', 1),

    // Product images upload (multiple files with field name 'images', max 3)
    uploadProductImages: setupUpload('./uploads/products', 'images', 'product', 3)
};

 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Product = require('../models/Product'); // Assuming you have a Product model

// Helper to delete old files
const deleteOldFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
            } else {
                console.log('Old file deleted:', filePath);
            }
        });
    }
};

let imageCounter = 1; // Initialize a counter for image positions

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

      } else if (type === 'product') {
        // Fetch the product by ID (asynchronously)
        const product = await Product.findById(req.params.id);
        if (!product) {
          return cb(new Error('Product not found'));
        }

        // Product image: use product ID, timestamp, and position in filename
        const productId = req.params.id || 'unknown-product';
        const extension = path.extname(file.originalname);
        fileName = `${productId}-${Date.now()}-${imageCounter}${extension}`;

        // Update product images in the database (asynchronously)
        if (req.files && req.files.length > 0) {
          // When multiple files are uploaded, update images array
          product.images = req.files.map(file => path.join(folder, file.filename));
        } else {
          // Single image upload fallback
          product.images = [path.join(folder, fileName)];
        }

        // Delete old product images before uploading new ones (asynchronously)
        if (product.images && product.images.length > 0) {
          await Promise.all(product.images.map(imagePath => deleteOldFile(path.join(__dirname, '..', imagePath))));
        }

        await product.save();

        // Increment the counter for the next image in this product
        imageCounter++;
      }

      cb(null, fileName);
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
        limits: { fileSize: 1000000 }, // Limit file size to 1MB
        fileFilter: fileFilter
    })[maxCount === 1 ? 'single' : 'array'](fieldName, maxCount); // Use dynamic field name
};

// Exporting specific upload configurations
module.exports = {
    // Profile image upload (single file with field name 'profileImage')
    uploadProfileImage: setupUpload('./uploads/profileImages', 'profileImage', 'profile', 1),

    // Product images upload (multiple files with field name 'images', max 3)
    uploadProductImages: setupUpload('./uploads/products', 'images', 'product', 3)
};
