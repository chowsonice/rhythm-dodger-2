import { CONFIG } from './Config.js';
import { game } from './GameState.js';
import { settings } from './Settings.js';
import { Obstacle, BulletSpawner } from './Obstacle.js';
import { Player, TouhouPlayer } from './Player.js';

// Dialogue lines organized by character length for duration-based selection
// Theme: Inner turmoil, hiding one's true self, fear of being seen, self-loathing
const DIALOGUES = {
    // Very short (1 char) - for quick notes
    tiny: [
        "嘘", // lie
        "罪", // sin
        "闇", // darkness
        "痛", // pain
        "怖", // scared
        "逃", // escape
        "👁", // eye
    ],
    // Short (2-3 chars) - for short notes
    short: [
        "やめて",     // stop it
        "消えて",     // disappear
        "ごめん",     // sorry
        "嫌い",       // I hate
        "助けて",     // help me
        "見ないで",   // don't look
        "怖い",       // I'm scared
        "逃げたい",   // want to escape
        "疲れた",     // I'm tired
        "もう無理",   // can't anymore
    ],
    // Medium (4-5 chars) - for medium notes
    medium: [
        "本当の私",         // the real me
        "誰も分からない",   // no one understands
        "笑顔は嘘",         // my smile is a lie
        "壊れそう",         // about to break
        "息ができない",     // can't breathe
        "独りにして",       // leave me alone
        "全部消したい",     // want to erase it all
        "何が正解？",       // what's the answer?
        "もう限界",         // at my limit
        "誰か気づいて",     // someone notice me
        "心が痛い",         // my heart hurts
        "仮面の下",         // beneath the mask
    ],
    // Long (6+ chars) - for longer notes
    long: [
        "この醜い心を見ないで",     // don't look at this ugly heart
        "私なんか消えればいい",     // I should just disappear
        "誰にも理解されない",       // understood by no one
        "本当の私は怖いでしょう",   // the real me is scary, right?
        "笑顔の裏側、見える？",     // can you see behind my smile?
        "もう疲れたよ、全部",       // I'm tired of everything
        "化けの皮が剥がれる",       // the mask is peeling off
        "綺麗なふりも限界",         // can't pretend to be pretty anymore
        "誰も本当の私を知らない",   // no one knows the real me
        "この花は毒を持っている",   // this flower holds poison
        "愛されたいのに怖い",       // want to be loved but I'm scared
        "全部嘘だったらいいのに",   // wish it was all a lie
        "心の中は真っ暗",           // inside my heart is pitch black
        "助けてって言えない",       // can't say "help me"
        "もう誰も信じられない",     // can't trust anyone anymore
        "この仮面、外せない",       // can't take off this mask
    ],
};

// Select dialogue based on obstacle duration
function selectDialogue(duration) {
    // Duration thresholds (in milliseconds)
    const TINY_THRESHOLD = 150;
    const SHORT_THRESHOLD = 300;
    const MEDIUM_THRESHOLD = 600;

    let pool;
    if (duration <= TINY_THRESHOLD) {
        pool = DIALOGUES.tiny;
    } else if (duration <= SHORT_THRESHOLD) {
        pool = DIALOGUES.short;
    } else if (duration <= MEDIUM_THRESHOLD) {
        pool = DIALOGUES.medium;
    } else {
        pool = DIALOGUES.long;
    }

    // Random selection from the appropriate pool
    return pool[Math.floor(Math.random() * pool.length)];
}

// Load chart from JSON file
export async function loadChart(chartFile) {
    try {
        const response = await fetch(chartFile);
        if (!response.ok) {
            throw new Error(`Failed to load chart: ${response.status}`);
        }
        const chart = await response.json();
        console.log('Chart loaded:', chart);
        return chart;
    } catch (error) {
        console.error('Error loading chart:', error);
        return null;
    }
}

// Spawn obstacle from chart data
export function spawnChartObstacle(slideData) {
    // Calculate duration and select appropriate dialogue
    const duration = slideData.endTime - slideData.startTime;
    const lyric = selectDialogue(duration);

    // Determine sound ID: use explicit sound, or derive from noteType
    let soundId = slideData.sound;
    if (!soundId && slideData.noteType) {
        soundId = slideData.noteType;
    }

    const obstacle = new Obstacle(slideData.lane, slideData.startTime, slideData.endTime, soundId, lyric);
    game.obstacles.push(obstacle);
    // console.log(`Spawned obstacle: lane=${slideData.lane}, start=${slideData.startTime}, end=${slideData.endTime}, duration=${duration}ms, lyric=${lyric}`);
}

