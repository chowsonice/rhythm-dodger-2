import { CONFIG } from './Config.js';
import { game, resetGameState } from './GameState.js';
import { settings, loadSettings, saveSettings } from './Settings.js';
import { Player, TouhouPlayer } from './Player.js';
import { EnemyBullet } from './Obstacle.js';
import { LightFlare, Particle, createParticles, drawBackground, updateFloatingParticles, drawFloatingParticles, updatePlayerTrail, drawPlayerTrail, drawFeverOverlay, updateFeverModeClasses, updateStageLights, updateGlowLevel, drawGlitchEffect, drawStagedStagelightOverlay } from './Graphics.js';
import { loadMusic, loadChartSounds, playNoteSound, playHitSound } from './Audio.js';
import { loadChart, updateChartSpawning, updateTouhouSpawning, updateCurrentPhase } from './Chart.js';
import { loadPlaybackFile, processPlaybackActions } from './Playback.js';
import { syncSliderWithPlayer, isTouhouMode, handleTap, updateScore } from './Input.js';
import { generateEyes, openEyes, hideEyes, showEyes } from './Eyes.js';

// Check collision between player and obstacle
function checkCollision(player, obstacle) {
    const p = player.getBounds();
    const o = obstacle.getBounds();

    return p.x < o.x + o.width &&
        p.x + p.width > o.x &&
        p.y < o.y + o.height &&
        p.y + p.height > o.y;
}

// Apply settings to game
function applySettings() {
    // Apply background video visibility
    if (game.bgVideo) {
        game.bgVideo.style.display = settings.bgVideoEnabled ? 'block' : 'none';
    }

    // Apply God Mode indicator visibility
    const godModeIndicator = document.getElementById('godModeIndicator');
    if (godModeIndicator) {
        if (settings.godMode) {
            godModeIndicator.classList.remove('hidden');
        } else {
            godModeIndicator.classList.add('hidden');
        }
    }

    // Update music volume if music is loaded
    if (game.music) {
        game.music.volume = settings.musicVolume;
    }

    // Update SFX volumes
    if (game.upHitSound) game.upHitSound.volume = settings.sfxVolume;
    if (game.downHitSound) game.downHitSound.volume = settings.sfxVolume;
}

// Helper to update control visibility based on phase
function updateControlsVisibility() {
    const upBtn = document.getElementById('upBtn');
    const downBtn = document.getElementById('downBtn');
    const upBtnLeft = document.getElementById('upBtnLeft');
    const downBtnLeft = document.getElementById('downBtnLeft');

    if (!upBtn || !downBtn || !upBtnLeft || !downBtnLeft) return;

    if (game.phaseMode === 'touhou') {
        upBtn.classList.remove('hidden');
        downBtn.classList.remove('hidden');
        upBtnLeft.classList.remove('hidden');
        downBtnLeft.classList.remove('hidden');
    } else {
        upBtn.classList.add('hidden');
        downBtn.classList.add('hidden');
        upBtnLeft.classList.add('hidden');
        downBtnLeft.classList.add('hidden');
    }
}

