const dotenv = require('dotenv');
const Product = require('./models/productModel'); // Adjust the path to match your structure
const Category = require('./models/categoryModel'); // Adjust the path to match your structure
const Order = require('./models/orderModel'); // Adjust the path to match your structure
const Promotion = require('./models/promotionModel'); // Adjust the path to match your structure
const User = require('./models/userModel'); // Adjust the path to match your structure
const connectDB = require('./config/db');
const fs = require('fs');

dotenv.config();

// Connect to the database
connectDB();

const importData = async () => {
    try {
        // Load JSON data
        const products = require('./data/products.json');
        /* const categories = require('./data/categories.json'); 
        const orders = require('./data/orders.json');
        const promotions = require('./data/promotions.json'); 
        const users = require('./data/users.json'); */

        // Create a lookup map for category names to ObjectIds
        /*     const categoryMap = await Category.find().then(categories =>
                categories.reduce((map, category) => {
                  map[category.name] = category._id;
                  return map;
                }, {})
              ); */

        // Convert string category names in products to ObjectIds
        /* const productsWithObjectIds = products.map(product => ({
            ...product,
            category: categoryMap[product.category],  // Replace string with ObjectId
        })); */

        const data = JSON.parse(fs.readFileSync('./data/products.json', 'utf-8'));

        /* data.forEach((product) => {
            console.log(`Importing product: ${product.name}, Category: ${product.category}`);
        }); */

        // Iterate and save each product
        /* for (const product of data) {
            await Product.create(product);
        } */


        // Insert data into the database
        await Product.insertMany(productsWithObjectIds);
        /* await Category.insertMany(categories);
        await Order.insertMany(orders);
        await Promotion.insertMany(promotions);
        await User.insertMany(users); */

        console.log('Data imported successfully!');
        process.exit();
    } catch (error) {
        console.error('Error importing data:', error.message);
        process.exit(1);
    }
};

importData();
