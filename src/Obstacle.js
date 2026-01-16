import { game } from './GameState.js';
// import { settings } from './Settings.js';
import { CONFIG } from './Config.js';
import { playNoteSound } from './Audio.js';

// Obstacle class - now accepts startTime, endTime, lane, and optional soundId from chart
export class Obstacle {
    constructor(lane, startTime, endTime, soundId = null, text = "") {
        this.lane = lane;
        this.startTime = startTime;
        this.endTime = endTime;
        this.soundId = soundId;  // Sound to play when obstacle hits the line
        this.text = text || "";  // Lyric text

        // Calculate position based on lane
        const laneWidth = CONFIG.WIDTH / CONFIG.NUMBER_OF_LANES;
        this.x = lane * laneWidth;
        this.width = laneWidth;

        // Calculate height based on duration (endTime - startTime)
        // Height is proportional to duration relative to travel time
        const duration = endTime - startTime;
        const pixelsPerMs = CONFIG.HEIGHT / CONFIG.TRAVEL_TIME;
        this.height = duration * pixelsPerMs;

        // Y position will be calculated based on game time in update()
        this.y = -this.height;

        // Player line Y position (where obstacles should arrive at startTime)
        this.playerLineY = CONFIG.HEIGHT - CONFIG.PLAYER_Y_OFFSET;

        this.color = '#6b5fff';
        this.passed = false;
        this.hasFlared = false;

        // Pre-cache random values for performance (avoid Math.random() in draw loop)
        this.jitterX = (Math.random() - 0.5) * 8;
        this.jitterY = (Math.random() - 0.5) * 2;
        this.stretchFactor = Math.random() * 2 + 1;

        // Pre-cache chars array for text rendering
        const textToRender = this.text || "👁";
        this.chars = textToRender.split('');

        // Pre-cache per-character jitter values
        this.charJitters = this.chars.map(() => (Math.random() - 0.5) * 3);

        // Offscreen canvas cache for text rendering (populated on first draw)
        this.textCache = null;
        this.textCacheWidth = 0;
        this.textCacheHeight = 0;

        // Glitch lane change mechanic for Dodge mode
        // canGlitch will be determined at runtime based on phase intensity
        this.glitchRoll = Math.random();  // Pre-roll for glitch chance
        this.canGlitch = false;  // Will be set in updateWithTime based on phase intensity
        this.glitchChanceChecked = false;
        this.hasGlitched = false;
        this.glitchTime = 0;
        this.glitchIntensity = 0;
        this.originalLane = lane;
        // Pre-calculate glitch trigger progress - midway through screen (35-55%)
        this.glitchTriggerProgress = 0.35 + Math.random() * 0.20;
    }

