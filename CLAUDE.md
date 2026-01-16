# Rhythm Dodger 2 - BAKENOHANA (化けの花)

## Overview

**Rhythm Dodger 2** is a browser-based rhythm game that combines two gameplay styles: **Dodge Mode** (rhythm-based obstacle avoidance) and **Touhou Mode** (bullet hell dodging). The game features the song "BAKENOHANA" (化けの花 - "Flower of Deception") and explores dark, psychological themes of inner turmoil, self-loathing, and hiding one's true self.

## Technology Stack

- **Pure JavaScript (ES6 Modules)** - No frameworks or build tools
- **HTML5 Canvas** - Core game rendering
- **CSS3** - UI styling with visual effects (scanlines, glitch effects, vignettes)
- **Web Audio API** - Music and sound effect playback
- **JSON** - Chart/beatmap data format

## Project Structure

```
rhythm-dodger-2/
├── index.html          # Main HTML with UI screens (menu, settings, pause, game over)
├── style.css           # Styling for UI and visual effects
├── chart.json          # Beatmap data (notes, phases, timing)
├── audio.ogg           # Background music
├── bg.mp4              # Background video
├── light_effect.png    # Light flare sprite
├── hand_clap.png       # Hand clap sprite
├── osu-chart/          # Converted osu! chart sounds
└── src/
    ├── main.js         # Game initialization, main loop, event handlers
    ├── Config.js       # Game configuration constants
    ├── GameState.js    # Centralized game state object
    ├── Settings.js     # User settings (volume, toggles) with localStorage persistence
    ├── Player.js       # Player classes (Dodge mode & Touhou mode)
    ├── Obstacle.js     # Obstacles, bullets, and bullet spawners
    ├── Chart.js        # Chart loading and spawning logic
    ├── Graphics.js     # Visual effects (particles, flares, stage lights, glitch)
    ├── Audio.js        # Music and sound loading/playback
    ├── Input.js        # Input handling utilities
    ├── Playback.js     # Replay/playback system
    └── Eyes.js         # Animated eyes menu background
```

## Game Modes

### 1. Dodge Mode
- **Controls**: Left/Right arrows or A/D keys
- **Gameplay**: Obstacles (styled as Japanese text/lyrics) fall from the top of the screen. The player moves horizontally along a slider at the bottom to avoid collisions.
- **Scoring**: +10 points when obstacles cross the player line
- **Visual Style**: Falling Japanese characters with chromatic aberration, glitch effects, and "hyperventilating" pulse animation

### 2. Touhou Mode (Bullet Hell)
- **Controls**: WASD or Arrow keys for 8-directional movement, Shift for focus (slow) mode
- **Gameplay**: Dodge bullet patterns spawned from various positions
- **Graze System**: Near-misses award bonus points (+10 per graze)
- **Hitbox**: Tiny circular hitbox (4px radius) for precise dodging
- **Visual Style**: Player appearance changes based on stress level (graze count)

## Core Architecture

### Game Loop ([main.js:74](src/main.js#L74))
The `multiPhaseGameLoop()` function handles:
1. Phase switching between dodge and touhou modes
2. Obstacle/bullet spawning synced to audio time
3. Collision detection
4. Player updates and rendering
5. Particle and visual effects

### Chart System ([Chart.js](src/Chart.js))
- Charts define **phases** (dodge or touhou) with start/end times
- Each phase contains **slides** (obstacles) or **patterns** (bullet spawners)
- Notes are spawned `TRAVEL_TIME` ms before they should reach the player line
- Lyrics are dynamically assigned based on note duration

### Player Classes ([Player.js](src/Player.js))
- **Player** (Dodge mode): Horizontal movement with physics (acceleration, friction, max speed)
- **TouhouPlayer** (Bullet hell): Free 2D movement with focus mode for precision dodging

