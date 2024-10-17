const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const couponRoutes = require('./routes/couponRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const favoritesRoutes = require('./routes/favoriteRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const supplierRoutes = require('./routes/supplierRoutes');

const app = express();
const server = http.createServer(app);
const ioInstance = require('./ioInstance');
// const setupSocket = require('./socket/socketHandler');
const PORT = process.env.PORT || 5000;

// Initialize socket
// setupSocket(server);
ioInstance.init(server);  // Initialize the io object with the server

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/shipment', shipmentRoutes);
app.use('/api/suppliers', supplierRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { /* useNewUrlParser: true, useUnifiedTopology: true  */ })
  .then(() => server.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(error => console.error(error));
