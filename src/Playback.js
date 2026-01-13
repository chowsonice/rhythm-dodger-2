import { game } from './GameState.js';

// Load playback data from JSON file
export async function loadPlaybackFile(playbackFile) {
    try {
        const response = await fetch(playbackFile);
        if (!response.ok) {
            throw new Error(`Failed to load playback file: ${response.status}`);
        }
        const playbackData = await response.json();
        console.log('Playback data loaded:', playbackData);
        return playbackData;
    } catch (error) {
        console.error('Error loading playback file:', error);
        return null;
    }
}

// Process playback actions based on current game time
export function processPlaybackActions(currentGameTime) {
    if (!game.isPlaybackMode || !game.playbackData || !game.playbackData.actions) {
        return;
    }

    const actions = game.playbackData.actions;

    // Process all actions that should have triggered by now
    while (game.playbackIndex < actions.length) {
        const action = actions[game.playbackIndex];

        if (currentGameTime >= action.time) {
            // Execute the action
            executePlaybackAction(action.action);
            game.playbackIndex++;
        } else {
            break;
        }
    }
}

// Execute a single playback action
function executePlaybackAction(actionName) {
    if (!game.player) return;

    console.log(`Executing playback action: ${actionName}`);

    switch (actionName) {
        // Dodge/Classic mode actions
        case 'moveLeft':
            if (game.player.moveLeft) game.player.moveLeft();
            break;
        case 'moveRight':
            if (game.player.moveRight) game.player.moveRight();
            break;
        case 'stopLeft':
            if (game.player.stopLeft) game.player.stopLeft();
            break;
        case 'stopRight':
            if (game.player.stopRight) game.player.stopRight();
            break;
        default:
            console.warn(`Unknown playback action: ${actionName}`);
    }
}
