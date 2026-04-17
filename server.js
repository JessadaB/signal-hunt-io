const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};
let pings = [];

// สร้างอาหาร 50 จุด
for(let i=0; i<50; i++) {
    pings.push({ id: i, x: Math.random() * 2000, y: Math.random() * 2000 });
}

io.on('connection', (socket) => {
    // รับข้อมูลเริ่มต้น (ชื่อ และ สี)
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Unknown",
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            r: 20,
            score: 0,
            color: data.color || "#00ff41"
        };
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;

            // 1. เช็กกินอาหาร
            pings.forEach((p, index) => {
                let dist = Math.hypot(players[socket.id].x - p.x, players[socket.id].y - p.y);
                if (dist < players[socket.id].r) {
                    players[socket.id].score += 10;
                    players[socket.id].r += 0.5;
                    pings[index] = { id: index, x: Math.random() * 2000, y: Math.random() * 2000 };
                }
            });

            // 2. Death Mechanic: เช็กการชนกันเอง
            for (let targetId in players) {
                if (targetId === socket.id) continue;
                let target = players[targetId];
                let dist = Math.hypot(players[socket.id].x - target.x, players[socket.id].y - target.y);

                // ถ้าชนกัน
                if (dist < players[socket.id].r + target.r) {
                    // ใครใหญ่กว่าคนนั้นรอด
                    if (players[socket.id].r > target.r * 1.1) { // ใหญ่กว่า 10% ถึงจะกินได้
                        players[socket.id].score += target.score / 2;
                        players[socket.id].r += target.r * 0.2;
                        io.to(targetId).emit('gameOver'); // ส่งสัญญาณบอกผู้ตาย
                        delete players[targetId];
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

// ส่งข้อมูล Game State และ Leaderboard
setInterval(() => {
    // จัดอันดับ Top 5
    let leaderboard = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: Math.floor(p.score) }));

    io.emit('updateGameState', { players, pings, leaderboard });
}, 15);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));