    // Create cached text rendering for performance
    _createTextCache() {
        const fontSize = 48;
        const charCount = this.chars.length;

        // Calculate canvas size needed
        const canvasWidth = Math.ceil(this.width * 4); // Extra width for RGB offset + stretch
        const canvasHeight = Math.ceil(charCount * fontSize + 60);

        if (canvasHeight <= 0 || canvasWidth <= 0) return;

        this.textCacheWidth = canvasWidth;
        this.textCacheHeight = canvasHeight;

        // Create offscreen canvas
        this.textCache = document.createElement('canvas');
        this.textCache.width = canvasWidth;
        this.textCache.height = canvasHeight;
        const ctx = this.textCache.getContext('2d');

        ctx.font = `bold ${fontSize}px "BIZ UDPMincho", "Hiragino Mincho ProN", "MS Mincho", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = canvasWidth / 2;
        const startTextY = 30;

        // Helper for RGB Split rendering to cache
        const drawVerticalText = (offsetX, offsetY, color, composite) => {
            ctx.globalCompositeOperation = composite;
            ctx.fillStyle = color;

            this.chars.forEach((char, i) => {
                const charY = startTextY + i * fontSize;
                const charJitter = this.charJitters[i];

                ctx.save();
                ctx.translate(centerX + offsetX + charJitter, charY + offsetY);
                ctx.scale(this.stretchFactor, 1);
                ctx.fillText(char, 0, 0);
                ctx.restore();
            });
        };

        // Red Channel (Offset left/up)
        drawVerticalText(-4, -2, 'rgba(255, 0, 0, 0.7)', 'source-over');

        // Cyan Channel (Offset right/down)
        drawVerticalText(4, 2, 'rgba(0, 255, 255, 0.7)', 'lighter');

        // Main Channel (White/Grey)
        drawVerticalText(0, 0, 'rgba(240, 240, 240, 0.9)', 'source-over');
    }

    // Update position based on current game time (synced to audio)
    updateWithTime(currentGameTime) {
        // Calculate how far through the journey the obstacle is
        // At (startTime - TRAVEL_TIME), obstacle bottom is at y = 0 (just entering screen)
        // At startTime, obstacle bottom should be at playerLineY
        const spawnTime = this.startTime - CONFIG.TRAVEL_TIME;
        const progress = (currentGameTime - spawnTime) / CONFIG.TRAVEL_TIME;

        // Calculate Y position: bottom of obstacle travels from 0 to playerLineY
        const bottomY = progress * this.playerLineY;
        this.y = bottomY - this.height;

        // Get phase intensity for glitch calculations
        const phaseIntensity = game.currentPhase?.intensity ?? 0;

        // Check glitch chance once, based on phase intensity
        // Higher phase intensity = higher chance to glitch (up to 15% at intensity 1.0)
        if (!this.glitchChanceChecked && progress > 0) {
            this.glitchChanceChecked = true;
            const glitchChance = 0.15 * phaseIntensity;  // 0-15% based on phase intensity
            this.canGlitch = this.glitchRoll < glitchChance;
            if (this.canGlitch) {
                console.log(`[GLITCH-DODGE] Obstacle can glitch: lane=${this.lane}, intensity=${phaseIntensity.toFixed(2)}, triggerAt=${(this.glitchTriggerProgress * 100).toFixed(0)}%`);
            }
        }

        // Glitch lane change mechanic - triggers at midway (35-55% progress)
        if (this.canGlitch && !this.hasGlitched) {
            if (progress >= this.glitchTriggerProgress && progress < 0.65) {
                this.hasGlitched = true;
                this.glitchTime = currentGameTime;

                // Switch to an adjacent lane (left or right)
                const oldLane = this.lane;
                const laneWidth = CONFIG.WIDTH / CONFIG.NUMBER_OF_LANES;

                // Randomly pick left or right, but stay within bounds
                let newLane;
                if (this.lane === 0) {
                    newLane = 1;  // Can only go right
                } else if (this.lane === CONFIG.NUMBER_OF_LANES - 1) {
                    newLane = this.lane - 1;  // Can only go left
                } else {
                    // Can go either way - pick randomly
                    newLane = Math.random() < 0.5 ? this.lane - 1 : this.lane + 1;
                }

                this.lane = newLane;
                this.x = newLane * laneWidth;

                // Invalidate text cache so it redraws at new position
                this.textCache = null;

                console.log(`[GLITCH-DODGE] Obstacle SWITCHED! lane ${oldLane} -> ${this.lane} at progress ${(progress * 100).toFixed(0)}%`);
            }
        }

        // Update glitch visual intensity (fades out after glitch)
        if (this.hasGlitched) {
            const timeSinceGlitch = currentGameTime - this.glitchTime;
            if (timeSinceGlitch < 300) {
                this.glitchIntensity = 1 - (timeSinceGlitch / 300);  // Full intensity, not scaled
            } else {
                this.glitchIntensity = 0;
            }
        } else if (this.canGlitch) {
            // Pre-glitch: subtle visual hint that this obstacle might glitch (scaled by phase intensity)
            this.glitchIntensity = (0.3 + Math.sin(currentGameTime * 0.02) * 0.2) * phaseIntensity;
        }
    }

    update() {
        // Legacy update method - no longer used when time-synced
        // Kept for compatibility
    }

    draw(ctx) {
        ctx.save();

        // MOOD: Glitch / Horror / Unstable
        // 1. Kinetic Animation & Jitter - use cached values
        let x = this.x + this.jitterX;
        const y = this.y + this.jitterY;
        const w = this.width;
        const h = this.height;
        let centerX = x + w / 2;

        // Glitch visual effect - chromatic aberration and position distortion
        const hasGlitchEffect = this.glitchIntensity > 0;
        if (hasGlitchEffect) {
            const intensity = this.glitchIntensity;

            // Draw chromatic aberration layers (cyan and red offsets)
            const offsetX = intensity * 12;
            const offsetY = intensity * 6;

            // Cyan layer (offset left/up)
            ctx.globalAlpha = intensity * 0.6;
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(x - offsetX, y - offsetY, w, h);

            // Red layer (offset right/down)
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(x + offsetX, y + offsetY, w, h);

            ctx.globalAlpha = 1;

            // Add horizontal glitch line artifacts
            if (intensity > 0.4) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    const lineY = y + Math.random() * h;
                    const lineOffsetX = (Math.random() - 0.5) * 40 * intensity;
                    ctx.beginPath();
                    ctx.moveTo(x - 20 + lineOffsetX, lineY);
                    ctx.lineTo(x + w + 20 + lineOffsetX, lineY);
                    ctx.stroke();
                }
            }

            // Slight position jitter during glitch
            x += (Math.random() - 0.5) * 10 * intensity;
            centerX = x + w / 2;
        }

        // Fever Mode Integration
        const isFever = false; // game.glowLevel > 1.0; // Disabled for performance

        // 2. The "Eye" / Sentient Pupils (DISABLED - kept for later use)
        // To re-enable: set drawEye = true
        const drawEye = this.text === "👁";
        if (drawEye && !this.passed && y < this.playerLineY && y + h > 0) {
            // Draw eye at the top of the block
            const eyeY = y + 60;
            if (eyeY < this.playerLineY) {
                const playerX = game.player ? (game.player.x + game.player.size/2) : CONFIG.WIDTH/2;
                const playerY = CONFIG.HEIGHT - CONFIG.PLAYER_Y_OFFSET;

                // Stylized Almond Eye - doubled size, taller shape
                const eyeWidth = 140 + Math.random() * 12;
                const eyeHeight = 100 + Math.random() * 6;

                ctx.save();
                ctx.translate(centerX, eyeY);

                // Calculate rotation angle to look at player
                const dx = playerX - centerX;
                const dy = playerY - eyeY;
                const lookAngle = Math.atan2(dy, dx);

                // Rotate the whole eye towards player
                // Add -90 degrees (Math.PI/2) because default orientation is down/forward?
                // Wait, eye default is horizontal. atan2 gives angle from x-axis.
                // If player is below, angle is ~90deg.
                // We want the eye to point its "front" towards player.
                // The drawing commands assume eye is facing right (along X axis) or just static shape?
                // The SVG path M -60 0 ... implies centered horizontally.
                // Let's rotate the context so the eye points to player.
                // However, eye shape is wide. If we rotate 90deg, it becomes tall.
                // The request says "sclera follows the player".
                // In the HTML example: transform: rotate(318.8deg) on the eye-ring container.
                // Let's try rotating the context by lookAngle.
                // But we need to offset the rotation because lookAngle=0 is right,
                // and we probably want the eye to be "level" relative to that vector?
                // Actually, if we just rotate the eye, the "width" aligns with the vector to player.
                // Let's assume we want the eye shape to rotate to face the player.

                // Base rotation: 0 radians = facing right.
                // If player is below, angle is PI/2.
                // If we rotate by angle, the "right" of the eye points to player.
                // The eye shape is defined from -60 to 60 (width) and -35 to 35 (height).
                // So it is wide horizontally.
                // So yes, rotating by angle makes the wide axis point to player?
                // No, usually "facing" means the pupil direction.
                // But here the user says "black sclera follows the player".
                // This implies the whole eye shape rotates.

                // Rotation removed
                // If lookAngle is PI/2 (down), and we rotate by PI/2, the X-axis of eye (width) becomes vertical.
                // That seems wrong for an eye looking at something, unless the eye is weird.
                // Wait, the HTML example has `transform: rotate(318.8deg)` on the container.
                // And the pupil has `transform: translate(...)`.
                // This suggests the eye shape ITSELF rotates.

                // Let's rotate so the "top" of the eye (or bottom?) faces the player?
                // Or maybe the eye rotates around its center to track?

                // Rotation removed to keep eye horizontal
                // ctx.rotate(lookAngle);

                // Draw Almond Shape (Original Quadratic Curve for "original eye shape")
                const w = eyeWidth / 2;
                // eyeHeight * 0.55 roughly equals h * 1.1
                const hControl = (eyeHeight / 2) * 1.1;

                ctx.beginPath();
                ctx.moveTo(-w, 0);
                // Top curve
                ctx.quadraticCurveTo(0, -hControl, w, 0);
                // Bottom curve
                ctx.quadraticCurveTo(0, hControl, -w, 0);
                ctx.closePath();

                // Fill: Black base (Sclera)
                ctx.fillStyle = '#000';
                ctx.fill();

                // Outline: Red stroke
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Clip for iris/pupil
                ctx.save();
                ctx.clip();

                // Calculate Pupil Movement
                // Map the look direction to the eye's shape
                const maxMoveX = w * 0.5;
                const maxMoveY = hControl * 0.5;

                const pupilX = Math.cos(lookAngle) * maxMoveX;
                const pupilY = Math.sin(lookAngle) * maxMoveY;

                // Move the pupil group
                ctx.translate(pupilX, pupilY);

                // Iris (Dark Red Ring)
                ctx.beginPath();
                ctx.arc(0, 0, 28, 0, Math.PI * 2);
                ctx.fillStyle = '#991b1b';
                ctx.fill();

                // Pupil (Black center)
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fillStyle = '#000';
                ctx.fill();

                ctx.restore(); // Undo translate & rotate
            }
        }

        // 3. The "Lyric-as-Obstacle" System
        if (!drawEye) {
            // Create text cache on first draw (lazy initialization)
            if (!this.textCache && this.chars.length > 0) {
                this._createTextCache();
            }

            // Hyperventilating Effect: Pulse size/stretch rapidly based on time
            const time = Date.now() / 1000 + (this.jitterX * 0.1);
            const pulseSpeed = 18;
            const baseScale = 1.0;
            const pulseIntensity = 0.15;
            const breathScale = baseScale + Math.sin(time * pulseSpeed) * pulseIntensity;

            // Calculate spacing
            const startTextY = y + 20;

            if (isFever) {
                // Fever Mode: Black silhouettes with glowing outlines
                // (Keep original per-char rendering for fever as it's less common)
                const fontSize = 48;
                ctx.font = `bold ${fontSize}px "BIZ UDPMincho", "Hiragino Mincho ProN", "MS Mincho", serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';

                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                this.chars.forEach((char, i) => {
                    const charY = startTextY + i * fontSize;
                    if (charY > y + h - 10) return;

                    const currentScaleX = this.stretchFactor * breathScale;
                    const currentScaleY = 1 + (1 - breathScale) * 0.5;

                    ctx.save();
                    ctx.translate(centerX, charY);
                    ctx.scale(currentScaleX, currentScaleY);
                    ctx.strokeText(char, 0, 0);
                    ctx.restore();
                });

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#000';
                this.chars.forEach((char, i) => {
                    const charY = startTextY + i * fontSize;
                    if (charY > y + h - 10) return;

                    const currentScaleX = this.stretchFactor * breathScale;
                    const currentScaleY = 1 + (1 - breathScale) * 0.5;

                    ctx.save();
                    ctx.translate(centerX, charY);
                    ctx.scale(currentScaleX, currentScaleY);
                    ctx.fillText(char, 0, 0);
                    ctx.restore();
                });

            } else if (this.textCache) {
                // Normal Mode: Use cached RGB-split text with breathing pulse
                ctx.save();

                // Position and scale the cached text
                const drawX = centerX - this.textCacheWidth / 2;
                const drawY = startTextY - 30; // Offset to align with cache's startTextY

                // Apply breathing pulse to the whole cached image
                ctx.translate(centerX, startTextY + this.textCacheHeight / 2 - 30);
                ctx.scale(breathScale, 1 + (1 - breathScale) * 0.5);
                ctx.translate(-centerX, -(startTextY + this.textCacheHeight / 2 - 30));

                // Draw the cached text
                ctx.drawImage(this.textCache, drawX, drawY);

                ctx.restore();
            }

