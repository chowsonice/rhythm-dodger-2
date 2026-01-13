// Game State
export const game = {
    canvas: null,
    ctx: null,
    player: null,
    obstacles: [],
    particles: [],
    lightFlares: [],
    score: 0,
    isRunning: false,
    isPaused: false,
    animationId: null,
    lightFlareImage: null,
    handClapImage: null,  // Hand clap sprite
    // Sound effects
    upHitSound: null,
    downHitSound: null,
    loadedSounds: {},  // Per-note sounds loaded from chart
    // Background music
    music: null,
    musicLoaded: false,
    // Background video
    bgVideo: null,
    // Chart data
    chart: null,
    chartSlides: [],
    nextSlideIndex: 0,
    gameStartTime: 0,
    // Game mode: 'classic' or 'multiphase'
    mode: 'classic',
    // Multi-phase support
    currentPhaseIndex: 0,
    currentPhase: null,
    phaseMode: 'dodge',  // 'dodge' or 'touhou' - current active phase mode
    // Combo tracking
    combo: 0,
    maxCombo: 0,
    // Judgment display
    lastJudgment: null,      // 'PERFECT', 'GREAT', 'BAD', 'MISS'
    judgmentTime: 0,         // When judgment was shown
    judgmentDuration: 500,   // How long to show judgment (ms)
    // Hit statistics
    perfectCount: 0,
    greatCount: 0,
    badCount: 0,
    missCount: 0,
    // Playback mode
    isPlaybackMode: false,
    playbackData: null,
    playbackIndex: 0,
    // Stage lights state
    stageLightIntensity: 1.0,
    stageLightHue: 0,  // HSL hue value (0-360)
    stageLightLastBeat: 0,
    stageLightRotation: 0,  // Rotation angle for spinning effect
    stageLightDirection: 1, // 1 for clockwise, -1 for counter-clockwise
    stageLightColor: 'darkred', // 'darkred' or 'black'
    // Dynamic glow level system (0 = normal, 1 = build-up, 2 = fever/chorus)
    glowLevel: 0,           // Current interpolated glow level
    targetGlowLevel: 0,     // Target glow level from phase intensity
    screenPulse: 0,         // Screen pulse intensity for fever effects
    screenPulsePhase: 0,    // Phase of the screen pulse animation
    // Floating particles for fever mode
    floatingParticles: [],
    // Trail effect for player movement
    playerTrail: [],
    // Lyric system
    nextLyricIndex: 0,
    // Glitch effect
    glitchIntensity: 0,
    // Touhou mode specific
    enemyBullets: [],       // Array of enemy bullets to dodge
    grazeCount: 0,          // Number of bullets grazed (near-misses)
    touhouSpawners: [],     // Active bullet pattern spawners
};

export function resetGameState() {
    game.obstacles = [];
    game.particles = [];
    game.lightFlares = [];
    game.score = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.lastJudgment = null;
    game.perfectCount = 0;
    game.greatCount = 0;
    game.badCount = 0;
    game.missCount = 0;
    game.isRunning = true;
    game.isPaused = false;
    game.nextSlideIndex = 0;
    // Reset stage lights
    game.stageLightIntensity = 1.0;
    game.stageLightLastBeat = 0;
    game.stageLightRotation = 0;
    game.stageLightDirection = 1;
    // Reset glow level system
    game.glowLevel = 0;
    game.targetGlowLevel = 0;
    game.screenPulse = 0;
    game.screenPulsePhase = 0;
    game.floatingParticles = [];
    game.playerTrail = [];
    game.nextLyricIndex = 0;
    game.glitchIntensity = 0;
    // Reset Touhou mode state
    game.enemyBullets = [];
    game.grazeCount = 0;
    game.touhouSpawners = [];

    // Reset playback mode if not already set by startPlaybackGame
    if (!game.isPlaybackMode) {
        game.playbackData = null;
        game.playbackIndex = 0;
    }
}
