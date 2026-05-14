const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");


// SESLER VE AYARLAR(ses nesne oluşturma)
const goldSound = new Audio("assets/sounds/gold.mp3"); goldSound.volume = 0.4;
const crashSound = new Audio("assets/sounds/hit.mp3"); crashSound.volume = 0.5;
const minerSound = new Audio("assets/sounds/miner.mp3"); minerSound.volume = 0.35;
const explosionSound = new Audio("rockbom.mp3"); explosionSound.volume = 0.5;
const bgMusic = new Audio("assets/sounds/arkaplan.mp3"); bgMusic.volume = 0.2; bgMusic.loop = true;
const moveSound = new Audio("assets/sounds/ray.mp3"); moveSound.volume = 0.10;

let moveSoundCooldown = 0;
let minerSoundCooldown = 0;


//GÖRSELLER(değişkene atama)

const images = {};
const assets = {
    bg: "assets/images/background2.png",
    player: "assets/images/wagon.png",
    railH: "assets/images/yatay.png",
    railV: "assets/images/dikey.png",
    railTL: "assets/images/sol_ust.png",
    railTR: "assets/images/sag_ust.png",
    railBL: "assets/images/sol_alt.png",
    railBR: "assets/images/sag_alt.png",
    rock: "assets/images/rock.png",
    gold: "assets/images/gold.jpeg",
    miner: "assets/images/miner.png",
    bomb: "assets/images/bomb.png" 
};

let loaded = 0;
let ready = false;
for (let k in assets) {
    images[k] = new Image();
    images[k].src = assets[k];
    images[k].onload = () => {
        loaded++;
        if (loaded === Object.keys(assets).length) ready = true;
    };
}

// OYUN DEĞİŞKENLERİ

const gridSize = 7;
let score = 0;
let gameOver = false;
let canMove = true;
const ENTITY = { NONE: 0, ROCK: 1, GOLD: 2, MINER: 3, BOMB: 4 };

let rails = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
let entities = Array.from({ length: gridSize }, () => Array(gridSize).fill(ENTITY.NONE));
let nextRowEntities = Array(gridSize).fill(ENTITY.NONE); 

let goldParticles = [];
let minerEffects = [];
let bombEffects = []; 
const GOLD_MOVE_INTERVAL = 600; 

const player = {
    x: Math.floor(gridSize / 2),
    y: gridSize - 2
};

// Başlangıç Rayı
function createRail() {
    return { up: false, right: false, down: false, left: false };
}
rails[player.x][player.y] = createRail();

// =====================
// FONKSİYONLAR
// =====================

function prepareNextRow() {
    for (let x = 0; x < gridSize; x++) {
        const r = Math.random();
        if (r < 0.12) nextRowEntities[x] = ENTITY.ROCK;
        else if (r < 0.22) nextRowEntities[x] = ENTITY.GOLD;
        else if (r < 0.27) nextRowEntities[x] = ENTITY.MINER;
        else if (r < 0.30) nextRowEntities[x] = ENTITY.BOMB; 
        else nextRowEntities[x] = ENTITY.NONE;
    }
}

// Dünyayı ilk doldurma
for (let y = 0; y < gridSize - 1; y++) {
    for (let x = 0; x < gridSize; x++) {
        const r = Math.random();
        if (r < 0.12) entities[x][y] = ENTITY.ROCK;
        else if (r < 0.22) entities[x][y] = ENTITY.GOLD;
        else if (r < 0.27) entities[x][y] = ENTITY.MINER;
        else if (r < 0.30) entities[x][y] = ENTITY.BOMB;
    }
}
prepareNextRow();

const opposite = { up: "down", down: "up", left: "right", right: "left" };
const dirDelta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Bomba Patlama Mekaniği (Kaya Başına +1 Puan Dahil)
function explodeAt(tx, ty) {
    explosionSound.currentTime = 0;
    explosionSound.play();
    bombEffects.push({ x: tx, y: ty, life: 600 });

    for (let x = tx - 1; x <= tx + 1; x++) {
        for (let y = ty - 1; y <= ty + 1; y++) {
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                if (entities[x][y] === ENTITY.GOLD) {
                    entities[x][y] = ENTITY.NONE;
                    score += 2; // Patlamayla toplanan altın
                } else if (entities[x][y] === ENTITY.BOMB && (x !== tx || y !== ty)) {
                    entities[x][y] = ENTITY.NONE;
                    explodeAt(x, y); // Zincirleme reaksiyon
                } else if (entities[x][y] === ENTITY.ROCK) {
                    entities[x][y] = ENTITY.NONE;
                    score += 1; // Patlayan her kaya için +1 puan
                }
            }
        }
    }
}

