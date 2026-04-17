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
const MAP_SIZE = 3000; // ขนาดแผนที่กว้างใหญ่

// สร้างอาหาร 200 จุด กระจายทั่วแมพ
for(let i=0; i<200; i++) {
    pings.push({ id: i, x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE });
}

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || "User",
            deviceType: data.deviceType || "📱",
            skinUrl: data.skinUrl || "",
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            r: 30, // รัศมีเริ่มต้น
            score: 0,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
    });

    socket.on('playerMove', (data) => {
        const p = players[socket.id];
        if (p) {
            // คำนวณทิศทางจากตำแหน่งเม้าส์เทียบกับกึ่งกลางจอ
            const dx = data.mx - (data.viewW / 2);
            const dy = data.my - (data.viewH / 2);
            const angle = Math.atan2(dy, dx);
            
            // ยิ่งตัวใหญ่ ยิ่งช้าลง (Balance)
            const speed = Math.max(1.5, 5 - (p.r / 100)); 

            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;

            // กั้นขอบแมพ
            p.x = Math.max(0, Math.min(MAP_SIZE, p.x));
            p.y = Math.max(0, Math.min(MAP_SIZE, p.y));

            // ระบบขยายขนาดตัว: เริ่มที่ 30 และใหญ่ขึ้นตามคะแนน
            p.r = 30 + Math.sqrt(p.score) * 2;

            // เช็กการกินอาหาร
            pings.forEach((ping, index) => {
                let dist = Math.hypot(p.x - ping.x, p.y - ping.y);
                if (dist < p.r) {
                    p.score += 5;
                    pings[index] = { id: index, x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE };
                }
            });

            // Death Mechanic: การไล่กินผู้เล่นอื่น
            for (let targetId in players) {
                if (targetId === socket.id) continue;
                let target = players[targetId];
                let dist = Math.hypot(p.x - target.x, p.y - target.y);
                
                if (dist < p.r) {
                    // ต้องใหญ่กว่า 15% ถึงจะกินได้
                    if (p.r > target.r * 1.15) {
                        p.score += target.score + 50;
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
server.listen(PORT, () => console.log(`Game Server Running on Port ${PORT}`));