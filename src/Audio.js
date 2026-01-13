import { game } from './GameState.js';
import { settings } from './Settings.js';

    // Load music from chart
    export async function loadMusic(musicFile) {
        return new Promise((resolve, reject) => {
            if (!musicFile) {
                console.log('No music file specified in chart');
                resolve(null);
                return;
            }

            const audio = new Audio(musicFile);
            audio.preload = 'auto';

            audio.addEventListener('canplaythrough', () => {
                console.log('Music loaded:', musicFile);
                resolve(audio);
            });

        audio.addEventListener('error', (e) => {
            console.error('Error loading music:', e);
            resolve(null);  // Don't reject, just play without music
        });

        audio.load();
    });
}

// Load sounds defined in the chart's sounds object
export async function loadChartSounds(sounds) {
    if (!sounds || typeof sounds !== 'object') {
        console.log('No sounds defined in chart');
        return;
    }

    const loadPromises = [];

    for (const [soundId, soundFile] of Object.entries(sounds)) {
        const promise = new Promise((resolve) => {
            const audio = new Audio(soundFile);
            audio.preload = 'auto';

            audio.addEventListener('canplaythrough', () => {
                console.log(`Sound loaded: ${soundId} -> ${soundFile}`);
                game.loadedSounds[soundId] = audio;
                resolve();
            });

            audio.addEventListener('error', (e) => {
                console.error(`Error loading sound ${soundId}:`, e);
                resolve();  // Don't fail, just skip this sound
            });

            audio.load();
        });
        loadPromises.push(promise);
    }

    await Promise.all(loadPromises);
    console.log('All chart sounds loaded:', Object.keys(game.loadedSounds));
}

// Play a note's assigned sound by its soundId
export function playNoteSound(soundId) {
    if (!soundId) return;  // No sound assigned

    // Support legacy/osu charts where clap might be named 'special2'
    if (soundId === 'clap' && !game.loadedSounds[soundId] && game.loadedSounds['special2']) {
        soundId = 'special2';
    }

    const sound = game.loadedSounds[soundId];
    if (sound) {
        // console.log('Playing note sound:', soundId);
        // Clone the audio to allow overlapping sounds
        const soundClone = sound.cloneNode();
        soundClone.volume = settings.sfxVolume;
        soundClone.play().catch(e => console.log('Audio play failed:', e));
    } else {
        console.warn(`Sound not found: ${soundId}`);
    }
}

// Play hit sound based on row
export function playHitSound(row) {
    // Use chart sounds if available (normal for ground/row 0, clap for jump/row 1)
    let soundId = row === 1 ? 'clap' : 'normal';

    // Support legacy/osu charts where clap might be named 'special2'
    if (soundId === 'clap' && !game.loadedSounds[soundId] && game.loadedSounds['special2']) {
        soundId = 'special2';
    }

    const chartSound = game.loadedSounds[soundId];

    // console.log('playHitSound called:', { row, soundId, chartSound: !!chartSound, loadedSounds: Object.keys(game.loadedSounds) });

    if (chartSound) {
        // Use chart sounds (same as dodge mode)
        console.log('Playing chart sound:', soundId);
        const soundClone = chartSound.cloneNode();
        soundClone.volume = settings.sfxVolume;
        soundClone.play().catch(e => console.log('Audio play failed:', e));
    } else {
        // Fallback to old separate audio files
        // console.log('Falling back to old sound files');
        const sound = row === 1 ? game.upHitSound : game.downHitSound;
        if (sound) {
            const soundClone = sound.cloneNode();
            soundClone.volume = settings.sfxVolume;
            soundClone.play().catch(e => console.log('Audio play failed:', e));
        }
    }
}