// Multi-phase game loop - handles switching between touhou and dodge phases
function multiPhaseGameLoop(timestamp) {
    if (!game.isRunning || game.isPaused) return;

    const ctx = game.ctx;
    // Use audio currentTime for accurate sync with music
    const currentGameTime = game.music ? game.music.currentTime * 1000 : (timestamp - game.gameStartTime);

    // Update stage lights
    updateStageLights(currentGameTime);

    // Update glow level based on phase intensity
    // updateGlowLevel(currentGameTime);

    // Update CSS classes for fever/buildup mode
    // updateFeverModeClasses();

    // Update current phase based on time
    updateCurrentPhase(currentGameTime);

    // Check if phase changed to update controls visibility
    if (game.phaseMode !== game.lastPhaseMode) {
        updateControlsVisibility();
        game.lastPhaseMode = game.phaseMode;
    }

    // Process playback actions (if in playback mode)
    processPlaybackActions(currentGameTime);

    // Run the appropriate game logic based on current phase mode
    if (game.phaseMode === 'touhou') {
        // TOUHOU PHASE - Bullet hell dodge mode
        drawBackground(ctx, currentGameTime);
        updateTouhouSpawning(currentGameTime);

        // Update bullet spawners
        for (let i = game.touhouSpawners.length - 1; i >= 0; i--) {
            const spawner = game.touhouSpawners[i];
            spawner.update(currentGameTime, game.enemyBullets, game.player);
            if (spawner.finished) {
                game.touhouSpawners.splice(i, 1);
            }
        }

        // Update and draw enemy bullets
        const playerHitbox = game.player.getHitbox();
        const grazeArea = game.player.getGrazeArea();

        for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = game.enemyBullets[i];
            bullet.update();
            bullet.draw(ctx);

            // Check graze (near-miss for bonus points)
            if (bullet.checkGraze(grazeArea) && !bullet.checkCollision(playerHitbox)) {
                game.grazeCount++;
                game.score += 10;
                updateScore();
                // Small particle effect for graze
                createParticles(bullet.x, bullet.y, 3);
            }

            // Check collision with player
            if (!settings.godMode && bullet.checkCollision(playerHitbox)) {
                gameOver();
                return;
            }

            // Remove off-screen bullets
            if (bullet.isOffScreen()) {
                game.enemyBullets.splice(i, 1);
                EnemyBullet.release(bullet);
            }
        }

        // Update and draw player
        game.player.update();
        game.player.draw(ctx);

        // Draw staged stagelight overlay to obscure bullets/player in dark areas
        drawStagedStagelightOverlay(ctx, currentGameTime);

        // Draw graze counter
        ctx.save();
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'left';
        ctx.fillText(`Graze: ${game.grazeCount}`, 20, 80);
        ctx.restore();

    } else {
        // DODGE PHASE - Classic mode logic
        drawBackground(ctx, currentGameTime);
        updateChartSpawning(currentGameTime);

        // Update and draw obstacles
        for (let i = game.obstacles.length - 1; i >= 0; i--) {
            const obstacle = game.obstacles[i];
            obstacle.updateWithTime(currentGameTime);
            obstacle.draw(ctx);

            // Check if obstacle crosses the slider line
            const sliderLineY = CONFIG.HEIGHT - CONFIG.PLAYER_Y_OFFSET;
            const obstacleBottomY = obstacle.y + obstacle.height;

            // Trigger flare and sound when bottom of obstacle first touches the line
            if (!obstacle.hasFlared && obstacleBottomY >= sliderLineY && obstacle.y < sliderLineY) {
                const flareX = obstacle.x + obstacle.width / 2;
                const flareY = sliderLineY;
                game.lightFlares.push(new LightFlare(flareX, flareY));
                obstacle.hasFlared = true;

                // Play sound when obstacle hits the line
                if (obstacle.soundId) {
                    playNoteSound(obstacle.soundId);  // Use per-note sound
                } else {
                    playHitSound(0);  // Fallback to default downHitSound
                }

                // Award points when obstacle touches the line
                game.score += 10;
                updateScore();
                // createParticles(flareX, flareY, 5);
            }

            // Remove obstacle only when its TOP (y) has passed below the line
            // (i.e., the entire obstacle has passed through)
            if (obstacle.y >= sliderLineY) {
                game.obstacles.splice(i, 1);
                continue;
            }

            // Check collision (only for obstacles that haven't reached the line yet)
            if (!settings.godMode && checkCollision(game.player, obstacle)) {
                gameOver();
                return;
            }

            if (obstacle.isOffScreen()) {
                game.obstacles.splice(i, 1);
            }
        }

        // Update and draw player
        if (game.player.update) {
            game.player.update();
        }
        // Draw player trail behind player
        drawPlayerTrail(ctx);
        game.player.draw(ctx);

        // Draw staged stagelight overlay to obscure notes/player in dark areas
        drawStagedStagelightOverlay(ctx, currentGameTime);
    }

    // Draw floating particles (behind other effects)
    drawFloatingParticles(ctx);

    // Common: Update and draw particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const particle = game.particles[i];
        particle.update();
        particle.draw(ctx);
        if (particle.isDead()) {
            game.particles.splice(i, 1);
            Particle.release(particle);
        }
    }

    // Common: Update and draw light flares (only if VFX enabled)
    if (settings.vfxEnabled) {
        for (let i = game.lightFlares.length - 1; i >= 0; i--) {
            const flare = game.lightFlares[i];
            flare.update();
            flare.draw(ctx);
            if (flare.isDead()) {
                game.lightFlares.splice(i, 1);
            }
        }
    }

    // Draw fever overlay on top of everything
    // drawFeverOverlay(ctx);

    // Draw glitch transition effect
    drawGlitchEffect(ctx);

    // Sync slider with player position
    syncSliderWithPlayer();

    // Continue loop
    game.animationId = requestAnimationFrame(multiPhaseGameLoop);
}

