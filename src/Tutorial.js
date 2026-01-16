import { CONFIG } from './Config.js';
import { Player, TouhouPlayer } from './Player.js';
import { game } from './GameState.js';

// Tutorial state
const tutorial = {
    canvas: null,
    ctx: null,
    isActive: false,
    mode: 'dodge', // 'dodge' or 'touhou'
    animationId: null,
    player: null,
    obstacles: [],
    lastSpawnTime: 0,
};

// Scaled CONFIG for tutorial canvas
let tutorialConfig = {
    WIDTH: 400,
    HEIGHT: 300,
    PLAYER_SIZE: 25,
    PLAYER_Y_OFFSET: 50,
};

// Simple obstacle class for tutorial
class TutorialObstacle {
    constructor(x, y, mode, config) {
        this.x = x;
        this.y = y;
        this.mode = mode;
        this.config = config;

        if (mode === 'dodge') {
            this.width = 20;
            this.height = 25;
            this.speed = 2;
            this.char = ['花', '化', '闇'][Math.floor(Math.random() * 3)];
        } else {
            this.radius = 5;
            this.speed = 1.5;
            const angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        }
    }

    update() {
        if (this.mode === 'dodge') {
            this.y += this.speed;
        } else {
            this.x += this.vx;
            this.y += this.vy;
        }
    }

    isOffScreen() {
        if (this.mode === 'dodge') {
            return this.y > this.config.HEIGHT + 30;
        }
        return this.x < -15 || this.x > this.config.WIDTH + 15 ||
               this.y < -15 || this.y > this.config.HEIGHT + 15;
    }

    draw(ctx) {
        ctx.save();
        if (this.mode === 'dodge') {
            ctx.font = 'bold 18px "Noto Serif JP", serif';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.85)';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.char, this.x + this.width / 2, this.y + this.height / 2);
        } else {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.85)';
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// Wrapper to adapt Player class for tutorial canvas
function createTutorialDodgePlayer() {
    const player = new Player();
    // Override for tutorial scale
    player.size = tutorialConfig.PLAYER_SIZE;
    player.x = tutorialConfig.WIDTH / 2 - player.size / 2;
    player.y = tutorialConfig.HEIGHT - tutorialConfig.PLAYER_Y_OFFSET - player.size / 2;
    player.maxSpeed = 12;
    player.acceleration = 1.2;

    // Override update to use tutorial bounds
    const originalUpdate = player.update.bind(player);
    player.update = function() {
        if (this.movingLeft) this.velocity -= this.acceleration;
        if (this.movingRight) this.velocity += this.acceleration;
        if (!this.movingLeft && !this.movingRight) {
            this.velocity *= this.friction;
            if (Math.abs(this.velocity) < 0.1) this.velocity = 0;
        }
        this.velocity = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.velocity));
        this.x += this.velocity;
        if (this.x < 0) { this.x = 0; this.velocity = 0; }
        if (this.x > tutorialConfig.WIDTH - this.size) {
            this.x = tutorialConfig.WIDTH - this.size;
            this.velocity = 0;
        }
    };

    player.setPositionFromSlider = function(value) {
        this.x = (value / 100) * (tutorialConfig.WIDTH - this.size);
        this.velocity = 0;
    };

    return player;
}

// Wrapper to adapt TouhouPlayer class for tutorial canvas
function createTutorialTouhouPlayer() {
    const player = new TouhouPlayer();
    // Override for tutorial scale
    player.x = tutorialConfig.WIDTH / 2;
    player.y = tutorialConfig.HEIGHT * 0.6;
    player.speed = 4;
    player.focusSpeed = 1.5;
    player.visualRadius = 10;

    // Override update to use tutorial bounds
    player.update = function() {
        const currentSpeed = this.isFocused ? this.focusSpeed : this.speed;
        let dx = 0, dy = 0;
        if (this.movingLeft) dx -= 1;
        if (this.movingRight) dx += 1;
        if (this.movingUp) dy -= 1;
        if (this.movingDown) dy += 1;
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }
        this.x += dx * currentSpeed;
        this.y += dy * currentSpeed;
        const margin = this.visualRadius;
        this.x = Math.max(margin, Math.min(tutorialConfig.WIDTH - margin, this.x));
        this.y = Math.max(margin, Math.min(tutorialConfig.HEIGHT - margin, this.y));
    };

    player.setPosition = function(x, y) {
        const margin = this.visualRadius;
        this.x = Math.max(margin, Math.min(tutorialConfig.WIDTH - margin, x));
        this.y = Math.max(margin, Math.min(tutorialConfig.HEIGHT - margin, y));
    };

    return player;
}

