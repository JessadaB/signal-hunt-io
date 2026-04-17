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
const MAP_SIZE = 3000; // ขยายแผนที่ให้กว้างขึ้น

// สร้างอาหาร 150 จุดกระจายทั่วแมพกว้าง
for(let i=0; i<150; i++) {
    pings.push({ id: i, x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || "Unknown",
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            r: 30,
            score: 0,
            color: data.color || "#00ff41",
            skinUrl: data.skinUrl || "" // รับ URL ของรูปภาพจากหน้าแรก
        };
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            // ระบบเคลื่อนที่ตามทิศทางเม้าส์ในแมพกว้าง
            const dx = data.mx - (data.viewW / 2);
            const dy = data.my - (data.viewH / 2);
            const angle = Math.atan2(dy, dx);
            const speed = 4;

            players[socket.id].x += Math.cos(angle) * speed;
            players[socket.id].y += Math.sin(angle) * speed;

            // กั้นขอบแมพไม่ให้เดินทะลุออกไป
            players[socket.id].x = Math.max(0, Math.min(MAP_SIZE, players[socket.id].x));
            players[socket.id].y = Math.max(0, Math.min(MAP_SIZE, players[socket.id].y));

            // เช็กกินอาหาร
            pings.forEach((p, index) => {
                let dist = Math.hypot(players[socket.id].x - p.x, players[socket.id].y - p.y);
                if (dist < players[socket.id].r) {
                    players[socket.id].score += 10;
                    players[socket.id].r += 0.5;
                    pings[index] = { id: index, x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE };
                }
            });

            // Death Mechanic: ชนกันแล้วคนเล็กตาย
            for (let targetId in players) {
                if (targetId === socket.id) continue;
                let target = players[targetId];
                let dist = Math.hypot(players[socket.id].x - target.x, players[socket.id].y - target.y);
                if (dist < players[socket.id].r + target.r) {
                    if (players[socket.id].r > target.r * 1.1) {
                        players[socket.id].score += target.score / 2;
                        players[socket.id].r += target.r * 0.2;
                        io.to(targetId).emit('gameOver');
                        delete players[targetId];
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

setInterval(() => {
    let leaderboard = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: Math.floor(p.score) }));
    io.emit('updateGameState', { players, pings, leaderboard });
}, 15);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));