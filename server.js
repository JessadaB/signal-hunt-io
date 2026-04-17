const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let players = {};
let pings = [];

// สร้างอาหารทิ้งไว้ 50 จุด
for(let i=0; i<50; i++) {
    pings.push({ id: i, x: Math.random() * 1500, y: Math.random() * 1000 });
}

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // สร้างตัวละครใหม่
    players[socket.id] = {
        x: 500,
        y: 500,
        r: 15,
        score: 0,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
    };

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            // ค่อยๆ ขยับตาม Mouse (Smooth interpolation)
            players[socket.id].x += (data.x - players[socket.id].x) * 0.1;
            players[socket.id].y += (data.y - players[socket.id].y) * 0.1;

            // ตรวจสอบการกินอาหาร (Pings)
            pings.forEach((p, index) => {
                let dist = Math.hypot(players[socket.id].x - p.x, players[socket.id].y - p.y);
                if (dist < players[socket.id].r) {
                    players[socket.id].score += 1;
                    players[socket.id].r += 0.2;
                    // ย้ายที่อาหาร
                    pings[index] = { id: index, x: Math.random() * 1500, y: Math.random() * 1000 };
                }
            });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// ส่งสถานะเกมให้ทุกคนทุกๆ 15ms (60 FPS)
setInterval(() => {
    io.emit('updateGameState', { players, pings });
}, 15);

const PORT = process.env.PORT || 3000; // ให้ใช้ Port ที่ Cloud กำหนดมา หรือถ้าไม่มีค่อยใช้ 3000
server.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