function checkRockBreak() {
    let brokenRocks = 0;
    const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const queue = [];

    for (let x = 0; x < gridSize; x++) {
        queue.push([x, 0], [x, gridSize - 1]);
    }
    for (let y = 0; y < gridSize; y++) {
        queue.push([0, y], [gridSize - 1, y]);
    }

    function canPass(x, y, nx, ny) {
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) return false;
        const dx = nx - x;
        const dy = ny - y;
        const r = rails[x][y];
        const nr = rails[nx][ny];
        if (!r && !nr) return true;
        if (dx === 1) return r?.right && nr?.left;
        if (dx === -1) return r?.left && nr?.right;
        if (dy === 1) return r?.down && nr?.up;
        if (dy === -1) return r?.up && nr?.down;
        return false;
    }

    while (queue.length) {
        const [x, y] = queue.shift();
        if (visited[x][y]) continue;
        visited[x][y] = true;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            if (canPass(x, y, x + dx, y + dy)) queue.push([x + dx, y + dy]);
        });
    }

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            if (!visited[x][y] && entities[x][y] === ENTITY.ROCK) {
                explosionSound.currentTime = 0;
                explosionSound.play();
                entities[x][y] = ENTITY.NONE;
                brokenRocks++;
                score += brokenRocks * 5;
            }
        }
    }
}

function stepGold(g) {
    g.justSpawned = false;
    if (g.dead) return;

    const rail = rails[g.x]?.[g.y];
    if (!rail) { g.dead = true; return; }

    const exits = ["up", "right", "down", "left"].filter(d => rail[d]);
    const forbidden = g.from;

    let dir = null;
    const straightDir = opposite[g.from]; 
    if (exits.includes(straightDir)) dir = straightDir;
    else dir = exits.find(d => d !== forbidden);

    if (!dir && exits.includes(forbidden)) dir = forbidden;
    if (!dir) { g.dead = true; return; }

    const [dx, dy] = dirDelta[dir];
    const nx = g.x + dx;
    const ny = g.y + dy;
    const nextRail = rails[nx]?.[ny];

    if (!nextRail || !nextRail[opposite[dir]]) {
        g.dead = true;
        return;
    }

    g.prevX = g.x; g.prevY = g.y;
    g.x = nx; g.y = ny;
    g.from = opposite[dir];
    g.steps++;

    let minerCount = 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([mdx, mdy]) => {
        const ax = g.x + mdx, ay = g.y + mdy;
        if (ax >= 0 && ay >= 0 && ax < gridSize && ay < gridSize && entities[ax][ay] === ENTITY.MINER) {
            minerCount++;
        }
    });

    if (minerCount > 0) {
        score += minerCount * 2;
        if (minerSoundCooldown <= 0) {
            minerSound.currentTime = 0; minerSound.play();
            minerSoundCooldown = 120;
        }
        minerEffects.push({ x: g.x, y: g.y, life: 500 });
    }
}

// =====================
// INPUT (KLAVYE)
// =====================
window.addEventListener("keydown", (e) => {
    if (bgMusic.paused) bgMusic.play();
    if (!ready || gameOver || !canMove) return;

    const px = player.x, py = player.y;
    if (e.code === "ArrowRight") player.x++;
    if (e.code === "ArrowLeft") player.x--;
    if (e.code === "ArrowUp") player.y--;
    if (e.code === "ArrowDown") player.y++;

    player.x = Math.max(0, Math.min(gridSize - 1, player.x));
    player.y = Math.max(0, Math.min(gridSize - 1, player.y));

    if (px === player.x && py === player.y) return;
    if (moveSoundCooldown <= 0) {
        moveSound.currentTime = 0; moveSound.play();
        moveSoundCooldown = 70;
    }

    let moveDir = player.x > px ? "right" : player.x < px ? "left" : player.y > py ? "down" : "up";
    const fromDir = opposite[moveDir];

    if (rails[player.x][player.y] && rails[player.x][player.y][fromDir]) {
        endGame(); return;
    }

    canMove = false;
    if (!rails[player.x][player.y]) rails[player.x][player.y] = createRail();
    const cur = rails[player.x][player.y], prev = rails[px][py];

    if (moveDir === "right") { cur.left = true; prev.right = true; }
    if (moveDir === "left") { cur.right = true; prev.left = true; }
    if (moveDir === "down") { cur.up = true; prev.down = true; }
    if (moveDir === "up") { cur.down = true; prev.up = true; }

    if (entities[player.x][player.y] === ENTITY.ROCK) { endGame(); return; }
    
    if (entities[player.x][player.y] === ENTITY.BOMB) {
        const bx = player.x, by = player.y;
        entities[bx][by] = ENTITY.NONE;
        explodeAt(bx, by);
    }
    
    if (entities[player.x][player.y] === ENTITY.GOLD) {
        goldSound.currentTime = 0; goldSound.play();
        entities[player.x][player.y] = ENTITY.NONE;
        score++;
        goldParticles.push({ x: px, y: py, prevX: px, prevY: py, from: moveDir, steps: 0, dead: false, justSpawned: true });
    }
    checkRockBreak();
});

window.addEventListener("keyup", () => canMove = true);

function endGame() {
    crashSound.currentTime = 0; crashSound.play();
    const fade = setInterval(() => {
        bgMusic.volume = Math.max(0, bgMusic.volume - 0.02);
        if (bgMusic.volume <= 0) { bgMusic.pause(); clearInterval(fade); }
    }, 30);
    gameOver = true;
}

// =====================
// UPDATE & DRAW
// =====================
let scrollProgress = 0;
const scrollDuration = 2000; 
let goldTimer = 0;