// Draw background
function drawBackground(ctx) {
    ctx.fillStyle = 'rgba(8, 5, 5, 1)';
    ctx.fillRect(0, 0, tutorialConfig.WIDTH, tutorialConfig.HEIGHT);

    // Subtle grid
    ctx.strokeStyle = 'rgba(138, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < tutorialConfig.WIDTH; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, tutorialConfig.HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < tutorialConfig.HEIGHT; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(tutorialConfig.WIDTH, y);
        ctx.stroke();
    }

    // Slider line for dodge mode
    if (tutorial.mode === 'dodge') {
        const lineY = tutorialConfig.HEIGHT - tutorialConfig.PLAYER_Y_OFFSET;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.35)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(tutorialConfig.WIDTH, lineY);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

// Spawn obstacles
function spawnObstacle() {
    if (tutorial.mode === 'dodge') {
        const x = Math.random() * (tutorialConfig.WIDTH - 20);
        tutorial.obstacles.push(new TutorialObstacle(x, -30, 'dodge', tutorialConfig));
    } else {
        // Spawn from edges
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        switch (edge) {
            case 0: x = Math.random() * tutorialConfig.WIDTH; y = -10; break;
            case 1: x = Math.random() * tutorialConfig.WIDTH; y = tutorialConfig.HEIGHT + 10; break;
            case 2: x = -10; y = Math.random() * tutorialConfig.HEIGHT; break;
            default: x = tutorialConfig.WIDTH + 10; y = Math.random() * tutorialConfig.HEIGHT;
        }
        const obs = new TutorialObstacle(x, y, 'touhou', tutorialConfig);
        // Aim toward player
        const targetX = tutorial.player ? tutorial.player.x : tutorialConfig.WIDTH / 2;
        const targetY = tutorial.player ? tutorial.player.y : tutorialConfig.HEIGHT / 2;
        const angle = Math.atan2(targetY - y, targetX - x);
        obs.vx = Math.cos(angle) * obs.speed;
        obs.vy = Math.sin(angle) * obs.speed;
        tutorial.obstacles.push(obs);
    }
}

// Main loop
function tutorialLoop(timestamp) {
    if (!tutorial.isActive) return;

    const ctx = tutorial.ctx;

    // Temporarily set game.glowLevel and game.grazeCount for player draw
    const savedGlowLevel = game.glowLevel;
    const savedGrazeCount = game.grazeCount;
    game.glowLevel = 0;
    game.grazeCount = 0;

    drawBackground(ctx);

    // Spawn periodically
    const spawnInterval = tutorial.mode === 'dodge' ? 1200 : 600;
    if (timestamp - tutorial.lastSpawnTime > spawnInterval) {
        spawnObstacle();
        tutorial.lastSpawnTime = timestamp;
    }

    // Update and draw obstacles
    for (let i = tutorial.obstacles.length - 1; i >= 0; i--) {
        const obs = tutorial.obstacles[i];
        obs.update();
        obs.draw(ctx);
        if (obs.isOffScreen()) {
            tutorial.obstacles.splice(i, 1);
        }
    }

    // Update and draw player
    if (tutorial.player) {
        tutorial.player.update();
        tutorial.player.draw(ctx);
    }

    // Restore game state
    game.glowLevel = savedGlowLevel;
    game.grazeCount = savedGrazeCount;

    tutorial.animationId = requestAnimationFrame(tutorialLoop);
}

// Update hint text
function updateHint(mode) {
    const hint = document.getElementById('tutorialHint');
    if (!hint) return;
    if (mode === 'dodge') {
        hint.textContent = 'Use A/D, buttons, or slider to move!';
    } else {
        hint.textContent = 'Use WASD, buttons, or drag to move! SHIFT = focus';
    }
}

