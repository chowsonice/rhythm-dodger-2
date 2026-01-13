import { game } from './GameState.js';
import { settings } from './Settings.js';
import { CONFIG } from './Config.js';

// Offscreen canvas for high-performance pixelation
const pixelCanvas = document.createElement('canvas');
const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: false }); // Optimize for GPU drawing
const PIXEL_SIZE = 4; // Higher number = more pixelated

// Pre-rendered scanline pattern for performance
let scanlineCanvas = null;
function getScanlineCanvas(width, height) {
    if (!scanlineCanvas || scanlineCanvas.width !== width || scanlineCanvas.height !== height) {
        scanlineCanvas = document.createElement('canvas');
        scanlineCanvas.width = width;
        scanlineCanvas.height = height;
        const ctx = scanlineCanvas.getContext('2d');
        ctx.fillStyle = '#000';
        for (let y = 0; y < height; y += 4) {
            ctx.fillRect(0, y, width, 2);
        }
    }
    return scanlineCanvas;
}

// LightFlare class for collision effect
export class LightFlare {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.opacity = 0;
        this.maxOpacity = 1.0;
        this.fadeInSpeed = 0.25; // Faster fade in
        this.fadeOutSpeed = 0.15; // Much faster fade out to reduce lag
        this.phase = 'fadeIn'; // 'fadeIn' or 'fadeOut'
        this.size = 180; // Slightly smaller size
        this.glowHeight = 250; // Reduced glow height
        this.glowWidth = 70; // Reduced glow width
    }

    update() {
        if (this.phase === 'fadeIn') {
            this.opacity += this.fadeInSpeed;
            if (this.opacity >= this.maxOpacity) {
                this.opacity = this.maxOpacity;
                this.phase = 'fadeOut';
            }
        } else if (this.phase === 'fadeOut') {
            this.opacity -= this.fadeOutSpeed;
            if (this.opacity <= 0) {
                this.opacity = 0;
            }
        }
    }

    draw(ctx) {
        if (this.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        if (game.lightFlareImage && game.lightFlareImage.complete) {
            // Draw the upward glow effect first (behind the main flare)
            // Stretch the image vertically upward
            const glowX = this.x - this.glowWidth / 2;
            const glowY = this.y - this.glowHeight / 2 - 25;
            ctx.drawImage(game.lightFlareImage, glowX, glowY, this.glowWidth, this.glowHeight);

            // Draw the main light flare image centered at the collision point
            const drawX = this.x - this.size / 2;
            const drawY = this.y - this.size / 2;
            ctx.drawImage(game.lightFlareImage, drawX, drawY, this.size, this.size);
        } else {
            // Fallback: Draw upward glow gradient
            const glowGradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y - this.glowHeight);
            glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            glowGradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.5)');
            glowGradient.addColorStop(0.7, 'rgba(255, 150, 50, 0.2)');
            glowGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.moveTo(this.x - this.glowWidth / 2, this.y);
            ctx.lineTo(this.x - this.glowWidth / 4, this.y - this.glowHeight);
            ctx.lineTo(this.x + this.glowWidth / 4, this.y - this.glowHeight);
            ctx.lineTo(this.x + this.glowWidth / 2, this.y);
            ctx.closePath();
            ctx.fill();

            // Fallback: Draw a radial gradient flare
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size / 2);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)');
            gradient.addColorStop(0.6, 'rgba(255, 150, 50, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    isDead() {
        return this.phase === 'fadeOut' && this.opacity <= 0;
    }
}

// Particle class for visual effects
export class Particle {
    static pool = [];

    static get(x, y) {
        if (Particle.pool.length > 0) {
            const particle = Particle.pool.pop();
            particle.reset(x, y);
            return particle;
        }
        return new Particle(x, y);
    }

    static release(particle) {
        Particle.pool.push(particle);
    }

    constructor(x, y) {
        this.reset(x, y);
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.decay = 0.02;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.life})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    isDead() {
        return this.life <= 0;
    }
}

// Create particles
export function createParticles(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        game.particles.push(Particle.get(x, y));
    }
}

// Helper to apply the Nightcord style to the background video
function applyNightcordStyle(ctx, videoElement) {
    if (!videoElement || videoElement.paused || videoElement.ended) return;

    // 1. Pixelation Step (GPU optimized via drawImage scaling)
    // Draw small to offscreen canvas
    const w = CONFIG.WIDTH;
    const h = CONFIG.HEIGHT;
    const sw = Math.ceil(w / PIXEL_SIZE);
    const sh = Math.ceil(h / PIXEL_SIZE);

    pixelCanvas.width = sw;
    pixelCanvas.height = sh;

    // Draw video tiny (forces pixelation)
    pixelCtx.drawImage(videoElement, 0, 0, sw, sh);

    ctx.save();
    // Disable smoothing when scaling back up to keep sharp pixels
    ctx.imageSmoothingEnabled = false;

    // Draw the pixelated video to main canvas
    ctx.drawImage(pixelCanvas, 0, 0, sw, sh, 0, 0, w, h);

    // 2. Apply Red Tint & High Contrast (using blending modes)
    ctx.globalCompositeOperation = 'multiply'; // Darkens
    ctx.fillStyle = '#8a0000'; // Nightcord Red
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighten'; // Adds the red back to bright areas
    ctx.fillStyle = '#ff3333';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, w, h);

    // 3. Scanlines - use pre-rendered pattern for performance
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(getScanlineCanvas(w, h), 0, 0);

    ctx.restore();
}

