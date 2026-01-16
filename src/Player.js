import { game } from './GameState.js';
import { settings } from './Settings.js';
import { CONFIG } from './Config.js';

// Player class - smooth slider movement
export class Player {
    constructor() {
        this.size = CONFIG.PLAYER_SIZE;
        this.x = CONFIG.WIDTH / 2 - this.size / 2;
        this.y = CONFIG.HEIGHT - CONFIG.PLAYER_Y_OFFSET - 25;
        this.color = '#4ecca3';

        // Smooth movement properties
        this.velocity = 0;
        this.maxSpeed = 20;        // Maximum movement speed (pixels per frame)
        this.acceleration = 1.5;   // How fast to accelerate
        this.friction = 0.7;      // Deceleration when not moving (0-1, lower = more friction)

        // Input tracking (set by input handlers)
        this.movingLeft = false;
        this.movingRight = false;
    }

    moveLeft() {
        this.movingLeft = true;
    }

    moveRight() {
        this.movingRight = true;
    }

    stopLeft() {
        this.movingLeft = false;
    }

    stopRight() {
        this.movingRight = false;
    }

    update() {
        // Apply acceleration based on input
        if (this.movingLeft) {
            this.velocity -= this.acceleration;
        }
        if (this.movingRight) {
            this.velocity += this.acceleration;
        }

        // Apply friction when no input
        if (!this.movingLeft && !this.movingRight) {
            this.velocity *= this.friction;
            // Stop completely if very slow
            if (Math.abs(this.velocity) < 0.1) {
                this.velocity = 0;
            }
        }

        // Clamp velocity to max speed
        this.velocity = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.velocity));

        // Update position
        this.x += this.velocity;

        // Keep within bounds
        if (this.x < 0) {
            this.x = 0;
            this.velocity = 0;
        }
        if (this.x > CONFIG.WIDTH - this.size) {
            this.x = CONFIG.WIDTH - this.size;
            this.velocity = 0;
        }
    }

    draw(ctx) {
        const x = this.x;
        const y = this.y;
        const size = this.size;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        ctx.save();

        // Dynamic glow based on glow level
        const glowLevel = game.glowLevel || 0;
        const glowMultiplier = 1 + glowLevel * 0.8;

        // Glow colors for each level
        const glowColors = [
            { r: 200, g: 220, b: 255, a: 0.8 },   // Level 0: soft white-blue
            { r: 255, g: 215, b: 100, a: 0.9 },   // Level 1: warm gold
            { r: 100, g: 220, b: 255, a: 1.0 }    // Level 2: bright cyan
        ];

        // Interpolate between colors based on glow level
        const colorIndex = Math.min(2, Math.floor(glowLevel));
        const nextColorIndex = Math.min(2, colorIndex + 1);
        const colorBlend = glowLevel - colorIndex;

        const currentColor = glowColors[colorIndex];
        const nextColor = glowColors[nextColorIndex];

        const r = Math.round(currentColor.r + (nextColor.r - currentColor.r) * colorBlend);
        const g = Math.round(currentColor.g + (nextColor.g - currentColor.g) * colorBlend);
        const b = Math.round(currentColor.b + (nextColor.b - currentColor.b) * colorBlend);
        const a = currentColor.a + (nextColor.a - currentColor.a) * colorBlend;

        // Outer glow layers for fever mode
        if (glowLevel > 1) {
            // Extra outer glow for fever
            ctx.shadowBlur = 60 * glowMultiplier;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${a * 0.3})`;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
            ctx.beginPath();
            ctx.rect(x - size * 0.5, y - size * 0.5, size * 2, size * 2);
            ctx.fill();

            // Pulsing aura ring
            const pulseScale = 1 + Math.sin(Date.now() * 0.008) * 0.2;
            const pulseSize = size * 1.5 * pulseScale;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 * (glowLevel - 1)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(centerX - pulseSize / 2, centerY - pulseSize / 2, pulseSize, pulseSize);
            ctx.stroke();
        }

        // Main glow effect
        ctx.shadowBlur = 30 * glowMultiplier;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${a})`;

        // Body color
        ctx.fillStyle = `rgba(255, 255, 255, 0.95)`;

        // Draw Square Body with Eyes (Holes)
        ctx.beginPath();
        // Outer square
        ctx.rect(x, y, size, size);

        // Eyes (Holes)
        const eyeWidth = size * 0.15;
        const eyeHeight = size * 0.25;
        const eyeY = y + size * 0.25;

        // Left Eye
        ctx.rect(x + size * 0.25, eyeY, eyeWidth, eyeHeight);

        // Right Eye
        ctx.rect(x + size * 0.75 - eyeWidth, eyeY, eyeWidth, eyeHeight);

        // Fill with evenodd to create holes
        ctx.fill('evenodd');

        // Draw Bow on Top Right
        const bowColor = '#ff4757';
        ctx.fillStyle = bowColor;
        ctx.shadowColor = bowColor;
        ctx.shadowBlur = 5;

        const bx = x + size;
        const by = y;
        const bSize = size * 0.6; // Slightly larger for "fuller" feel

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(20 * Math.PI / 180); // Rotate 20 degrees to the right

        // Fuller bow parameters
        const wingWidth = bSize * 1.2;
        const wingHeight = bSize * 1.2; // Increased height for fullness

        ctx.beginPath();
        // Left wing
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-wingWidth, -wingHeight, -wingWidth, wingHeight, 0, 0);

        // Right wing
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(wingWidth, -wingHeight, wingWidth, wingHeight, 0, 0);
        ctx.fill();

        // Knot
        ctx.fillStyle = '#ff7685';
        ctx.beginPath();
        ctx.arc(0, 0, bSize * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.size,
            height: this.size
        };
    }
}