// Check and spawn obstacles based on current game time
export function updateChartSpawning(currentGameTime) {
    if (!game.chartSlides || game.nextSlideIndex >= game.chartSlides.length) {
        return;
    }

    // Calculate spawn time: obstacle should spawn TRAVEL_TIME before startTime
    // so it reaches the player line exactly at startTime
    while (game.nextSlideIndex < game.chartSlides.length) {
        const slide = game.chartSlides[game.nextSlideIndex];
        const spawnTime = slide.startTime - CONFIG.TRAVEL_TIME;

        if (currentGameTime >= spawnTime) {
            spawnChartObstacle(slide);
            game.nextSlideIndex++;
        } else {
            break;
        }
    }
}

// Spawn bullet pattern for Touhou mode
export function spawnTouhouPattern(patternData) {
    const spawner = new BulletSpawner(patternData.pattern, patternData.startTime, {
        x: patternData.x,
        y: patternData.y,
        bulletSpeed: patternData.bulletSpeed,
        bulletCount: patternData.bulletCount,
        duration: patternData.duration,
        interval: patternData.interval,
        color: patternData.color,
        glowColor: patternData.glowColor,
        bulletRadius: patternData.bulletRadius,
        startAngle: patternData.startAngle,
        angleStep: patternData.angleStep,
        soundId: patternData.soundId  // Pass soundId to play on spawn
    });
    game.touhouSpawners.push(spawner);
    // console.log(`Spawned Touhou pattern: ${patternData.pattern} at (${spawner.x}, ${spawner.y}), sound=${patternData.soundId || 'none'}`);
}

// Update Touhou mode pattern spawning
export function updateTouhouSpawning(currentGameTime) {
    if (!game.chartSlides || game.nextSlideIndex >= game.chartSlides.length) {
        return;
    }

    while (game.nextSlideIndex < game.chartSlides.length) {
        const pattern = game.chartSlides[game.nextSlideIndex];

        // Spawn pattern slightly before its start time
        if (currentGameTime >= pattern.startTime - 100) {
            spawnTouhouPattern(pattern);
            game.nextSlideIndex++;
        } else {
            break;
        }
    }
}

// Update current phase based on game time (multi-phase support)
export function updateCurrentPhase(currentGameTime) {
    if (!game.chart || !game.chart.phases) return;

    const phases = game.chart.phases;

    // Find which phase we should be in
    for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        if (currentGameTime >= phase.startTime && currentGameTime < phase.endTime) {
            // Check if we need to switch phases
            if (game.currentPhaseIndex !== i) {
                console.log(`Switching to phase ${i}: ${phase.type} (${phase.startTime}ms - ${phase.endTime}ms), intensity: ${phase.intensity}`);

                game.currentPhaseIndex = i;
                game.currentPhase = phase;
                game.phaseMode = phase.type;
                game.glitchIntensity = 1.0;

                // Clear existing obstacles when switching phases
                game.obstacles = [];

                // Setup slides for this phase
                game.chartSlides = [...phase.slides];
                game.nextSlideIndex = 0;

                // Switch player type based on phase
                if (phase.type === 'touhou') {
                    game.player = new TouhouPlayer();
                    // Clear touhou-specific state
                    game.enemyBullets = [];
                    game.touhouSpawners = [];
                    game.grazeCount = 0;
                    // Hide dodge slider in touhou mode
                    document.getElementById('dodgeSlider').classList.add('hidden');
                } else {
                    game.player = new Player();
                    // Show dodge slider in dodge mode if enabled
                    const dodgeSlider = document.getElementById('dodgeSlider');
                    if (settings.dodgeSliderEnabled) {
                        dodgeSlider.classList.remove('hidden');
                        document.getElementById('playerSlider').value = 50;
                    } else {
                        dodgeSlider.classList.add('hidden');
                    }
                }
            }
            return;
        }
    }
}