// Start game
export async function startGame() {
    // Open eyes dramatically first
    await openEyes();

    // Wait for the dramatic effect (eyes stay open for ~1 second)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Hide eyes and overlays
    hideEyes();

    // Stop any existing music
    if (game.music) {
        game.music.pause();
        game.music.currentTime = 0;
    }

    // Load chart if not already loaded
    if (!game.chart) {
        game.chart = await loadChart(CONFIG.CHART_FILE);
        if (!game.chart) {
            console.error('Failed to load chart, cannot start game');
            return;
        }
    }

    // Calculate travel time based on BPM from chart
    if (game.chart.bpm) {
        const baseBPM = 120;
        const baseTravelTime = 1200; // Updated to match faster gameplay
        CONFIG.TRAVEL_TIME = Math.round(baseTravelTime * (baseBPM / game.chart.bpm));
        console.log(`BPM: ${game.chart.bpm}, Travel Time: ${CONFIG.TRAVEL_TIME}ms`);
    }

    // Load music from chart if specified
    if (game.chart.music && !game.musicLoaded) {
        game.music = await loadMusic(game.chart.music);
        game.musicLoaded = true;

        // Add ended event listener to trigger game complete
        if (game.music) {
            game.music.addEventListener('ended', () => {
                if (game.isRunning && !game.isPaused) {
                    console.log('Music ended - triggering game complete');
                    gameComplete();
                }
            });
        }
    }

    // Load per-note sounds from chart if specified
    if (game.chart.sounds && Object.keys(game.loadedSounds).length === 0) {
        await loadChartSounds(game.chart.sounds);
    }

    // Set game mode to multiphase (only supported mode now)
    game.mode = 'multiphase';

    // Reset common game state
    resetGameState();

    // Setup phases
    // If no phases exist (legacy chart), create a default phase
    if (!game.chart.phases || game.chart.phases.length === 0) {
        console.log('No phases found, creating default dodge phase for legacy chart');
        game.chart.phases = [{
            type: 'dodge',
            startTime: 0,
            endTime: 999999999, // indefinite
            slides: game.chart.slides || []
        }];
    }

    // Multi-phase mode initialization
    game.currentPhaseIndex = -1;  // Will be set to 0 by updateCurrentPhase
    game.currentPhase = null;
    game.phaseMode = 'dodge';  // Default, will be updated
    game.chartSlides = [];  // Will be populated per phase

    // Initialize with first phase
    if (game.chart.phases && game.chart.phases.length > 0) {
        const firstPhase = game.chart.phases[0];
        game.phaseMode = firstPhase.type;
        game.currentPhaseIndex = 0;
        game.currentPhase = firstPhase;
        game.chartSlides = [...firstPhase.slides];

        // Set initial player based on first phase type
        if (firstPhase.type === 'touhou') {
            game.player = new TouhouPlayer();
        } else {
            game.player = new Player();
        }

        // Initialize controls visibility
        game.lastPhaseMode = game.phaseMode;
        updateControlsVisibility();
    }

    // Update UI
    updateScore();
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('gameComplete').classList.add('hidden');
    document.getElementById('pauseBtn').classList.remove('hidden');

    // Show/hide touch controls
    const touchControls = document.getElementById('touchControls');
    if (touchControls) {
        if (settings.touchControlsEnabled) {
            touchControls.classList.remove('hidden');
        } else {
            touchControls.classList.add('hidden');
        }
    }

    // Show/hide dodge slider based on initial phase and settings
    const dodgeSlider = document.getElementById('dodgeSlider');
    const shouldShowSlider = settings.dodgeSliderEnabled && game.phaseMode === 'dodge';
    if (shouldShowSlider) {
        dodgeSlider.classList.remove('hidden');
        // Reset slider to center position
        const playerSlider = document.getElementById('playerSlider');
        playerSlider.value = 50;
    } else {
        dodgeSlider.classList.add('hidden');
    }

    game.animationId = requestAnimationFrame((timestamp) => {
        game.gameStartTime = timestamp;

        // Apply settings before playback
        applySettings();

        // Start music playback synchronized with game start
        if (game.music) {
            game.music.currentTime = 0;
            game.music.volume = settings.musicVolume;
            game.music.play().catch(e => console.log('Music autoplay blocked:', e));
        }

        // Start background video synchronized with game
        if (game.bgVideo) {
            game.bgVideo.currentTime = 0;
            game.bgVideo.style.display = settings.bgVideoEnabled ? 'block' : 'none';
            game.bgVideo.play().catch(e => console.log('Video autoplay blocked:', e));
        }

        multiPhaseGameLoop(timestamp);
    });

    console.log('Game started in multiphase mode');
}

// Start game skipping to a specific time (in ms)
export async function startGameAt(skipToTime) {
    // Open eyes dramatically first
    await openEyes();

    // Wait for the dramatic effect (eyes stay open for ~1 second)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Hide eyes and overlays
    hideEyes();

    // Stop any existing music
    if (game.music) {
        game.music.pause();
        game.music.currentTime = 0;
    }

    // Load chart if not already loaded
    if (!game.chart) {
        game.chart = await loadChart(CONFIG.CHART_FILE);
        if (!game.chart) {
            console.error('Failed to load chart, cannot start game');
            return;
        }
    }

    // Calculate travel time based on BPM from chart
    if (game.chart.bpm) {
        const baseBPM = 120;
        const baseTravelTime = 1200;
        CONFIG.TRAVEL_TIME = Math.round(baseTravelTime * (baseBPM / game.chart.bpm));
    }

    // Load music from chart if specified
    if (game.chart.music && !game.musicLoaded) {
        game.music = await loadMusic(game.chart.music);
        game.musicLoaded = true;

        if (game.music) {
            game.music.addEventListener('ended', () => {
                if (game.isRunning && !game.isPaused) {
                    gameComplete();
                }
            });
        }
    }

    // Load per-note sounds from chart if specified
    if (game.chart.sounds && Object.keys(game.loadedSounds).length === 0) {
        await loadChartSounds(game.chart.sounds);
    }

    // Set game mode
    game.mode = 'multiphase';

    // Reset game state
    resetGameState();

    // Find the phase that contains skipToTime
    let targetPhaseIndex = 0;
    for (let i = 0; i < game.chart.phases.length; i++) {
        const phase = game.chart.phases[i];
        if (skipToTime >= phase.startTime && skipToTime < phase.endTime) {
            targetPhaseIndex = i;
            break;
        }
    }

    const targetPhase = game.chart.phases[targetPhaseIndex];
    game.currentPhaseIndex = targetPhaseIndex;
    game.currentPhase = targetPhase;
    game.phaseMode = targetPhase.type;
    game.lastPhaseMode = targetPhase.type; // Initialize lastPhaseMode

    // Filter slides to only include those after skipToTime
    game.chartSlides = targetPhase.slides.filter(s => s.startTime >= skipToTime);
    game.nextSlideIndex = 0;

    // Set player based on phase type
    if (targetPhase.type === 'touhou') {
        game.player = new TouhouPlayer();
        game.enemyBullets = [];
        game.touhouSpawners = [];
        game.grazeCount = 0;
    } else {
        game.player = new Player();
    }

    // Initialize controls visibility
    updateControlsVisibility();

    // Update UI
    updateScore();
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('gameComplete').classList.add('hidden');
    document.getElementById('dodgeSlider').classList.add('hidden');
    document.getElementById('pauseBtn').classList.remove('hidden');

    // Show/hide touch controls
    const touchControls = document.getElementById('touchControls');
    if (touchControls) {
        if (settings.touchControlsEnabled) {
            touchControls.classList.remove('hidden');
        } else {
            touchControls.classList.add('hidden');
        }
    }

    game.animationId = requestAnimationFrame((timestamp) => {
        game.gameStartTime = timestamp;

        applySettings();

        // Start music at the skip time
        if (game.music) {
            game.music.currentTime = skipToTime / 1000;
            game.music.volume = settings.musicVolume;
            game.music.play().catch(e => console.log('Music autoplay blocked:', e));
        }

        // Start video at the skip time
        if (game.bgVideo) {
            game.bgVideo.currentTime = skipToTime / 1000;
            game.bgVideo.style.display = settings.bgVideoEnabled ? 'block' : 'none';
            game.bgVideo.play().catch(e => console.log('Video autoplay blocked:', e));
        }

        multiPhaseGameLoop(timestamp);
    });

    console.log(`Game started at ${skipToTime}ms, phase: ${targetPhase.type}`);
}

