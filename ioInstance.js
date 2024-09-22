const { isSocketAuthenticated } = require('./middleware/authMiddleware');
let io;

module.exports = {
    init: (server) => {
        io = require('socket.io')(server, {
            cors: {
                origin: "*",
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
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized");
        }
        return io;
    }
};
