import { game } from './GameState.js';
import { CONFIG } from './Config.js';
import { settings } from './Settings.js';

// Sync the dodge slider position with the player's X position
export function syncSliderWithPlayer() {
    if (!settings.touchModeEnabled) return;
    if (game.phaseMode !== 'dodge') return;
    if (!game.player) return;

    const slider = document.getElementById('playerSlider');
    if (!slider) return;

    // Map player X position to slider value (0-100)
    const maxX = CONFIG.WIDTH - game.player.size;
    const sliderValue = (game.player.x / maxX) * 100;
    slider.value = Math.max(0, Math.min(100, sliderValue));
}

// Helper: check if current mode is Touhou bullet hell
export function isTouhouMode() {
    return game.mode === 'multiphase' && game.phaseMode === 'touhou';
}

// Update score display
export function updateScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Score: ${game.score}`;
    }
}

// Handle tap/click for mobile and desktop
export function handleTap(e) {
    if (!game.isRunning || game.isPaused) return;

    // Get click/tap position
    let clientX, clientY;
    if (e.type === 'touchstart') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Ignore taps on the pause button
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseBtnRect = pauseBtn.getBoundingClientRect();
    if (clientX >= pauseBtnRect.left && clientX <= pauseBtnRect.right &&
        clientY >= pauseBtnRect.top && clientY <= pauseBtnRect.bottom) {
        return; // Let the pause button handle this
    }

    e.preventDefault();

    // Get canvas bounds
    const canvasRect = game.canvas.getBoundingClientRect();

    if (isTouhouMode()) {
        // Touhou mode: no special tap handling needed yet
    } else {
        // Dodge mode: left/right movement (simulate keypress with brief press and release)
        const canvasCenterX = canvasRect.left + canvasRect.width / 2;
        if (clientX < canvasCenterX) {
            if (game.player.moveLeft) game.player.moveLeft();
            // Simulate key release after a short delay
            setTimeout(() => {
                if (game.player.stopLeft) game.player.stopLeft();
            }, 100);
        } else {
            if (game.player.moveRight) game.player.moveRight();
            // Simulate key release after a short delay
            setTimeout(() => {
                if (game.player.stopRight) game.player.stopRight();
            }, 100);
        }
    }
}