            // 4. Jagged/Thorny Silhouette (Background Lines)
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = isFever ? 'rgba(255, 255, 255, 0.2)' : 'rgba(100, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            let thornY = y;
            let thornX = centerX;
            while (thornY < y + h) {
                thornY += 15;
                thornX = centerX + (Math.random() - 0.5) * 40;
                ctx.lineTo(thornX, thornY);
            }
            ctx.stroke();
        }

        ctx.restore()

        // // Draw hitbox bounding box for debugging
        // if (settings.showHitboxes) {
        //     const bounds = this.getBounds();
        //     ctx.save();
        //     ctx.strokeStyle = '#00ff00';
        //     ctx.lineWidth = 2;
        //     ctx.setLineDash([5, 5]);
        //     ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        //     ctx.restore();
        // }
    };

    isOffScreen() {
        return this.y > CONFIG.HEIGHT;
    }

    getBounds() {
        // Match the visual position exactly (WYSIWYG)
        const x = this.x + this.jitterX;
        const y = this.y + this.jitterY;
        const centerX = x + this.width / 2;

        const isEye = this.text === "👁";

        if (isEye) {
            // Eye is drawn at centerX, y + 60 with width ~140, height ~100
            const eyeWidth = 140;
            const eyeHeight = 100;
            const eyeY = y + 60;

            return {
                x: centerX - eyeWidth / 2,
                y: eyeY - eyeHeight / 2,
                width: eyeWidth,
                height: eyeHeight
            };
        } else {
            // Text rendering details:
            // - fontSize = 48, textBaseline = 'middle' (so char is centered at charY)
            // - startTextY in draw = y + 20, each char at startTextY + i * fontSize
            // - RGB split adds offsets: red (-4, -2), cyan (+4, +2)
            // - stretchFactor scales horizontally (1 to 3 range)
            // - charJitters add per-character horizontal offset (±1.5 pixels)
            const fontSize = 48;
            const charCount = this.chars.length;
            const startTextY = y + 20;

            // Vertical bounds: first char center is at startTextY, last at startTextY + (charCount-1)*fontSize
            // With textBaseline 'middle', each char extends ±fontSize/2 from center
            // Plus RGB offset of ±2 pixels vertically
            const rgbOffsetY = 2;
            const firstCharCenterY = startTextY;
            const lastCharCenterY = startTextY + (charCount - 1) * fontSize;
            const topY = firstCharCenterY - fontSize / 2 - rgbOffsetY;
            const bottomY = lastCharCenterY + fontSize / 2 + rgbOffsetY;
            const textHeight = bottomY - topY;

            // Horizontal bounds: character width ≈ fontSize, scaled by stretchFactor
            // Plus RGB offset of ±4 pixels, plus max charJitter of ±1.5
            const rgbOffsetX = 4;
            const maxCharJitter = 1.5;
            const baseCharWidth = fontSize * this.stretchFactor;
            const textWidth = baseCharWidth + (rgbOffsetX + maxCharJitter) * 2;

            return {
                x: centerX - textWidth / 2,
                y: topY,
                width: textWidth,
                height: textHeight
            };
        }
    }
}