// Draw background
export function drawBackground(ctx, currentTime = 0) {
    // Check if in Fever Mode (glowLevel > 1.5)
    if (game.glowLevel > 1.5 && game.bgVideo && settings.bgVideoEnabled) {
        // Clear opaque black first
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Draw stylised video frame manually
        applyNightcordStyle(ctx, game.bgVideo);
    } else {
        // Normal mode: Clear canvas to transparent so standard video shows through
        ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    // Special Staged Stagelight Effect (1:10 - 1:21+)
    // 70000ms - 82000ms (Extended to allow exit flicker)
    if (currentTime >= 70000 && currentTime <= 82000 && settings.vfxEnabled) {
        // Draw standard stage lights behind the "curtains"
        drawStageLights(ctx);
        drawStagedStagelight(ctx, currentTime);
    } else {
        // Draw stage lights from top corners
        drawStageLights(ctx);
    }
}

// Staged Stagelight Effect (1:10 - 1:21) - styled like implemented stagelights
function drawStagedStagelight(ctx, currentTime) {
    const timeInSeconds = currentTime / 1000;
    const w = CONFIG.WIDTH;
    const h = CONFIG.HEIGHT;

    // Define States (original movement)
    // Left Leaning (Screen 1 & 3) /|
    const stateLeft = {
        topLeft: 0.35 * w,
        topRight: 0.65 * w,
        bottomLeft: 0.05 * w,
        bottomRight: 0.55 * w
    };

    // Right Leaning (Screen 2 & 4) |\
    const stateRight = {
        topLeft: 0.35 * w,
        topRight: 0.65 * w,
        bottomLeft: 0.45 * w,
        bottomRight: 0.95 * w
    };

    // Interpolation vars
    let currentTopLeft, currentTopRight, currentBottomLeft, currentBottomRight;
    let flickerOpacity = 1.0;

    // Timeline Logic (original)
    if (timeInSeconds < 71.0) {
        // 70-71: Entrance Flicker -> Transition to State Left
        currentTopLeft = stateLeft.topLeft;
        currentTopRight = stateLeft.topRight;
        currentBottomLeft = stateLeft.bottomLeft;
        currentBottomRight = stateLeft.bottomRight;

        // Rapid strobe flicker
        flickerOpacity = Math.floor(currentTime / 50) % 2 === 0 ? 1.0 : 0.0;
    }
    else if (timeInSeconds < 72.0) {
        // 71-72: Hold Screen 1 (Left)
        currentTopLeft = stateLeft.topLeft;
        currentTopRight = stateLeft.topRight;
        currentBottomLeft = stateLeft.bottomLeft;
        currentBottomRight = stateLeft.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 73.0) {
        // 72-73: Swing Left -> Right
        const t = (timeInSeconds - 72.0) / 1.0;
        const ease = t * t * (3 - 2 * t); // Smoothstep

        currentTopLeft = lerp(stateLeft.topLeft, stateRight.topLeft, ease);
        currentTopRight = lerp(stateLeft.topRight, stateRight.topRight, ease);
        currentBottomLeft = lerp(stateLeft.bottomLeft, stateRight.bottomLeft, ease);
        currentBottomRight = lerp(stateLeft.bottomRight, stateRight.bottomRight, ease);
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 75.0) {
        // 73-75: Hold Screen 2 (Right)
        currentTopLeft = stateRight.topLeft;
        currentTopRight = stateRight.topRight;
        currentBottomLeft = stateRight.bottomLeft;
        currentBottomRight = stateRight.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 76.0) {
        // 75-76: Swing Right -> Left
        const t = (timeInSeconds - 75.0) / 1.0;
        const ease = t * t * (3 - 2 * t);

        currentTopLeft = lerp(stateRight.topLeft, stateLeft.topLeft, ease);
        currentTopRight = lerp(stateRight.topRight, stateLeft.topRight, ease);
        currentBottomLeft = lerp(stateRight.bottomLeft, stateLeft.bottomLeft, ease);
        currentBottomRight = lerp(stateRight.bottomRight, stateLeft.bottomRight, ease);
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 78.0) {
        // 76-78: Hold Screen 3 (Left)
        currentTopLeft = stateLeft.topLeft;
        currentTopRight = stateLeft.topRight;
        currentBottomLeft = stateLeft.bottomLeft;
        currentBottomRight = stateLeft.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 79.0) {
        // 78-79: Swing Left -> Right
        const t = (timeInSeconds - 78.0) / 1.0;
        const ease = t * t * (3 - 2 * t);

        currentTopLeft = lerp(stateLeft.topLeft, stateRight.topLeft, ease);
        currentTopRight = lerp(stateLeft.topRight, stateRight.topRight, ease);
        currentBottomLeft = lerp(stateLeft.bottomLeft, stateRight.bottomLeft, ease);
        currentBottomRight = lerp(stateLeft.bottomRight, stateRight.bottomRight, ease);
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 81.0) {
        // 79-81: Hold Screen 4 (Right)
        currentTopLeft = stateRight.topLeft;
        currentTopRight = stateRight.topRight;
        currentBottomLeft = stateRight.bottomLeft;
        currentBottomRight = stateRight.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 82.0) {
        // 81-82: Exit Flicker (Right)
        currentTopLeft = stateRight.topLeft;
        currentTopRight = stateRight.topRight;
        currentBottomLeft = stateRight.bottomLeft;
        currentBottomRight = stateRight.bottomRight;

        // Rapid strobe to exit
        const strobe = Math.floor(currentTime / 50) % 2 === 0 ? 1 : 0;
        flickerOpacity = strobe * 1.0;
    } else {
        flickerOpacity = 0;
    }

    if (flickerOpacity <= 0.01) return;

    // Dynamic color based on glow level (same as implemented stagelights)
    let r, g, b;
    if (game.glowLevel > 1.5) {
        // Fever mode: cyan/blue
        r = 50;
        g = 150 + Math.floor(Math.sin(Date.now() * 0.002) * 50);
        b = 255;
    } else if (game.glowLevel > 0.5) {
        // Build-up mode: blend from red to purple/blue
        const blend = (game.glowLevel - 0.5) * 2;
        r = Math.floor(255 * (1 - blend * 0.5));
        g = Math.floor(100 * blend);
        b = Math.floor(200 * blend);
    } else {
        // Normal mode: dark red/black
        r = game.stageLightColor === 'darkred' ? 255 : 0;
        g = 0;
        b = 0;
    }

    const intensity = game.stageLightIntensity || 1.0;
    const opacityMultiplier = 1 + game.glowLevel * 0.3;

    ctx.save();

    // Draw the light beam first (the lit trapezoid area in the center)
    ctx.filter = 'blur(8px)';

    // Calculate center points for gradient
    const topCenterX = (currentTopLeft + currentTopRight) / 2;
    const bottomCenterX = (currentBottomLeft + currentBottomRight) / 2;

    // Create gradient from top to bottom of the beam
    const beamGradient = ctx.createLinearGradient(topCenterX, 0, bottomCenterX, h);
    beamGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.3 * intensity * opacityMultiplier * flickerOpacity})`);
    beamGradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${0.2 * intensity * opacityMultiplier * flickerOpacity})`);
    beamGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    // Draw the spotlight beam (simple trapezoid, no edges)
    ctx.fillStyle = beamGradient;
    ctx.beginPath();
    ctx.moveTo(currentTopLeft, 0);
    ctx.lineTo(currentTopRight, 0);
    ctx.lineTo(currentBottomRight, h);
    ctx.lineTo(currentBottomLeft, h);
    ctx.closePath();
    ctx.fill();

    ctx.filter = 'none';

    // Draw the dark panels (left and right) - solid black to completely obscure
    ctx.fillStyle = `rgba(0, 0, 0, ${flickerOpacity})`;

    // Draw Left Panel (Obscures left side completely)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(currentTopLeft, 0);
    ctx.lineTo(currentBottomLeft, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Draw Right Panel (Obscures right side completely)
    ctx.beginPath();
    ctx.moveTo(currentTopRight, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(currentBottomRight, h);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// Draw the dark obscuring panels for staged stagelight (called after player/notes to obscure them)
export function drawStagedStagelightOverlay(ctx, currentTime) {
    if (!settings.vfxEnabled) return;

    // Only active during 70000ms - 82000ms
    if (currentTime < 70000 || currentTime > 82000) return;

    const timeInSeconds = currentTime / 1000;
    const w = CONFIG.WIDTH;
    const h = CONFIG.HEIGHT;

    // Define States (same as drawStagedStagelight)
    const stateLeft = {
        topLeft: 0.35 * w,
        topRight: 0.65 * w,
        bottomLeft: 0.05 * w,
        bottomRight: 0.55 * w
    };

    const stateRight = {
        topLeft: 0.35 * w,
        topRight: 0.65 * w,
        bottomLeft: 0.45 * w,
        bottomRight: 0.95 * w
    };

    let currentTopLeft, currentTopRight, currentBottomLeft, currentBottomRight;
    let flickerOpacity = 1.0;

    // Timeline Logic (same as drawStagedStagelight)
    if (timeInSeconds < 71.0) {
        currentTopLeft = stateLeft.topLeft;
        currentTopRight = stateLeft.topRight;
        currentBottomLeft = stateLeft.bottomLeft;
        currentBottomRight = stateLeft.bottomRight;
        flickerOpacity = Math.floor(currentTime / 50) % 2 === 0 ? 1.0 : 0.0;
    }
    else if (timeInSeconds < 72.0) {
        currentTopLeft = stateLeft.topLeft;
        currentTopRight = stateLeft.topRight;
        currentBottomLeft = stateLeft.bottomLeft;
        currentBottomRight = stateLeft.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 73.0) {
        const t = (timeInSeconds - 72.0) / 1.0;
        const ease = t * t * (3 - 2 * t);
        currentTopLeft = lerp(stateLeft.topLeft, stateRight.topLeft, ease);
        currentTopRight = lerp(stateLeft.topRight, stateRight.topRight, ease);
        currentBottomLeft = lerp(stateLeft.bottomLeft, stateRight.bottomLeft, ease);
        currentBottomRight = lerp(stateLeft.bottomRight, stateRight.bottomRight, ease);
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 75.0) {
        currentTopLeft = stateRight.topLeft;
        currentTopRight = stateRight.topRight;
        currentBottomLeft = stateRight.bottomLeft;
        currentBottomRight = stateRight.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 76.0) {
        const t = (timeInSeconds - 75.0) / 1.0;
        const ease = t * t * (3 - 2 * t);
        currentTopLeft = lerp(stateRight.topLeft, stateLeft.topLeft, ease);
        currentTopRight = lerp(stateRight.topRight, stateLeft.topRight, ease);
        currentBottomLeft = lerp(stateRight.bottomLeft, stateLeft.bottomLeft, ease);
        currentBottomRight = lerp(stateRight.bottomRight, stateLeft.bottomRight, ease);
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 78.0) {
        currentTopLeft = stateLeft.topLeft;
        currentTopRight = stateLeft.topRight;
        currentBottomLeft = stateLeft.bottomLeft;
        currentBottomRight = stateLeft.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 79.0) {
        const t = (timeInSeconds - 78.0) / 1.0;
        const ease = t * t * (3 - 2 * t);
        currentTopLeft = lerp(stateLeft.topLeft, stateRight.topLeft, ease);
        currentTopRight = lerp(stateLeft.topRight, stateRight.topRight, ease);
        currentBottomLeft = lerp(stateLeft.bottomLeft, stateRight.bottomLeft, ease);
        currentBottomRight = lerp(stateLeft.bottomRight, stateRight.bottomRight, ease);
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 81.0) {
        currentTopLeft = stateRight.topLeft;
        currentTopRight = stateRight.topRight;
        currentBottomLeft = stateRight.bottomLeft;
        currentBottomRight = stateRight.bottomRight;
        flickerOpacity = 1.0;
    }
    else if (timeInSeconds < 82.0) {
        currentTopLeft = stateRight.topLeft;
        currentTopRight = stateRight.topRight;
        currentBottomLeft = stateRight.bottomLeft;
        currentBottomRight = stateRight.bottomRight;
        const strobe = Math.floor(currentTime / 50) % 2 === 0 ? 1 : 0;
        flickerOpacity = strobe * 1.0;
    } else {
        flickerOpacity = 0;
    }

    if (flickerOpacity <= 0.01) return;

    ctx.save();

    // Draw semi-transparent dark panels to obscure notes and player
    // Use blur to soften the edges
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = `rgba(0, 0, 0, ${flickerOpacity * 0.9})`;

    // Draw Left Panel
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(currentTopLeft, 0);
    ctx.lineTo(currentBottomLeft, h);
    ctx.lineTo(-10, h);
    ctx.closePath();
    ctx.fill();

    // Draw Right Panel
    ctx.beginPath();
    ctx.moveTo(currentTopRight, 0);
    ctx.lineTo(w + 10, 0);
    ctx.lineTo(w + 10, h);
    ctx.lineTo(currentBottomRight, h);
    ctx.closePath();
    ctx.fill();

    ctx.filter = 'none';
    ctx.restore();
}

// Floating particle class for fever mode ambiance
export class FloatingParticle {
    constructor() {
        this.active = false;
        this.reset();
        // Start at random Y position for initial spawn
        this.y = Math.random() * CONFIG.HEIGHT;
    }

    reset() {
        this.x = Math.random() * CONFIG.WIDTH;
        this.y = CONFIG.HEIGHT + 20;
        this.size = 2 + Math.random() * 4;
        this.speed = 0.5 + Math.random() * 1.5;
        this.wobbleSpeed = 0.02 + Math.random() * 0.03;
        this.wobbleAmount = 20 + Math.random() * 30;
        this.wobbleOffset = Math.random() * Math.PI * 2;
        this.alpha = 0.3 + Math.random() * 0.5;
        this.hue = 180 + Math.random() * 60; // Cyan to blue range
        this.active = true;
    }

    deactivate() {
        this.active = false;
    }

    update(deltaTime, glowLevel) {
        this.y -= this.speed * (1 + glowLevel * 0.5);
        this.x += Math.sin(this.y * this.wobbleSpeed + this.wobbleOffset) * 0.5;

        if (this.y < -20) {
            this.reset();
        }
    }

    draw(ctx, glowLevel) {
        const effectiveAlpha = this.alpha * Math.min(1, glowLevel);
        ctx.save();
        ctx.globalAlpha = effectiveAlpha;
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsla(${this.hue}, 80%, 70%, ${effectiveAlpha})`;
        ctx.fillStyle = `hsla(${this.hue}, 80%, 80%, ${effectiveAlpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Pre-allocated particle pool for performance (avoid GC during gameplay)
const MAX_FLOATING_PARTICLES = 35; // Capped for performance
const particlePool = [];
for (let i = 0; i < MAX_FLOATING_PARTICLES; i++) {
    particlePool.push(new FloatingParticle());
}

// Update floating particles system
export function updateFloatingParticles() {
    // Target particle count based on glow level (capped at MAX)
    const targetCount = Math.min(MAX_FLOATING_PARTICLES, Math.floor(game.glowLevel * 25));

    // Activate/deactivate particles from pool
    for (let i = 0; i < particlePool.length; i++) {
        const particle = particlePool[i];
        if (i < targetCount) {
            if (!particle.active) {
                particle.reset();
            }
            particle.update(16, game.glowLevel);
        } else {
            particle.deactivate();
        }
    }

    // Store active count for drawing instead of creating a new array
    game.floatingParticleCount = targetCount;
}

// Draw floating particles
export function drawFloatingParticles(ctx) {
    if (!settings.vfxEnabled || game.glowLevel < 0.3) return;

    // Iterate directly over pool using the count instead of a filtered array
    const count = game.floatingParticleCount || 0;
    for (let i = 0; i < count; i++) {
        const particle = particlePool[i];
        if (particle.active) {
            particle.draw(ctx, game.glowLevel);
        }
    }
}

// Update player trail effect
export function updatePlayerTrail() {
    if (!game.player || game.glowLevel < 0.5) {
        game.playerTrail = [];
        return;
    }

    // Add current position to trail
    const trailLength = Math.floor(5 + game.glowLevel * 10); // More trail at higher glow
    game.playerTrail.unshift({
        x: game.player.x + game.player.size / 2,
        y: game.player.y + game.player.size / 2,
        alpha: 1
    });

    // Limit trail length
    while (game.playerTrail.length > trailLength) {
        game.playerTrail.pop();
    }

    // Fade out trail points
    for (let i = 0; i < game.playerTrail.length; i++) {
        game.playerTrail[i].alpha = 1 - (i / game.playerTrail.length);
    }
}

// Draw player trail effect
export function drawPlayerTrail(ctx) {
    if (!settings.vfxEnabled || game.playerTrail.length < 2) return;

    ctx.save();

    // Get glow color based on level
    const glowColors = [
        { r: 200, g: 220, b: 255 },  // Level 0: white-blue
        { r: 255, g: 215, b: 100 },  // Level 1: gold
        { r: 100, g: 200, b: 255 }   // Level 2: cyan
    ];
    const colorIndex = Math.min(2, Math.floor(game.glowLevel));
    const color = glowColors[colorIndex];

    for (let i = 1; i < game.playerTrail.length; i++) {
        const point = game.playerTrail[i];
        const size = (game.player.size / 4) * point.alpha * game.glowLevel;
        const alpha = point.alpha * 0.4 * game.glowLevel;

        ctx.shadowBlur = 20 * point.alpha;
        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// Draw fever overlay effect (screen-wide glow)
export function drawFeverOverlay(ctx) {
    if (!settings.vfxEnabled || game.screenPulse < 0.05) return;

    ctx.save();

    // Radial gradient from bottom center (where player is)
    const gradient = ctx.createRadialGradient(
        CONFIG.WIDTH / 2, CONFIG.HEIGHT, 0,
        CONFIG.WIDTH / 2, CONFIG.HEIGHT, CONFIG.HEIGHT * 1.2
    );

    // Color based on glow level
    const pulseAlpha = game.screenPulse * 0.15;
    if (game.glowLevel > 1.5) {
        // Fever mode: cyan/blue
        gradient.addColorStop(0, `rgba(100, 200, 255, ${pulseAlpha * 1.5})`);
        gradient.addColorStop(0.4, `rgba(80, 150, 255, ${pulseAlpha})`);
        gradient.addColorStop(1, 'rgba(50, 100, 200, 0)');
    } else {
        // Build-up mode: warm gold
        gradient.addColorStop(0, `rgba(255, 200, 100, ${pulseAlpha})`);
        gradient.addColorStop(0.4, `rgba(255, 180, 80, ${pulseAlpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(200, 150, 50, 0)');
    }

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // Add vignette effect that lightens during fever
    if (game.glowLevel > 1) {
        const vignetteGradient = ctx.createRadialGradient(
            CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.3,
            CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.8
        );
        const vignetteAlpha = (game.glowLevel - 1) * 0.1;
        vignetteGradient.addColorStop(0, `rgba(255, 255, 255, ${vignetteAlpha})`);
        vignetteGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    ctx.restore();
}

// Update CSS classes for fever/buildup visual effects on game container
export function updateFeverModeClasses() {
    const container = document.getElementById('game-container');
    if (!container) return;

    // Remove existing mode classes
    container.classList.remove('fever-mode', 'buildup-mode');

    // Add appropriate class based on glow level
    if (game.glowLevel > 1.5) {
        container.classList.add('fever-mode');
    } else if (game.glowLevel > 0.5) {
        container.classList.add('buildup-mode');
    }
}

// Stage light rendering optimization - render to offscreen canvas every 2nd frame
let stageLightCache = null;
let stageLightFrameCount = 0;
let lastStageLightIntensity = 0;
let lastStageLightRotation = 0;

// Temporary canvas for unblurred rays (blur applied once at the end)
let stageLightTempCanvas = null;
let stageLightTempCtx = null;

// Draw stage lights effect with multiple rays
export function drawStageLights(ctx) {
    if (!settings.vfxEnabled) return;

    stageLightFrameCount++;

    // Check if we need to re-render the stage lights
    const intensityChanged = Math.abs(game.stageLightIntensity - lastStageLightIntensity) > 0.1;
    const shouldRender = stageLightFrameCount % 2 === 0 || intensityChanged || !stageLightCache;

    if (shouldRender) {
        // Create or reuse offscreen canvas
        if (!stageLightCache) {
            stageLightCache = document.createElement('canvas');
            stageLightCache.width = CONFIG.WIDTH;
            stageLightCache.height = CONFIG.HEIGHT;
        }

        const cacheCtx = stageLightCache.getContext('2d');
        cacheCtx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Render stage lights to cache
        renderStageLightsToContext(cacheCtx);

        lastStageLightIntensity = game.stageLightIntensity;
        lastStageLightRotation = game.stageLightRotation;
    }

    // Draw cached stage lights
    if (stageLightCache) {
        ctx.drawImage(stageLightCache, 0, 0);
    }
}

// Internal function to render stage lights to a context
function renderStageLightsToContext(ctx) {
    // Initialize or reuse temp canvas for unblurred rays
    if (!stageLightTempCanvas) {
        stageLightTempCanvas = document.createElement('canvas');
        stageLightTempCanvas.width = CONFIG.WIDTH;
        stageLightTempCanvas.height = CONFIG.HEIGHT;
        stageLightTempCtx = stageLightTempCanvas.getContext('2d');
    }

    // Clear temp canvas
    stageLightTempCtx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    stageLightTempCtx.save();

    // Intensity multiplier for brightness - enhanced by glow level
    const baseIntensity = game.stageLightIntensity;
    const glowBoost = 1 + game.glowLevel * 0.5;
    const intensity = baseIntensity * glowBoost;

    // Number of rays from each corner - more rays at higher glow levels (capped for performance)
    const raysPerSide = Math.min(7, 5 + Math.floor(game.glowLevel * 2));

    // Get current rotation - faster at higher glow levels
    const rotation = game.stageLightRotation;

    // Helper function to draw a single light cone ray (WITHOUT blur - blur applied once at end)
    function drawRay(originX, originY, angle, length) {
        const rayStartWidth = 50 + game.glowLevel * 10; // Wider at higher glow
        const rayEndWidth = 200 + game.glowLevel * 50; // Wider spread at higher glow

        // Dynamic color based on glow level
        let r, g, b;
        if (game.glowLevel > 1.5) {
            // Fever mode: cyan/blue rays
            r = 50;
            g = 150 + Math.floor(Math.sin(Date.now() * 0.002) * 50);
            b = 255;
        } else if (game.glowLevel > 0.5) {
            // Build-up mode: blend from red to purple/blue
            const blend = (game.glowLevel - 0.5) * 2;
            r = Math.floor(255 * (1 - blend * 0.5));
            g = Math.floor(100 * blend);
            b = Math.floor(200 * blend);
        } else {
            // Normal mode: dark red/black
            r = game.stageLightColor === 'darkred' ? 255 : 0;
            g = 0;
            b = 0;
        }

        // Calculate the end point of the ray
        const endX = originX + Math.cos(angle) * length;
        const endY = originY + Math.sin(angle) * length;

        // Calculate perpendicular angle for width
        const perpAngle = angle + Math.PI / 2;

        // Start points (narrow at origin)
        const startHalfWidth = rayStartWidth / 2;
        const startLeftX = originX + Math.cos(perpAngle) * startHalfWidth;
        const startLeftY = originY + Math.sin(perpAngle) * startHalfWidth;
        const startRightX = originX - Math.cos(perpAngle) * startHalfWidth;
        const startRightY = originY - Math.sin(perpAngle) * startHalfWidth;

        // End points (wide at end)
        const endHalfWidth = rayEndWidth / 2;
        const endLeftX = endX + Math.cos(perpAngle) * endHalfWidth;
        const endLeftY = endY + Math.sin(perpAngle) * endHalfWidth;
        const endRightX = endX - Math.cos(perpAngle) * endHalfWidth;
        const endRightY = endY - Math.sin(perpAngle) * endHalfWidth;

        // Create gradient along the ray - enhanced opacity at higher glow levels
        const opacityMultiplier = 1 + game.glowLevel * 0.3;
        const gradient = stageLightTempCtx.createLinearGradient(originX, originY, endX, endY);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.15 * intensity * opacityMultiplier})`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${0.1 * intensity * opacityMultiplier})`);
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${0.05 * intensity * opacityMultiplier})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        // Draw ray WITHOUT blur (blur applied once at end for performance)
        stageLightTempCtx.fillStyle = gradient;
        stageLightTempCtx.beginPath();
        stageLightTempCtx.moveTo(startLeftX, startLeftY);
        stageLightTempCtx.lineTo(endLeftX, endLeftY);
        stageLightTempCtx.lineTo(endRightX, endRightY);
        stageLightTempCtx.lineTo(startRightX, startRightY);
        stageLightTempCtx.closePath();
        stageLightTempCtx.fill();
    }

    // Left corner setup
    const leftCenterX = 50;
    const leftCenterY = -150; // Moved up to hide origin points
    const arcRadius = 80; // Radius of the arc where ray origins are placed
    const rayLength = CONFIG.HEIGHT * 1.2; // Extended length to cover screen

    // Dynamically generate arc angles based on raysPerSide
    // Evenly distributed from 30° to 150° (120° spread)
    const angleStart = Math.PI / 6;  // 30 degrees
    const angleEnd = Math.PI / 2 + Math.PI / 3;  // 150 degrees
    const angleSpread = angleEnd - angleStart;

    for (let i = 0; i < raysPerSide; i++) {
        // Calculate angle for this ray (evenly distributed)
        const t = raysPerSide > 1 ? i / (raysPerSide - 1) : 0.5;
        const arcAngle = angleStart + t * angleSpread + rotation;
        const originX = leftCenterX + Math.cos(arcAngle) * arcRadius;
        const originY = leftCenterY + Math.sin(arcAngle) * arcRadius;

        // Ray points in the same direction as the arc angle
        drawRay(originX, originY, arcAngle, rayLength);
    }

    // Right corner setup
    const rightCenterX = CONFIG.WIDTH - 50;
    const rightCenterY = -150; // Moved up to hide origin points

    for (let i = 0; i < raysPerSide; i++) {
        // Calculate angle for this ray (evenly distributed, mirrored)
        const t = raysPerSide > 1 ? i / (raysPerSide - 1) : 0.5;
        const arcAngle = angleEnd - t * angleSpread - rotation;
        const originX = rightCenterX + Math.cos(arcAngle) * arcRadius;
        const originY = rightCenterY + Math.sin(arcAngle) * arcRadius;

        // Ray points in the same direction as the arc angle
        drawRay(originX, originY, arcAngle, rayLength);
    }

    stageLightTempCtx.restore();

    // Apply blur ONCE to the entire result and draw to output context
    ctx.save();
    ctx.filter = 'blur(8px)';
    ctx.drawImage(stageLightTempCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.restore();
}

// Update stage light effects based on game state
export function updateStageLights(currentGameTime) {
    if (!settings.vfxEnabled) return;

    // Calculate BPM-based beat timing
    const bpm = game.chart?.bpm || 120;
    const beatDuration = (60 / bpm) * 1000; // ms per beat
    const currentBeat = Math.floor(currentGameTime / beatDuration);

    // Flash on new beat - stronger flash at higher glow levels
    if (currentBeat !== game.stageLightLastBeat) {
        game.stageLightLastBeat = currentBeat;
        // Brighter flash during fever mode
        game.stageLightIntensity = 1.5 + game.glowLevel * 0.5;

        // Change color every 4 beats (measure) - only in normal mode
        if (game.glowLevel < 0.5 && currentBeat % 4 === 0) {
            game.stageLightColor = game.stageLightColor === 'darkred' ? 'black' : 'darkred';
        }
    }

    // Fade intensity back down smoothly - slower fade at higher glow
    const fadeRate = 0.95 - game.glowLevel * 0.02;
    const minIntensity = 0.6 + game.glowLevel * 0.2;
    game.stageLightIntensity = Math.max(minIntensity, game.stageLightIntensity * fadeRate);

    // Add subtle flicker effect - more pronounced at higher glow
    const flickerIntensity = 1 + game.glowLevel * 0.5;
    const flicker = Math.sin(currentGameTime * 0.01) * 0.05 * flickerIntensity + Math.random() * 0.03 * flickerIntensity;
    game.stageLightIntensity = Math.min(2 + game.glowLevel, game.stageLightIntensity + flicker);

    // Rotate the lights over time with direction changes - faster at higher glow
    const baseRotationSpeed = 0.001;
    const rotationSpeed = baseRotationSpeed * (1 + game.glowLevel * 2);
    game.stageLightRotation += rotationSpeed * game.stageLightDirection;

    // Reverse direction when completing a full rotation
    if (game.stageLightRotation >= Math.PI * 2) {
        game.stageLightRotation = Math.PI * 2;
        game.stageLightDirection = -1; // Reverse to counter-clockwise
    } else if (game.stageLightRotation <= 0) {
        game.stageLightRotation = 0;
        game.stageLightDirection = 1; // Reverse to clockwise
    }
}

// Linear interpolation helper
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Update glow level based on current phase intensity
export function updateGlowLevel(currentGameTime) {
    if (!settings.vfxEnabled) return;

    // Get intensity from current phase (default to 0 if not specified)
    const phase = game.currentPhase;
    const prevTarget = game.targetGlowLevel;

    if (phase && phase.intensity !== undefined) {
        game.targetGlowLevel = phase.intensity;
    } else {
        game.targetGlowLevel = 0;
    }

    // Log when target changes
    if (prevTarget !== game.targetGlowLevel) {
        console.log(`Glow level target changed: ${prevTarget} -> ${game.targetGlowLevel} (phase intensity: ${phase?.intensity})`);
    }

    // Smooth transition between glow levels
    const transitionSpeed = 0.03; // Adjust for faster/slower transitions
    game.glowLevel = lerp(game.glowLevel, game.targetGlowLevel, transitionSpeed);

    // Update screen pulse for fever mode (level 2)
    if (game.glowLevel > 1.5) {
        const bpm = game.chart?.bpm || 120;
        const beatDuration = (60 / bpm) * 1000;
        game.screenPulsePhase = (currentGameTime % beatDuration) / beatDuration;
        // Pulse intensity based on how close we are to level 2
        game.screenPulse = (game.glowLevel - 1.5) * 2 * (0.5 + 0.5 * Math.sin(game.screenPulsePhase * Math.PI * 2));
    } else if (game.glowLevel > 0.5) {
        // Subtle pulse for level 1
        game.screenPulse = (game.glowLevel - 0.5) * 0.3;
    } else {
        game.screenPulse = 0;
    }

    // Update background video brightness based on glow level
    if (game.bgVideo && settings.bgVideoEnabled) {
        const baseBrightness = 0.4;
        const maxBrightness = 0.75;
        const brightness = baseBrightness + (game.glowLevel / 2) * (maxBrightness - baseBrightness);
        const saturation = 1 + game.glowLevel * 0.2;
        game.bgVideo.style.filter = `brightness(${brightness}) saturate(${saturation})`;
    }

    // Manage floating particles for fever mode
    updateFloatingParticles(currentGameTime);

    // Update player trail
    updatePlayerTrail();
}

// Draw full screen glitch transition effect
export function drawGlitchEffect(ctx) {
    if (game.glitchIntensity <= 0.01) {
        game.glitchIntensity = 0;
        return;
    }

    // Decay intensity
    game.glitchIntensity *= 0.92; // Smooth decay

    const intensity = game.glitchIntensity;
    const w = CONFIG.WIDTH;
    const h = CONFIG.HEIGHT;

    ctx.save();

    // 1. Horizontal Tearing/Slicing - capped at 10 for performance
    const numSlices = Math.min(10, Math.floor(20 * intensity));
    for (let i = 0; i < numSlices; i++) {
        const sliceH = Math.random() * 50 * intensity;
        const sliceY = Math.random() * h;
        const offsetX = (Math.random() - 0.5) * 150 * intensity;

        // Draw slice from canvas back to canvas with offset
        try {
             ctx.drawImage(ctx.canvas, 0, sliceY, w, sliceH, offsetX, sliceY, w, sliceH);
        } catch (e) {
            // Ignore if canvas is not ready as source
        }
    }

    // 2. RGB Shift (Global)
    if (intensity > 0.3) {
        ctx.globalCompositeOperation = 'screen';
        const shiftX = (Math.random() - 0.5) * 20 * intensity;

        // Draw red channel copy (simulated with fillRect for now as full copy is expensive)
        // Actually better to just draw a colored overlay
        ctx.fillStyle = `rgba(255, 0, 0, ${0.1 * intensity})`;
        ctx.fillRect(shiftX, 0, w, h);

        ctx.fillStyle = `rgba(0, 255, 255, ${0.1 * intensity})`;
        ctx.fillRect(-shiftX, 0, w, h);
    }

    // 3. Scanlines / Static
    if (intensity > 0.5) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * intensity})`;
        for (let y = 0; y < h; y += 4) {
             if (Math.random() > 0.5) ctx.fillRect(0, y, w, 2);
        }
    }

    ctx.restore();
}