// Start game in playback mode with a playback file
export async function startPlaybackGame(playbackFile) {
    // Load playback data
    game.playbackData = await loadPlaybackFile(playbackFile);
    if (!game.playbackData) {
        console.error('Failed to load playback file, cannot start playback');
        return;
    }

    // Set playback mode
    game.isPlaybackMode = true;
    game.playbackIndex = 0;

    console.log(`Starting playback mode with ${game.playbackData.actions.length} actions`);

    // Start the game
    await startGame();
}

// Game over
export function gameOver() {
    console.log('GAME OVER!');
    console.log('Final Stats:', {
        maxCombo: game.maxCombo,
        perfect: game.perfectCount,
        great: game.greatCount,
        bad: game.badCount,
        miss: game.missCount,
        graze: game.grazeCount
    });

    // Stop the game
    game.isRunning = false;
    cancelAnimationFrame(game.animationId);

    // Pause music and video
    if (game.music) {
        game.music.pause();
    }
    if (game.bgVideo) {
        game.bgVideo.pause();
    }

    // Update game over screen with stats
    document.getElementById('finalScore').textContent = game.score;
    document.getElementById('finalCombo').textContent = game.maxCombo;
    document.getElementById('finalGraze').textContent = game.grazeCount;

    // Hide dodge slider
    document.getElementById('dodgeSlider').classList.add('hidden');

    // Hide touch controls
    document.getElementById('touchControls').classList.add('hidden');

    // Show game over screen
    document.getElementById('gameOver').classList.remove('hidden');
}

// Game complete - called when music ends or all notes/obstacles are cleared
export function gameComplete() {
    console.log('STAGE CLEAR!');
    console.log('Final Stats:', {
        score: game.score,
        maxCombo: game.maxCombo,
        perfect: game.perfectCount,
        great: game.greatCount,
        bad: game.badCount,
        miss: game.missCount,
        graze: game.grazeCount
    });

    // Stop the game
    game.isRunning = false;
    cancelAnimationFrame(game.animationId);

    // Pause video (music already ended or will be paused)
    if (game.music) {
        game.music.pause();
    }
    if (game.bgVideo) {
        game.bgVideo.pause();
    }

    // Calculate accuracy percentage
    const totalNotes = game.perfectCount + game.greatCount + game.badCount + game.missCount;
    let accuracyPercent = 0;
    if (totalNotes > 0) {
        // Weight: PERFECT=100%, GREAT=75%, BAD=25%, MISS=0%
        const weightedScore = (game.perfectCount * 100) + (game.greatCount * 75) + (game.badCount * 25);
        accuracyPercent = weightedScore / totalNotes;
    }

    // Determine grade based on accuracy
    let grade = 'C';
    let gradeClass = 'grade-c';
    if (accuracyPercent >= 95) {
        grade = 'S';
        gradeClass = 'grade-s';
    } else if (accuracyPercent >= 85) {
        grade = 'A';
        gradeClass = 'grade-a';
    } else if (accuracyPercent >= 70) {
        grade = 'B';
        gradeClass = 'grade-b';
    }

    // Update game complete screen with stats
    document.getElementById('completeScore').textContent = game.score;
    document.getElementById('completeCombo').textContent = game.maxCombo;
    document.getElementById('completeGraze').textContent = game.grazeCount;

    // Update grade display
    const gradeElement = document.getElementById('completionGrade');
    gradeElement.textContent = grade;
    gradeElement.className = 'game-complete-grade ' + gradeClass;

    // Hide dodge slider
    document.getElementById('dodgeSlider').classList.add('hidden');

    // Hide touch controls
    document.getElementById('touchControls').classList.add('hidden');

    // Show game complete screen
    document.getElementById('gameComplete').classList.remove('hidden');
}

// Restart game from game complete screen
export function gameCompleteRestart() {
    // Hide game complete screen
    document.getElementById('gameComplete').classList.add('hidden');

    // Reset music to beginning
    if (game.music) {
        game.music.currentTime = 0;
    }
    if (game.bgVideo) {
        game.bgVideo.currentTime = 0;
    }

    // Start game
    startGame();
}

