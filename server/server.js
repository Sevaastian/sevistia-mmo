const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let players = {};

io.on('connection', (socket) => {
    console.log(`Bir oyuncu bağlandı: ${socket.id}`);

    socket.on('join_game', (playerData) => {
        players[socket.id] = {
            id: socket.id,
            name: playerData.name,
            skinColor: playerData.skinColor,
            x: playerData.x,
            y: playerData.y,
            facing: playerData.facing || 'right',
            currentMap: playerData.currentMap,
            equipped: playerData.equipped,
            dialogue: null
        };
        io.emit('update_players', players);
    });

    socket.on('player_move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].facing = data.facing;
            players[socket.id].currentMap = data.currentMap;
            players[socket.id].equipped = data.equipped;
            io.emit('update_players', players);
        }
    });

    socket.on('send_chat', (message) => {
        if (players[socket.id]) {
            players[socket.id].dialogue = { text: message, timer: 240 };
            io.emit('update_players', players);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Oyuncu ayrıldı: ${socket.id}`);
        delete players[socket.id];
        io.emit('update_players', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Sevistia Multiplayer Sunucusu ${PORT} portunda çalışıyor!`);
});