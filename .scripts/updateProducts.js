const mongoose = require('mongoose');
const Product = require('../models/Product'); 
const dotenv = require('dotenv');

dotenv.config();

// Replace with your MongoDB connection string
const mongoUri = process.env.MONGODB_URI;

async function updateProductImages() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            /* useNewUrlParser: true,
            useUnifiedTopology: true, */
        });

        console.log('Connected to MongoDB');

        // Find all products that have images but no image.
        const productsToUpdate = await Product.find({
            image: { $exists: false },
            images: { $exists: true, $not: { $size: 0 } },
        });

        console.log(`Found ${productsToUpdate.length} products to update.`);

        for (const product of productsToUpdate) {
            product.image = product.images[0]; // Set image to the first image from images array.
            await product.save(); // Save the updated product.
            console.log(`Updated product: ${product._id}`);
        }

        //Find all products with no image and no images array or an empty images array
        const productsToUpdateWithDefault = await Product.find({
            $or: [
                { image: { $exists: false }, images: { $exists: false } },
                { image: { $exists: false }, images: { $size: 0 } }
            ]
        });

        console.log(`Found ${productsToUpdateWithDefault.length} products to update with default image.`);

        for (const product of productsToUpdateWithDefault) {
            product.image = '/assets/images/vintiora-wine.png'
            await product.save();
            console.log(`Updated product with default: ${product._id}`);
        }

        console.log('Product image updates completed.');
        mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    } catch (error) {
        console.error('Error updating product images:', error);
        mongoose.disconnect();
    }
}

updateProductImages();