// TouhouPlayer class - free 2D movement with focus mode (Touhou-style bullet hell)
export class TouhouPlayer {
    constructor() {
        this.hitboxRadius = CONFIG.TOUHOU_PLAYER_SIZE;  // Tiny hitbox
        this.visualRadius = 15;  // Larger visual representation
        this.x = CONFIG.WIDTH / 2;
        this.y = CONFIG.HEIGHT * 0.75;
        this.speed = CONFIG.TOUHOU_PLAYER_SPEED;
        this.focusSpeed = CONFIG.TOUHOU_FOCUS_SPEED;
        this.isFocused = false;  // Shift held = slow/focus mode

        // Input tracking
        this.movingUp = false;
        this.movingDown = false;
        this.movingLeft = false;
        this.movingRight = false;
    }

    setFocus(focused) {
        this.isFocused = focused;
    }

    update() {
        const currentSpeed = this.isFocused ? this.focusSpeed : this.speed;

        // Calculate movement vector
        let dx = 0;
        let dy = 0;

        if (this.movingLeft) dx -= 1;
        if (this.movingRight) dx += 1;
        if (this.movingUp) dy -= 1;
        if (this.movingDown) dy += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        // Apply movement
        this.x += dx * currentSpeed;
        this.y += dy * currentSpeed;

        // Keep within bounds
        const margin = this.visualRadius;
        this.x = Math.max(margin, Math.min(CONFIG.WIDTH - margin, this.x));
        this.y = Math.max(margin, Math.min(CONFIG.HEIGHT - margin, this.y));
    }