// Initialize
export function initTutorial() {
    tutorial.canvas = document.getElementById('tutorialCanvas');
    if (!tutorial.canvas) return;

    tutorial.ctx = tutorial.canvas.getContext('2d');

    // Tab switching
    const dodgeTab = document.getElementById('tutorialDodgeTab');
    const touhouTab = document.getElementById('tutorialTouhouTab');
    const dodgeInfo = document.getElementById('tutorialDodgeInfo');
    const touhouInfo = document.getElementById('tutorialTouhouInfo');
    const touchControls = document.getElementById('tutorialTouchControls');
    const slider = document.getElementById('tutorialSlider');

    if (dodgeTab) {
        dodgeTab.addEventListener('click', () => {
            tutorial.mode = 'dodge';
            tutorial.obstacles = [];
            tutorial.player = createTutorialDodgePlayer();

            dodgeTab.classList.add('active');
            touhouTab.classList.remove('active');
            dodgeInfo.classList.remove('hidden');
            touhouInfo.classList.add('hidden');
            if (touchControls) touchControls.classList.add('dodge-mode');
            if (slider) slider.classList.remove('hidden');
            updateHint('dodge');

            // Reset slider
            const playerSlider = document.getElementById('tutorialPlayerSlider');
            if (playerSlider) {
                playerSlider.value = 50;
                tutorial.player.setPositionFromSlider(50);
            }
        });
    }

    if (touhouTab) {
        touhouTab.addEventListener('click', () => {
            tutorial.mode = 'touhou';
            tutorial.obstacles = [];
            tutorial.player = createTutorialTouhouPlayer();

            touhouTab.classList.add('active');
            dodgeTab.classList.remove('active');
            touhouInfo.classList.remove('hidden');
            dodgeInfo.classList.add('hidden');
            if (touchControls) touchControls.classList.remove('dodge-mode');
            if (slider) slider.classList.add('hidden');
            updateHint('touhou');
        });
    }

    // Slider control
    const playerSlider = document.getElementById('tutorialPlayerSlider');
    if (playerSlider) {
        playerSlider.addEventListener('input', (e) => {
            if (tutorial.mode === 'dodge' && tutorial.player && tutorial.player.setPositionFromSlider) {
                tutorial.player.setPositionFromSlider(parseInt(e.target.value));
            }
        });
    }

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Touch button controls
    setupTouchButtons();

    // Drag controls for touhou
    setupDragControls();
}

function handleKeyDown(e) {
    if (!tutorial.isActive || !tutorial.player) return;

    const key = e.key.toLowerCase();

    if (tutorial.mode === 'dodge') {
        if (key === 'arrowleft' || key === 'a') {
            e.preventDefault();
            tutorial.player.movingLeft = true;
        } else if (key === 'arrowright' || key === 'd') {
            e.preventDefault();
            tutorial.player.movingRight = true;
        }
    } else {
        if (key === 'arrowleft' || key === 'a') {
            e.preventDefault();
            tutorial.player.movingLeft = true;
        } else if (key === 'arrowright' || key === 'd') {
            e.preventDefault();
            tutorial.player.movingRight = true;
        } else if (key === 'arrowup' || key === 'w') {
            e.preventDefault();
            tutorial.player.movingUp = true;
        } else if (key === 'arrowdown' || key === 's') {
            e.preventDefault();
            tutorial.player.movingDown = true;
        } else if (key === 'shift') {
            e.preventDefault();
            tutorial.player.isFocused = true;
        }
    }
}

function handleKeyUp(e) {
    if (!tutorial.isActive || !tutorial.player) return;

    const key = e.key.toLowerCase();

    if (key === 'arrowleft' || key === 'a') {
        tutorial.player.movingLeft = false;
    } else if (key === 'arrowright' || key === 'd') {
        tutorial.player.movingRight = false;
    } else if (key === 'arrowup' || key === 'w') {
        if (tutorial.player.movingUp !== undefined) tutorial.player.movingUp = false;
    } else if (key === 'arrowdown' || key === 's') {
        if (tutorial.player.movingDown !== undefined) tutorial.player.movingDown = false;
    } else if (key === 'shift') {
        if (tutorial.player.isFocused !== undefined) tutorial.player.isFocused = false;
    }
}

function setupTouchButtons() {
    const btnIds = {
        left: ['tutorialLeftBtn', 'tutorialLeftBtnLeft'],
        right: ['tutorialRightBtn', 'tutorialRightBtnLeft'],
        up: ['tutorialUpBtn', 'tutorialUpBtnLeft'],
        down: ['tutorialDownBtn', 'tutorialDownBtnLeft'],
    };

    Object.entries(btnIds).forEach(([dir, ids]) => {
        ids.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;

            const start = (e) => {
                if (e.cancelable) e.preventDefault();
                if (!tutorial.isActive || !tutorial.player) return;

                if (dir === 'left') tutorial.player.movingLeft = true;
                else if (dir === 'right') tutorial.player.movingRight = true;
                else if (dir === 'up' && tutorial.mode === 'touhou') tutorial.player.movingUp = true;
                else if (dir === 'down' && tutorial.mode === 'touhou') tutorial.player.movingDown = true;

                btn.classList.add('active');
            };

            const stop = (e) => {
                if (e.cancelable) e.preventDefault();
                if (!tutorial.player) return;

                if (dir === 'left') tutorial.player.movingLeft = false;
                else if (dir === 'right') tutorial.player.movingRight = false;
                else if (dir === 'up' && tutorial.player.movingUp !== undefined) tutorial.player.movingUp = false;
                else if (dir === 'down' && tutorial.player.movingDown !== undefined) tutorial.player.movingDown = false;

                btn.classList.remove('active');
            };

            btn.addEventListener('mousedown', start);
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('mouseup', stop);
            btn.addEventListener('touchend', stop);
            btn.addEventListener('mouseleave', stop);
        });
    });
}