### Obstacle System ([Obstacle.js](src/Obstacle.js))
- **Obstacle**: Falling notes with lyric text, RGB split effects, and optional "glitch" lane-switching
- **EnemyBullet**: Bullet hell projectiles with object pooling for performance
- **BulletSpawner**: Creates bullet patterns (spiral, radial, aimed, wave, random)

## Visual Effects

- **Chromatic Aberration**: RGB color splitting on obstacles
- **Stage Lights**: Dynamic lighting that pulses with the beat
- **Glitch Effects**: Screen distortion during phase transitions
- **Particle System**: Explosion effects and floating particles
- **Player Trail**: Motion trail behind the player
- **Eyes Background**: Animated eyes that follow the cursor on the menu screen
- **Scanlines/CRT Effect**: Retro display overlay

## Configuration ([Config.js](src/Config.js))

| Constant | Value | Description |
|----------|-------|-------------|
| WIDTH/HEIGHT | 800x600 | Canvas dimensions |
| PLAYER_SIZE | 40 | Dodge mode player size |
| TRAVEL_TIME | 1200ms | Time for obstacles to fall (adjusted by BPM) |
| NUMBER_OF_LANES | 10 | Horizontal lane divisions |
| TOUHOU_PLAYER_SIZE | 4 | Bullet hell hitbox radius |
| TOUHOU_GRAZE_RADIUS | 30 | Graze detection range |

## Settings (Persisted in localStorage)

- Music Volume
- SFX Volume
- Background Video toggle
- Visual Effects toggle
- Dodge Slider Control toggle
- Touch Controls toggle
- God Mode (invincibility for testing)

## Chart Format (chart.json)

```json
{
  "title": "BAKENOHANA",
  "bpm": 180,
  "music": "audio.ogg",
  "sounds": {
    "normal": "path/to/normal.ogg",
    "special": "path/to/special.ogg"
  },
  "phases": [
    {
      "type": "dodge",
      "startTime": 0,
      "endTime": 15000,
      "intensity": 0.5,
      "slides": [
        { "lane": 4, "startTime": 1000, "endTime": 1200, "noteType": "normal" }
      ]
    },
    {
      "type": "touhou",
      "startTime": 15000,
      "endTime": 30000,
      "intensity": 1.0,
      "slides": [
        { "pattern": "spiral", "startTime": 15500, "x": 400, "y": 50 }
      ]
    }
  ]
}
```

## Themes & Narrative

The game's lyrics and visual style reflect psychological horror themes:
- **Japanese Dialogue Pool**: Phrases expressing inner turmoil ("見ないで" - don't look, "本当の私" - the real me, "仮面の下" - beneath the mask)
- **Eyes Motif**: Watching eyes on menu, eye obstacles in-game
- **"Don't Look at Me"**: Tagline reflects the theme of hiding one's true self
- **Mental Breakdown Effect**: In Touhou mode, player visuals become more chaotic as graze count increases

## Credits

- **Muse Dash Chart**: flash
- **osu! Chart (converted to dodge)**: Yoisaki Kanade
- **Made with**: Claude Opus 4.5, Gemini 3 & Rice

## Development Notes

### Performance Optimizations
- Object pooling for bullets and particles
- Offscreen canvas caching for text rendering
- Pre-computed random values to avoid per-frame Math.random() calls
- Sprite caching for bullet graphics

### Mobile Support
- Touch controls with on-screen D-pad
- Landscape orientation prompt
- Visual viewport handling for mobile browser UI
- Responsive scaling to fit any screen size

### Key Functions to Know
- `startGame()` ([main.js:268](src/main.js#L268)) - Initializes and starts gameplay
- `multiPhaseGameLoop()` ([main.js:74](src/main.js#L74)) - Main update/render loop
- `updateCurrentPhase()` ([Chart.js:185](src/Chart.js#L185)) - Handles phase transitions
- `checkCollision()` ([main.js:14](src/main.js#L14)) - Collision detection
- `gameOver()` / `gameComplete()` ([main.js:577](src/main.js#L577)) - End-game handling