function update(dt) {
    if (gameOver) return;

    scrollProgress += dt / scrollDuration;

    if (scrollProgress >= 1) {
        for (let x = 0; x < gridSize; x++) {
            for (let y = gridSize - 1; y > 0; y--) {
                rails[x][y] = rails[x][y - 1];
                entities[x][y] = entities[x][y - 1];
            }
            entities[x][0] = nextRowEntities[x];
            rails[x][0] = null;
        }
        prepareNextRow();
        player.y++;
        goldParticles.forEach(g => { g.y++; g.prevY++; });
        minerEffects.forEach(e => e.y++);
        bombEffects.forEach(e => e.y++);
        if (player.y >= gridSize) endGame();
        scrollProgress = 0;
    }

    minerEffects.forEach(e => e.life -= dt);
    minerEffects = minerEffects.filter(e => e.life > 0);
    
    bombEffects.forEach(e => e.life -= dt);
    bombEffects = bombEffects.filter(e => e.life > 0);

    goldTimer += dt;
    minerSoundCooldown -= dt;
    moveSoundCooldown -= dt;
    if (goldTimer >= GOLD_MOVE_INTERVAL) {
        goldTimer = 0; goldParticles.forEach(stepGold);
        goldParticles = goldParticles.filter(g => !g.dead);
    }
    checkRockBreak();
}

function getRailSprite(r) {
    const { up, right, down, left } = r;
    if (left && right && !up && !down) return images.railH;
    if (up && down && !left && !right) return images.railV;
    if (up && right) return images.railBR;
    if (up && left) return images.railBL;
    if (down && right) return images.railTR;
    if (down && left) return images.railTL;
    return null;
}

function draw() {
    if (!ready) return;
    const tile = Math.min(canvas.width, canvas.height) / gridSize;
    const offX = (canvas.width - gridSize * tile) / 2;
    const baseY = (canvas.height - gridSize * tile) / 2;
    const scrollY = scrollProgress * tile;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(images.bg, offX, baseY + scrollY, gridSize * tile, gridSize * tile);
    ctx.drawImage(images.bg, offX, baseY + scrollY - (gridSize * tile), gridSize * tile, gridSize * tile);

    for (let x = 0; x < gridSize; x++) {
        for (let y = -1; y < gridSize; y++) {
            const px = offX + x * tile;
            const py = y === -1 ? baseY - tile + scrollY : baseY + y * tile + scrollY;
            let item = (y === -1) ? nextRowEntities[x] : entities[x][y];

            if (item === ENTITY.ROCK) ctx.drawImage(images.rock, px, py, tile, tile);
            if (item === ENTITY.GOLD) ctx.drawImage(images.gold, px, py, tile, tile);
            if (item === ENTITY.BOMB) ctx.drawImage(images.bomb, px, py, tile, tile);

            if (item === ENTITY.MINER) {
                const s = tile * 0.5;
                ctx.drawImage(images.miner, px - s/2, py - s/2, s, s);
            }

            if (y >= 0 && rails[x][y]) {
                const sprite = getRailSprite(rails[x][y]);
                if (sprite) ctx.drawImage(sprite, px, py, tile, tile);
            }
        }
    }

    goldParticles.forEach(g => {
        const mT = g.justSpawned ? 1 : goldTimer / GOLD_MOVE_INTERVAL;
        const rx = g.prevX + (g.x - g.prevX) * mT;
        const ry = g.prevY + (g.y - g.prevY) * mT;
        const s = tile * 0.7;
        const p = (tile - s) / 2;
        ctx.drawImage(images.gold, offX + rx * tile + p, baseY + ry * tile + p + scrollY, s, s);
    });

    minerEffects.forEach(e => {
        const t = e.life / 500;
        const cx = offX + e.x * tile + tile / 2;
        const cy = baseY + e.y * tile + tile / 2 + scrollY;
        ctx.beginPath();
        ctx.arc(cx, cy, tile * (0.2 + (1 - t) * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,215,0,${t})`; 
        ctx.lineWidth = 4; 
        ctx.stroke();
    });

    bombEffects.forEach(e => {
        const t = e.life / 600;
        const cx = offX + e.x * tile + tile / 2;
        const cy = baseY + e.y * tile + tile / 2 + scrollY;
        ctx.beginPath();
        ctx.arc(cx, cy, tile * 1.5 * (1 - t), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 69, 0, ${t * 0.5})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 0, ${t})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    ctx.drawImage(images.player, offX + player.x * tile, baseY + player.y * tile + scrollY, tile, tile);

    ctx.fillStyle = "white"; ctx.font = "bold 24px Arial"; ctx.textAlign = "left";
    ctx.fillText("Score: " + score, 20, 40);
    
    if (gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff3333"; ctx.font = "bold 72px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
        ctx.fillStyle = "white"; ctx.font = "bold 32px Arial";
        ctx.fillText("Final Score: " + score, canvas.width / 2, canvas.height / 2 + 60);
    }
}

let last = 0;
function loop(t) {
    const dt = t - last; last = t;
    update(dt); draw();
    requestAnimationFrame(loop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
loop(0);