// EnemyBullet class - Touhou-style bullet for bullet hell patterns
export class EnemyBullet {
    static pool = [];

    static get(x, y, vx, vy, options = {}) {
        if (EnemyBullet.pool.length > 0) {
            const bullet = EnemyBullet.pool.pop();
            bullet.reset(x, y, vx, vy, options);
            return bullet;
        }
        return new EnemyBullet(x, y, vx, vy, options);
    }

    static release(bullet) {
        bullet.active = false;
        EnemyBullet.pool.push(bullet);
    }

    constructor(x, y, vx, vy, options = {}) {
        this.reset(x, y, vx, vy, options);
    }

    reset(x, y, vx, vy, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = options.radius || CONFIG.TOUHOU_BULLET_RADIUS;
        this.color = options.color || '#ff6b9d';  // Default pink
        this.glowColor = options.glowColor || 'rgba(255, 100, 150, 0.8)';
        this.grazed = false;  // Track if player already grazed this bullet
        this.active = true;

        // Pre-compute radius squared for faster collision detection
        this.radiusSq = this.radius * this.radius;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    static bulletSpriteCache = {};

    static getBulletSprite(color, radius) {
        const key = `${color}_${radius}`;
        if (EnemyBullet.bulletSpriteCache[key]) {
            return EnemyBullet.bulletSpriteCache[key];
        }

        const canvas = document.createElement('canvas');
        const size = Math.ceil(radius * 4) + 4; // Larger canvas for glow
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const center = size / 2;

        // Visual enhancement: Outer glow bloom
        const glow = ctx.createRadialGradient(center, center, radius, center, center, radius * 2);
        glow.addColorStop(0, color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(center, center, radius * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Main body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();

        // Sharp white center highlight
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Inner detail ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        EnemyBullet.bulletSpriteCache[key] = canvas;
        return canvas;
    }

    draw(ctx) {
        if (!this.active) return;

        const sprite = EnemyBullet.getBulletSprite(this.color, this.radius);
        ctx.drawImage(sprite, this.x - sprite.width / 2, this.y - sprite.height / 2);
    }

    isOffScreen() {
        const margin = 50;
        return this.x < -margin || this.x > CONFIG.WIDTH + margin ||
               this.y < -margin || this.y > CONFIG.HEIGHT + margin;
    }

    // Circle-circle collision check - optimized with squared distance
    checkCollision(playerHitbox) {
        const dx = this.x - playerHitbox.x;
        const dy = this.y - playerHitbox.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = this.radius + playerHitbox.radius;
        return distSq < radiusSum * radiusSum;
    }

    // Check if bullet is in graze range (near-miss) - optimized
    checkGraze(grazeArea) {
        if (this.grazed) return false;
        const dx = this.x - grazeArea.x;
        const dy = this.y - grazeArea.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = this.radius + grazeArea.radius;
        if (distSq < radiusSum * radiusSum) {
            this.grazed = true;
            return true;
        }
        return false;
    }
}

// BulletSpawner - spawns bullets in various patterns
export class BulletSpawner {
    constructor(pattern, startTime, options = {}) {
        this.pattern = pattern;  // 'spiral', 'radial', 'aimed', 'wave', 'random'
        this.startTime = startTime;
        this.x = options.x !== undefined ? options.x : CONFIG.WIDTH / 2;
        this.y = options.y !== undefined ? options.y : 50;
        this.bulletSpeed = options.bulletSpeed || 3;
        this.bulletCount = options.bulletCount || 12;
        this.duration = options.duration || 3000;  // How long this spawner is active (ms)
        this.interval = options.interval || 100;   // Time between spawns (ms)

        // Color palette based on touhou phase
        this.colors = [
            '#050505', // void
            '#141414', // abyss
            '#2D2D2D', // iron
            '#4A0000', // dried
            '#8A0000', // crimson
            '#FF3333', // vermilion
            '#00E0E0', // cyanosis
            '#E5E5E5'  // bone
        ];

        // Use provided color or random from palette if not specified
        if (options.color) {
            this.color = options.color;
        } else {
            // Pick based on pattern or random (skip very dark ones)
            const idx = Math.floor(Math.random() * (this.colors.length - 2)) + 2;
            this.color = this.colors[idx];
        }

        this.glowColor = options.glowColor || this.color;
        this.bulletRadius = options.bulletRadius || CONFIG.TOUHOU_BULLET_RADIUS;
        this.soundId = options.soundId || null;  // Sound to play when bullets spawn

        // Pattern-specific state
        this.angle = options.startAngle || 0;
        this.angleStep = options.angleStep || 0.15;
        this.lastSpawnTime = 0;
        this.spawnCount = 0;
        this.active = false;
        this.finished = false;
        this.soundPlayed = false;  // Track if sound has been played for this spawner
    }

    update(currentGameTime, enemyBullets, player) {
        if (this.finished) return;

        // Check if spawner should be active
        if (currentGameTime < this.startTime) return;
        if (currentGameTime > this.startTime + this.duration) {
            this.finished = true;
            return;
        }

        this.active = true;

        // Play sound on first activation (on the beat)
        if (!this.soundPlayed && this.soundId) {
            playNoteSound(this.soundId);
            this.soundPlayed = true;
        }

        // Check if it's time to spawn bullets
        if (currentGameTime - this.lastSpawnTime < this.interval) return;
        this.lastSpawnTime = currentGameTime;

        // Spawn bullets based on pattern
        const bullets = this.spawnPattern(player);
        enemyBullets.push(...bullets);
        this.spawnCount++;
    }

    spawnPattern(player) {
        const bullets = [];
        const bulletOptions = {
            radius: this.bulletRadius,
            color: this.color,
            glowColor: this.glowColor
        };

        switch (this.pattern) {
            case 'spiral':
                // Single bullet spiraling outward with higher density and speed
                for (let i = 0; i < 6; i++) { // Increased from 4
                    const angle = this.angle + i * (Math.PI * 2 / 6);
                    const vx = Math.cos(angle) * (this.bulletSpeed * 1.8); // 1.5 -> 1.8
                    const vy = Math.sin(angle) * (this.bulletSpeed * 1.8);
                    bullets.push(EnemyBullet.get(this.x, this.y, vx, vy, bulletOptions));
                }
                this.angle += this.angleStep * 2.2; // Faster rotation
                break;

            case 'radial':
                // Burst of bullets in all directions, faster
                const count = Math.floor(this.bulletCount * 2.5); // 2.0 -> 2.5
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + this.angle;
                    const vx = Math.cos(angle) * (this.bulletSpeed * 1.8); // 1.6 -> 1.8
                    const vy = Math.sin(angle) * (this.bulletSpeed * 1.8);
                    bullets.push(EnemyBullet.get(this.x, this.y, vx, vy, bulletOptions));
                }
                this.angle += this.angleStep * 1.5;
                break;

            case 'aimed':
                // Bullets aimed at player, faster and more spread
                if (player) {
                    const dx = player.x - this.x;
                    const dy = player.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const speed = this.bulletSpeed * 2.2; // 1.8 -> 2.2

                    const vx = (dx / dist) * speed;
                    const vy = (dy / dist) * speed;
                    bullets.push(EnemyBullet.get(this.x, this.y, vx, vy, bulletOptions));

                    // Add spread bullets (wider spread)
                    const spreadAngle = 0.15; // Tighter spread for more difficulty
                    const baseAngle = Math.atan2(dy, dx);
                    // 8 spread bullets instead of 6
                    for (let i = 1; i <= 4; i++) {
                        const angle1 = baseAngle + spreadAngle * i;
                        const angle2 = baseAngle - spreadAngle * i;
                        bullets.push(EnemyBullet.get(this.x, this.y,
                            Math.cos(angle1) * speed,
                            Math.sin(angle1) * speed, bulletOptions));
                        bullets.push(EnemyBullet.get(this.x, this.y,
                            Math.cos(angle2) * speed,
                            Math.sin(angle2) * speed, bulletOptions));
                    }
                }
                break;

            case 'wave':
                // Wavy bullet pattern, denser
                for (let i = 0; i < 9; i++) { // Increased from 7
                    const offsetX = (i - 4) * 25;
                    const vx = Math.sin(this.angle + i * 0.5) * 2.0; // Multiplier 1.5 -> 2.0
                    const vy = this.bulletSpeed * 1.5; // Multiplier 1.2 -> 1.5
                    bullets.push(EnemyBullet.get(this.x + offsetX, this.y, vx, vy, bulletOptions));
                }
                this.angle += 0.5; // Faster wave
                break;

            case 'random':
                // Random spread of bullets, more chaotic
                for (let i = 0; i < 8; i++) { // Increased from 5
                    const angle = Math.random() * Math.PI * 2;
                    const speed = this.bulletSpeed * (1.0 + Math.random() * 1.2); // Faster random
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    bullets.push(EnemyBullet.get(
                        this.x + (Math.random() - 0.5) * 150,
                        this.y,
                        vx, vy, bulletOptions
                    ));
                }
                break;

        }
        return bullets;
    }
}