// Return to menu from game complete screen
export function gameCompleteReturnToMenu() {
    // Hide game complete screen
    document.getElementById('gameComplete').classList.add('hidden');

    // Stop music
    if (game.music) {
        game.music.pause();
        game.music.currentTime = 0;
    }
    if (game.bgVideo) {
        game.bgVideo.pause();
        game.bgVideo.currentTime = 0;
    }

    // Reset game state
    game.isRunning = false;
    game.musicLoaded = false;
    game.loadedSounds = {};

    // Clear canvas
    if (game.ctx) {
        game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
    }

    // Show menu and regenerate eyes
    showEyes();
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('ui-overlay').classList.add('hidden');
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('touchControls').classList.add('hidden');
}

// Restart game
export function restartGame() {
    // Hide game over screen
    document.getElementById('gameOver').classList.add('hidden');

    // Reset music to beginning
    if (game.music) {
        game.music.currentTime = 0;
    }
    if (game.bgVideo) {
        game.bgVideo.currentTime = 0;
    }

    // Start game
    startGame();
}

// Return to main menu
export function returnToMenu() {
    // Hide game over screen
    document.getElementById('gameOver').classList.add('hidden');

    // Hide dodge slider
    document.getElementById('dodgeSlider').classList.add('hidden');

    // Stop music
    if (game.music) {
        game.music.pause();
        game.music.currentTime = 0;
    }
    if (game.bgVideo) {
        game.bgVideo.pause();
        game.bgVideo.currentTime = 0;
    }

    // Reset game state
    game.isRunning = false;
    game.musicLoaded = false;
    game.loadedSounds = {};

    // Clear canvas
    if (game.ctx) {
        game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
    }

    // Show menu and regenerate eyes
    showEyes();
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('ui-overlay').classList.add('hidden');
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('dodgeSlider').classList.add('hidden');
    document.getElementById('touchControls').classList.add('hidden');
}

// Toggle pause
export function togglePause() {
    game.isPaused = !game.isPaused;
    document.getElementById('pauseBtn').textContent = game.isPaused ? '▶' : '⏸';

    // Show/hide pause menu
    const pauseMenu = document.getElementById('pauseMenu');
    if (game.isPaused) {
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
    }

    // Pause/resume music
    if (game.music) {
        if (game.isPaused) {
            game.music.pause();
        } else {
            game.music.play().catch(e => console.log('Music resume blocked:', e));
        }
    }

    // Pause/resume background video
    if (game.bgVideo) {
        if (game.isPaused) {
            game.bgVideo.pause();
        } else {
            game.bgVideo.play().catch(e => console.log('Video resume blocked:', e));
        }
    }

    if (!game.isPaused && game.isRunning) {
        game.animationId = requestAnimationFrame(multiPhaseGameLoop);
    }
}

// Resume game (called from pause menu) - with countdown
export function resumeGame() {
    if (!game.isPaused) return;

    // Hide pause menu immediately
    document.getElementById('pauseMenu').classList.add('hidden');

    // Show countdown
    const countdownEl = document.getElementById('countdown');
    countdownEl.classList.remove('hidden');

    let count = 3;
    countdownEl.textContent = count;

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count;
        } else {
            // Countdown finished, resume game
            clearInterval(countdownInterval);
            countdownEl.classList.add('hidden');
            togglePause();
        }
    }, 1000);
}

// Return to menu from pause (called from pause menu)
export function pauseReturnToMenu() {
    // Hide pause menu
    document.getElementById('pauseMenu').classList.add('hidden');

    // Reset pause state
    game.isPaused = false;
    document.getElementById('pauseBtn').textContent = '⏸';

    // Hide dodge slider
    document.getElementById('dodgeSlider').classList.add('hidden');

    // Stop music
    if (game.music) {
        game.music.pause();
        game.music.currentTime = 0;
    }
    if (game.bgVideo) {
        game.bgVideo.pause();
        game.bgVideo.currentTime = 0;
    }

    // Reset game state
    game.isRunning = false;
    cancelAnimationFrame(game.animationId);
    game.musicLoaded = false;
    game.loadedSounds = {};

    // Clear canvas
    if (game.ctx) {
        game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
    }

    // Ensure UI is clean
    const container = document.getElementById('game-container');
    if (container) {
        container.classList.remove('fever-mode', 'buildup-mode');
    }

    // Show menu and regenerate eyes
    showEyes();
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('ui-overlay').classList.add('hidden');
    document.getElementById('pauseBtn').classList.add('hidden');
    document.getElementById('touchControls').classList.add('hidden');
}