    draw(ctx) {
        ctx.save();

        // HITBOX & VISUALS
        // For Touhou mode, we want to make it clear that ONLY the hitbox matters.
        // We'll remove the large square body to avoid confusion, but keep the bow attached to the hitbox
        // so it looks like a "mini" version of the main player or a "spirit" form.

        const x = this.x;
        const y = this.y;

        // Dynamic glow based on glow level (copied from Player class)
        const glowLevel = game.glowLevel || 0;
        const glowMultiplier = 1 + glowLevel * 0.8;

        // MENTAL BREAKDOWN EFFECT
        // As graze count increases, the player gets redder/more chaotic
        // Max effect at 50 grazes (adjustable)
        const breakdownFactor = Math.min(1.0, (game.grazeCount || 0) / 50);

        // Base colors - start blue/cyan, shift to intense red/purple based on breakdown
        // Start: R:100 G:220 B:255 (Cyan)
        // End:   R:255 G:50  B:50  (Red)

        // Interpolate base color
        const baseR = 100 + (255 - 100) * breakdownFactor;
        const baseG = 220 + (50 - 220) * breakdownFactor;
        const baseB = 255 + (50 - 255) * breakdownFactor;

        // Focus mode makes it even redder/more intense
        const r = this.isFocused ? 255 : Math.round(baseR);
        const g = this.isFocused ? baseG * 0.5 : Math.round(baseG);
        const b = this.isFocused ? baseB * 0.5 : Math.round(baseB);
        const a = 0.8 + breakdownFactor * 0.2; // Gets more opaque/solid with stress

        // Shake effect at high stress (high graze count)
        let shakeX = 0;
        let shakeY = 0;
        if (breakdownFactor > 0.5) {
            const shakeIntensity = (breakdownFactor - 0.5) * 4;
            shakeX = (Math.random() - 0.5) * shakeIntensity;
            shakeY = (Math.random() - 0.5) * shakeIntensity;
        }

        // Apply shake to drawing position
        const drawX = x + shakeX;
        const drawY = y + shakeY;

        // 1. Draw the HITBOX (The Core)
        // This is the most important part visually now

        const coreRadius = this.hitboxRadius;
        // Core pulses faster with higher breakdown
        const pulseSpeed = 0.005 + (breakdownFactor * 0.015);
        const pulse = Math.sin(Date.now() * pulseSpeed) * 0.1;
        const visualRadius = (this.isFocused ? coreRadius : coreRadius * 1.5) * (1 + pulse);

        // Glow/Halo around the core
        // Glow gets larger and more intense with breakdown
        ctx.shadowBlur = (20 + breakdownFactor * 20) * glowMultiplier;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${a})`;

        // Core body
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.beginPath();
        ctx.arc(drawX, drawY, visualRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner white center for high visibility
        // Tints slightly red at max breakdown
        const innerR = 255;
        const innerG = 255 - (breakdownFactor * 100);
        const innerB = 255 - (breakdownFactor * 100);
        ctx.fillStyle = `rgb(${innerR}, ${innerG}, ${innerB})`;

        ctx.beginPath();
        ctx.arc(drawX, drawY, coreRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Ring when focused OR high breakdown
        if (this.isFocused || breakdownFactor > 0.3) {
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(drawX, drawY, visualRadius + 4, 0, Math.PI * 2);
            ctx.stroke();

            // Rotating outer ring for style
            // Rotates faster with breakdown
            const rotSpeed = 0.005 + (breakdownFactor * 0.02);
            const angle = Date.now() * rotSpeed;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
            ctx.beginPath();
            ctx.arc(drawX, drawY, visualRadius + 8, angle, angle + Math.PI * 1.5);
            ctx.stroke();
        }

        // 2. Draw the BOW (Accessory)
        // Attached directly to the hitbox now, smaller scale

        const bowScale = 0.4; // Scaled down significantly
        // Bow gets darker red with breakdown
        const bowR = 255;
        const bowG = 71 * (1 - breakdownFactor * 0.5); // Darken
        const bowB = 87 * (1 - breakdownFactor * 0.5); // Darken
        const bowColor = `rgb(${bowR}, ${bowG}, ${bowB})`;

        ctx.fillStyle = bowColor;
        ctx.shadowColor = bowColor;
        ctx.shadowBlur = 5;

        // Position bow slightly above and right of center
        const bx = drawX + visualRadius;
        const by = drawY - visualRadius;
        const bSize = CONFIG.PLAYER_SIZE * 0.6 * bowScale;

        ctx.save();
        ctx.translate(bx, by);
        // Bow jitter/twitch at high breakdown
        let bowAngle = 20 * Math.PI / 180;
        if (breakdownFactor > 0.7) {
            bowAngle += (Math.random() - 0.5) * 0.2;
        }
        ctx.rotate(bowAngle);

        // Fuller bow parameters
        const wingWidth = bSize * 1.2;
        const wingHeight = bSize * 1.2;

        ctx.beginPath();
        // Left wing
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-wingWidth, -wingHeight, -wingWidth, wingHeight, 0, 0);

        // Right wing
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(wingWidth, -wingHeight, wingWidth, wingHeight, 0, 0);
        ctx.fill();

        // Knot
        ctx.fillStyle = `rgb(${Math.min(255, bowR + 20)}, ${Math.min(255, bowG + 20)}, ${Math.min(255, bowB + 20)})`;
        ctx.beginPath();
        ctx.arc(0, 0, bSize * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.restore();
    }

    // Get hitbox for collision detection
    getHitbox() {
        return {
            x: this.x,
            y: this.y,
            radius: this.hitboxRadius
        };
    }

    // Get graze area for near-miss detection
    getGrazeArea() {
        return {
            x: this.x,
            y: this.y,
            radius: CONFIG.TOUHOU_GRAZE_RADIUS
        };
    }

    getBounds() {
        return {
            x: this.x - this.hitboxRadius,
            y: this.y - this.hitboxRadius,
            width: this.hitboxRadius * 2,
            height: this.hitboxRadius * 2
        };
    }
}
