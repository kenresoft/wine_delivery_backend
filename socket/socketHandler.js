const socketIo = require('socket.io');
const { isSocketAuthenticated } = require('../middleware/authMiddleware');

const setupSocket = (server) => {
    const io = socketIo(server, {
        cors: {
            origin: "*",  // Update this with your client URL in production
            methods: ["GET", "POST"]
        }
    });

    io.use(isSocketAuthenticated);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.email}`);

        socket.on('sendMessage', (message) => {
            console.log(`Message from ${socket.user.email}: ${message}`);
            io.emit('receiveMessage', `${socket.user.email}: ${message}`);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.email}`);
        });
    });

    return io;
};

module.exports = setupSocket;