// Initialize game
export function init() {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');

    // Get background video element
    game.bgVideo = document.getElementById('bgVideo');

    // Load light flare image
    game.lightFlareImage = new Image();
    game.lightFlareImage.src = 'light_effect.png';

    // Load hand clap sprite
    game.handClapImage = new Image();
    game.handClapImage.src = 'hand_clap.png';

    // Load hit sound effects
    game.upHitSound = new Audio('up-hit.mp3');
    game.downHitSound = new Audio('down-hit.wav');
    // Preload sounds
    game.upHitSound.load();
    game.downHitSound.load();

    // Set canvas size with high-DPI support
    const dpr = window.devicePixelRatio || 1;
    game.canvas.width = CONFIG.WIDTH * dpr;
    game.canvas.height = CONFIG.HEIGHT * dpr;
    // Removed hardcoded pixel styles to allow CSS responsiveness
    // game.canvas.style.width = CONFIG.WIDTH + 'px';
    // game.canvas.style.height = CONFIG.HEIGHT + 'px';

    // Scale the context to account for the higher resolution
    game.ctx.scale(dpr, dpr);

    // Initial container size setup
    const container = document.getElementById('game-container');
    const updateSize = () => {
        const windowWidth = window.innerWidth;
        // Use visualViewport for accurate height on mobile browsers with dynamic UI
        const windowHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

        // Scale to fit the screen - use min to prevent overflow on either axis
        const scaleX = windowWidth / CONFIG.WIDTH;
        const scaleY = windowHeight / CONFIG.HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        console.log(`Window size: ${windowWidth}x${windowHeight}, Scale: ${scale.toFixed(2)}`);

        container.style.transform = `scale(${scale})`;

        // Mobile browser UI fix
        let vh = windowHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    // Also listen to visualViewport resize for mobile browser UI changes
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateSize);
    }

    // Generate eyes for menu background
    generateEyes();

    // Main menu buttons
    document.getElementById('startBtn').addEventListener('click', () => startGame());
    // 66 seconds = 1:06
    document.getElementById('skipBtn').addEventListener('click', () => startGameAt(66000));
    const creditsBtn = document.getElementById('creditsBtn');
    if (creditsBtn) {
        creditsBtn.addEventListener('click', () => {
            document.getElementById('menu').classList.add('hidden');
            document.getElementById('credits').classList.remove('hidden');
        });
    }

    // Credits back button
    document.getElementById('creditsBackBtn').addEventListener('click', () => {
        document.getElementById('credits').classList.add('hidden');
        document.getElementById('menu').classList.remove('hidden');
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('menu').classList.add('hidden');
        document.getElementById('settings').classList.remove('hidden');
    });

    // Settings back button
    document.getElementById('settingsBackBtn').addEventListener('click', () => {
        document.getElementById('settings').classList.add('hidden');
        document.getElementById('menu').classList.remove('hidden');
    });

    // Fullscreen toggle function
    const toggleFullscreen = () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Enter fullscreen
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                // Safari/iOS
                elem.webkitRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    };

    // Fullscreen buttons
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const menuFullscreenBtn = document.getElementById('menuFullscreenBtn');

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    if (menuFullscreenBtn) {
        menuFullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Update fullscreen button icon based on state
    const updateFullscreenIcon = () => {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        if (fullscreenBtn) {
            fullscreenBtn.textContent = isFullscreen ? '⛶' : '⛶';
            fullscreenBtn.title = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
        }
        if (menuFullscreenBtn) {
            menuFullscreenBtn.textContent = isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
        }
    };

    document.addEventListener('fullscreenchange', updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

    // Settings controls
    const musicVolumeSlider = document.getElementById('musicVolume');
    const sfxVolumeSlider = document.getElementById('sfxVolume');
    const bgVideoToggle = document.getElementById('bgVideoToggle');
    const vfxToggle = document.getElementById('vfxToggle');
    const dodgeSliderToggle = document.getElementById('dodgeSliderToggle');
    const touchControlsToggle = document.getElementById('touchControlsToggle');
    const godModeToggle = document.getElementById('godModeToggle');

    // Load saved settings and update UI
    loadSettings();

    // Update sliders and toggles to reflect loaded settings
    musicVolumeSlider.value = Math.round(settings.musicVolume * 100);
    document.getElementById('musicVolumeValue').textContent = Math.round(settings.musicVolume * 100) + '%';

    sfxVolumeSlider.value = Math.round(settings.sfxVolume * 100);
    document.getElementById('sfxVolumeValue').textContent = Math.round(settings.sfxVolume * 100) + '%';

    bgVideoToggle.textContent = settings.bgVideoEnabled ? 'ON' : 'OFF';
    bgVideoToggle.classList.toggle('active', settings.bgVideoEnabled);

    vfxToggle.textContent = settings.vfxEnabled ? 'ON' : 'OFF';
    vfxToggle.classList.toggle('active', settings.vfxEnabled);

    dodgeSliderToggle.textContent = settings.dodgeSliderEnabled ? 'ON' : 'OFF';
    dodgeSliderToggle.classList.toggle('active', settings.dodgeSliderEnabled);

    touchControlsToggle.textContent = settings.touchControlsEnabled ? 'ON' : 'OFF';
    touchControlsToggle.classList.toggle('active', settings.touchControlsEnabled);

    godModeToggle.textContent = settings.godMode ? 'ON' : 'OFF';
    godModeToggle.classList.toggle('active', settings.godMode);

    // Music volume slider
    musicVolumeSlider.addEventListener('input', (e) => {
        settings.musicVolume = e.target.value / 100;
        document.getElementById('musicVolumeValue').textContent = e.target.value + '%';
        applySettings();
        saveSettings();
    });

    // SFX volume slider
    sfxVolumeSlider.addEventListener('input', (e) => {
        settings.sfxVolume = e.target.value / 100;
        document.getElementById('sfxVolumeValue').textContent = e.target.value + '%';
        applySettings();
        saveSettings();
    });

    // Background video toggle
    bgVideoToggle.addEventListener('click', () => {
        settings.bgVideoEnabled = !settings.bgVideoEnabled;
        bgVideoToggle.textContent = settings.bgVideoEnabled ? 'ON' : 'OFF';
        bgVideoToggle.classList.toggle('active', settings.bgVideoEnabled);
        applySettings();
        saveSettings();
    });

    // Visual effects toggle
    vfxToggle.addEventListener('click', () => {
        settings.vfxEnabled = !settings.vfxEnabled;
        vfxToggle.textContent = settings.vfxEnabled ? 'ON' : 'OFF';
        vfxToggle.classList.toggle('active', settings.vfxEnabled);
        applySettings();
        saveSettings();
    });

    // Dodge slider control toggle
    dodgeSliderToggle.addEventListener('click', () => {
        settings.dodgeSliderEnabled = !settings.dodgeSliderEnabled;
        dodgeSliderToggle.textContent = settings.dodgeSliderEnabled ? 'ON' : 'OFF';
        dodgeSliderToggle.classList.toggle('active', settings.dodgeSliderEnabled);
        saveSettings();
    });

    // Touch controls toggle
    touchControlsToggle.addEventListener('click', () => {
        settings.touchControlsEnabled = !settings.touchControlsEnabled;
        touchControlsToggle.textContent = settings.touchControlsEnabled ? 'ON' : 'OFF';
        touchControlsToggle.classList.toggle('active', settings.touchControlsEnabled);

        // Show/hide touch controls based on new setting
        const touchControls = document.getElementById('touchControls');
        if (touchControls) {
            // Force show if enabled by user, regardless of mobile check
            if (settings.touchControlsEnabled) {
                touchControls.classList.remove('hidden');
            } else {
                touchControls.classList.add('hidden');
            }
        }

        saveSettings();
    });

    // God mode toggle
    godModeToggle.addEventListener('click', () => {
        settings.godMode = !settings.godMode;
        godModeToggle.textContent = settings.godMode ? 'ON' : 'OFF';
        godModeToggle.classList.toggle('active', settings.godMode);
        saveSettings();
    });

    // Dodge slider input handler
    const playerSlider = document.getElementById('playerSlider');
    playerSlider.addEventListener('input', (e) => {
        if (!game.isRunning || game.isPaused) return;
        if (!settings.dodgeSliderEnabled) return;

        // Only affect dodge mode
        if (game.phaseMode !== 'dodge') return;

        // Map slider value (0-100) to player X position
        const sliderValue = parseInt(e.target.value);
        const maxX = CONFIG.WIDTH - game.player.size;
        game.player.x = (sliderValue / 100) * maxX;
        game.player.velocity = 0; // Stop any momentum
    });

    // Game over buttons
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.getElementById('menuBtn').addEventListener('click', returnToMenu);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);

    // Pause menu buttons
    document.getElementById('resumeBtn').addEventListener('click', resumeGame);
    document.getElementById('pauseMenuBtn').addEventListener('click', pauseReturnToMenu);

    // Game complete buttons
    document.getElementById('completeRestartBtn').addEventListener('click', gameCompleteRestart);
    document.getElementById('completeMenuBtn').addEventListener('click', gameCompleteReturnToMenu);

    // Touch/Button Controls
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const upBtn = document.getElementById('upBtn');
    const downBtn = document.getElementById('downBtn');

    // Left side controls
    const leftBtnLeft = document.getElementById('leftBtnLeft');
    const rightBtnLeft = document.getElementById('rightBtnLeft');
    const upBtnLeft = document.getElementById('upBtnLeft');
    const downBtnLeft = document.getElementById('downBtnLeft');

    const startLeft = (e) => {
        if (e.cancelable) e.preventDefault();
        if (!game.isRunning || game.isPaused) return;

        if (isTouhouMode()) {
            game.player.movingLeft = true;
        } else {
            game.player.moveLeft();
        }
        if (leftBtn) leftBtn.classList.add('active');
        if (leftBtnLeft) leftBtnLeft.classList.add('active');
    };

    const stopLeft = (e) => {
        if (e.cancelable) e.preventDefault();

        if (isTouhouMode()) {
            game.player.movingLeft = false;
        } else {
            if (game.player.stopLeft) game.player.stopLeft();
        }
        if (leftBtn) leftBtn.classList.remove('active');
        if (leftBtnLeft) leftBtnLeft.classList.remove('active');
    };

    const startRight = (e) => {
        if (e.cancelable) e.preventDefault();
        if (!game.isRunning || game.isPaused) return;

        if (isTouhouMode()) {
            game.player.movingRight = true;
        } else {
            game.player.moveRight();
        }
        if (rightBtn) rightBtn.classList.add('active');
        if (rightBtnLeft) rightBtnLeft.classList.add('active');
    };

    const stopRight = (e) => {
        if (e.cancelable) e.preventDefault();

        if (isTouhouMode()) {
            game.player.movingRight = false;
        } else {
            if (game.player.stopRight) game.player.stopRight();
        }
        if (rightBtn) rightBtn.classList.remove('active');
        if (rightBtnLeft) rightBtnLeft.classList.remove('active');
    };

    const startUp = (e) => {
        if (e.cancelable) e.preventDefault();
        if (!game.isRunning || game.isPaused) return;

        if (isTouhouMode()) {
            game.player.movingUp = true;
        }
        if (upBtn) upBtn.classList.add('active');
        if (upBtnLeft) upBtnLeft.classList.add('active');
    };

    const stopUp = (e) => {
        if (e.cancelable) e.preventDefault();

        if (isTouhouMode()) {
            game.player.movingUp = false;
        }
        if (upBtn) upBtn.classList.remove('active');
        if (upBtnLeft) upBtnLeft.classList.remove('active');
    };

    const startDown = (e) => {
        if (e.cancelable) e.preventDefault();
        if (!game.isRunning || game.isPaused) return;

        if (isTouhouMode()) {
            game.player.movingDown = true;
        }
        if (downBtn) downBtn.classList.add('active');
        if (downBtnLeft) downBtnLeft.classList.add('active');
    };

    const stopDown = (e) => {
        if (e.cancelable) e.preventDefault();

        if (isTouhouMode()) {
            game.player.movingDown = false;
        }
        if (downBtn) downBtn.classList.remove('active');
        if (downBtnLeft) downBtnLeft.classList.remove('active');
    };

    // Add listeners with passive: false to prevent scrolling/zooming
    // Right side controls
    if (leftBtn) {
        leftBtn.addEventListener('mousedown', startLeft);
        leftBtn.addEventListener('touchstart', startLeft, { passive: false });
        leftBtn.addEventListener('mouseup', stopLeft);
        leftBtn.addEventListener('touchend', stopLeft);
        leftBtn.addEventListener('mouseleave', stopLeft);
    }

    if (rightBtn) {
        rightBtn.addEventListener('mousedown', startRight);
        rightBtn.addEventListener('touchstart', startRight, { passive: false });
        rightBtn.addEventListener('mouseup', stopRight);
        rightBtn.addEventListener('touchend', stopRight);
        rightBtn.addEventListener('mouseleave', stopRight);
    }

    if (upBtn) {
        upBtn.addEventListener('mousedown', startUp);
        upBtn.addEventListener('touchstart', startUp, { passive: false });
        upBtn.addEventListener('mouseup', stopUp);
        upBtn.addEventListener('touchend', stopUp);
        upBtn.addEventListener('mouseleave', stopUp);
    }

    if (downBtn) {
        downBtn.addEventListener('mousedown', startDown);
        downBtn.addEventListener('touchstart', startDown, { passive: false });
        downBtn.addEventListener('mouseup', stopDown);
        downBtn.addEventListener('touchend', stopDown);
        downBtn.addEventListener('mouseleave', stopDown);
    }

    // Left side controls
    if (leftBtnLeft) {
        leftBtnLeft.addEventListener('mousedown', startLeft);
        leftBtnLeft.addEventListener('touchstart', startLeft, { passive: false });
        leftBtnLeft.addEventListener('mouseup', stopLeft);
        leftBtnLeft.addEventListener('touchend', stopLeft);
        leftBtnLeft.addEventListener('mouseleave', stopLeft);
    }

    if (rightBtnLeft) {
        rightBtnLeft.addEventListener('mousedown', startRight);
        rightBtnLeft.addEventListener('touchstart', startRight, { passive: false });
        rightBtnLeft.addEventListener('mouseup', stopRight);
        rightBtnLeft.addEventListener('touchend', stopRight);
        rightBtnLeft.addEventListener('mouseleave', stopRight);
    }

    if (upBtnLeft) {
        upBtnLeft.addEventListener('mousedown', startUp);
        upBtnLeft.addEventListener('touchstart', startUp, { passive: false });
        upBtnLeft.addEventListener('mouseup', stopUp);
        upBtnLeft.addEventListener('touchend', stopUp);
        upBtnLeft.addEventListener('mouseleave', stopUp);
    }

    if (downBtnLeft) {
        downBtnLeft.addEventListener('mousedown', startDown);
        downBtnLeft.addEventListener('touchstart', startDown, { passive: false });
        downBtnLeft.addEventListener('mouseup', stopDown);
        downBtnLeft.addEventListener('touchend', stopDown);
        downBtnLeft.addEventListener('mouseleave', stopDown);
    }

    // Keyboard controls (mode-aware)
    document.addEventListener('keydown', (e) => {
        if (!game.isRunning || game.isPaused) return;

        if (isTouhouMode()) {
            // Touhou mode: WASD/Arrows for 2D movement, Shift for focus
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                game.player.movingLeft = true;
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                game.player.movingRight = true;
            } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                game.player.movingUp = true;
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                game.player.movingDown = true;
            } else if (e.key === 'Shift') {
                e.preventDefault();
                game.player.setFocus(true);
            }
        } else {
            // Dodge mode: Left/Right = move (smooth slider)
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                game.player.moveLeft();
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                game.player.moveRight();
            }
        }
    });

    // Track key releases
    document.addEventListener('keyup', (e) => {
        if (isTouhouMode()) {
            // Touhou mode: stop movement when key released
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                game.player.movingLeft = false;
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                game.player.movingRight = false;
            } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                game.player.movingUp = false;
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                game.player.movingDown = false;
            } else if (e.key === 'Shift') {
                game.player.setFocus(false);
            }
        } else {
            // Dodge mode: stop movement when key released
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                if (game.player.stopLeft) game.player.stopLeft();
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                if (game.player.stopRight) game.player.stopRight();
            }
        }
    });

    // Touch/tap controls for mobile
    game.canvas.addEventListener('touchstart', handleTap, { passive: false });
    game.canvas.addEventListener('click', handleTap);

    // Pre-load chart
    loadChart(CONFIG.CHART_FILE).then(chart => {
        game.chart = chart;
        console.log('Chart pre-loaded');
    });
}

// Start when page loads
window.addEventListener('load', () => {
    init();
});
