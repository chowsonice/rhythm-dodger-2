// Game Configuration
export const CONFIG = {
    WIDTH: 800,
    HEIGHT: 600,
    PLAYER_SIZE: 40,
    PLAYER_Y_OFFSET: 60,
    OBSTACLE_SPEED: 6,
    BPM: 180,
    NUMBER_OF_LANES: 10,
    CHART_FILE: 'chart.json',
    // Time in ms for obstacle to travel from spawn to player line
    TRAVEL_TIME: 1200,
    // Touhou mode config
    TOUHOU_PLAYER_SIZE: 4,        // Even tighter hitbox (was 5)
    TOUHOU_PLAYER_SPEED: 7,       // Faster normal movement (was 6)
    TOUHOU_FOCUS_SPEED: 3,        // Faster focus movement (was 2.5)
    TOUHOU_BULLET_RADIUS: 6,      // Smaller, sharper bullets (was 7)
    TOUHOU_GRAZE_RADIUS: 30,      // Even larger graze radius (was 25)
};
