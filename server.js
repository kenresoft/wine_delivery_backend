const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const ioInstance = require('./utils/ioInstance');

dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize socket.io
ioInstance.init(server);

// Database connection and server startup
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    console.log('✅ MongoDB connected successfully');

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection failed', error);
    process.exit(1);
  }
};

// Error handlers
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down gracefully...');
  console.error(err.name, err.message, err.stack);
  setTimeout(() => {
    process.exit(1);
  }, 1500);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Start the application
startServer();