function setupDragControls() {
    let isDragging = false;

    const getCoords = (clientX, clientY) => {
        const rect = tutorial.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (tutorialConfig.WIDTH / rect.width),
            y: (clientY - rect.top) * (tutorialConfig.HEIGHT / rect.height)
        };
    };

    const startDrag = (x, y) => {
        if (!tutorial.isActive || tutorial.mode !== 'touhou' || !tutorial.player) return;
        const dist = Math.sqrt(Math.pow(x - tutorial.player.x, 2) + Math.pow(y - tutorial.player.y, 2));
        if (dist < 35) isDragging = true;
    };

    const moveDrag = (x, y) => {
        if (!isDragging || !tutorial.player || tutorial.mode !== 'touhou') return;
        tutorial.player.setPosition(x, y);
    };

    const endDrag = () => { isDragging = false; };

    tutorial.canvas.addEventListener('mousedown', (e) => {
        const c = getCoords(e.clientX, e.clientY);
        startDrag(c.x, c.y);
    });
    tutorial.canvas.addEventListener('mousemove', (e) => {
        const c = getCoords(e.clientX, e.clientY);
        moveDrag(c.x, c.y);
    });
    tutorial.canvas.addEventListener('mouseup', endDrag);
    tutorial.canvas.addEventListener('mouseleave', endDrag);

    tutorial.canvas.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        const c = getCoords(e.touches[0].clientX, e.touches[0].clientY);
        startDrag(c.x, c.y);
    }, { passive: false });
    tutorial.canvas.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
        const c = getCoords(e.touches[0].clientX, e.touches[0].clientY);
        moveDrag(c.x, c.y);
    }, { passive: false });
    tutorial.canvas.addEventListener('touchend', endDrag);
    tutorial.canvas.addEventListener('touchcancel', endDrag);
}

export function startTutorial() {
    if (!tutorial.canvas) initTutorial();

    // Size canvas
    const container = tutorial.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    tutorialConfig.WIDTH = Math.floor(rect.width) || 400;
    tutorialConfig.HEIGHT = Math.floor(rect.height) || 300;
    tutorial.canvas.width = tutorialConfig.WIDTH;
    tutorial.canvas.height = tutorialConfig.HEIGHT;

    tutorialConfig.PLAYER_Y_OFFSET = Math.floor(tutorialConfig.HEIGHT * 0.15);
    tutorialConfig.PLAYER_SIZE = Math.floor(tutorialConfig.HEIGHT * 0.08);

    // Reset
    tutorial.obstacles = [];
    tutorial.lastSpawnTime = 0;
    tutorial.mode = 'dodge';

    // Reset tabs
    const dodgeTab = document.getElementById('tutorialDodgeTab');
    const touhouTab = document.getElementById('tutorialTouhouTab');
    const dodgeInfo = document.getElementById('tutorialDodgeInfo');
    const touhouInfo = document.getElementById('tutorialTouhouInfo');
    const touchControls = document.getElementById('tutorialTouchControls');
    const slider = document.getElementById('tutorialSlider');

    if (dodgeTab) dodgeTab.classList.add('active');
    if (touhouTab) touhouTab.classList.remove('active');
    if (dodgeInfo) dodgeInfo.classList.remove('hidden');
    if (touhouInfo) touhouInfo.classList.add('hidden');
    if (touchControls) touchControls.classList.add('dodge-mode');
    if (slider) slider.classList.remove('hidden');

    tutorial.player = createTutorialDodgePlayer();
    updateHint('dodge');

    // Sync slider with initial player position
    const playerSlider = document.getElementById('tutorialPlayerSlider');
    if (playerSlider) {
        playerSlider.value = 50;
        tutorial.player.setPositionFromSlider(50);
    }

    tutorial.isActive = true;
    tutorial.animationId = requestAnimationFrame(tutorialLoop);
}

export function stopTutorial() {
    tutorial.isActive = false;
    if (tutorial.animationId) {
        cancelAnimationFrame(tutorial.animationId);
        tutorial.animationId = null;
    }
    // Stop player movement
    if (tutorial.player) {
        tutorial.player.movingLeft = false;
        tutorial.player.movingRight = false;
        if (tutorial.player.movingUp !== undefined) tutorial.player.movingUp = false;
        if (tutorial.player.movingDown !== undefined) tutorial.player.movingDown = false;
    }
}

export { tutorial };
