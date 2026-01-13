# Rhythm Dodger 2

A rhythm-based dodging game where you avoid obstacles synchronized to music. Featuring multiple game modes including a "Touhou-style" bullet hell mode.

## How to Run

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (required due to browser security restrictions on loading local files like audio/video/JSON)

### Quick Start (Python)
If you have Python installed, you can easily start a local server:

1. Open your terminal/command prompt
2. Navigate to the game directory:
   ```bash
   cd path/to/rhythm-dodger-2
   ```
3. Run the server command:
   - Python 3: `python -m http.server`
   - Python 2: `python -m SimpleHTTPServer`
4. Open your browser and go to `http://localhost:8000`

### Quick Start (Node.js)
If you have Node.js installed:

1. Install `http-server` globally (optional but recommended):
   ```bash
   npm install -g http-server
   ```
2. Navigate to the game directory
3. Run:
   ```bash
   http-server
   ```
4. Open the displayed URL (usually `http://localhost:8080`)

### VS Code (Live Server)
If you use Visual Studio Code:
1. Install the "Live Server" extension
2. Open the project folder in VS Code
3. Right-click `index.html` and select "Open with Live Server"

## Game Overview

### Core Gameplay
- **Dodge Mode**: The classic mode where you control a square character at the bottom of the screen. Move left and right to dodge incoming obstacles that fall to the beat of the music.
- **Touhou Mode**: A bullet hell mode inspired by the Touhou Project series. You have free 2D movement and must dodge complex patterns of bullets. Hold Shift to focus (slow down) for precision dodging.
- **Multi-Phase**: The game can switch dynamically between Dodge and Touhou modes within a single song.

### Key Features
- **Rhythm Synchronization**: Obstacles and events are tightly synced to the music track ("25-ji, Nightcord de. x KAITO - BAKENOHANA").
- **Dynamic Visuals**:
  - Background video support
  - Beat-synced stage lighting and light flares
  - "Fever" mode visual intensity
  - Glitch effects and screen pulses
  - Particle systems for hits and ambiance
- **Scoring System**:
  - Combo tracking
  - Judgment ratings (Perfect, Great, Bad, Miss)
  - Letter grades (S, A, B, C)
  - Graze mechanics (bonus points for near-misses in Touhou mode)

### Controls
**Desktop:**
- **Dodge Mode**:
  - `Arrow Left` / `A`: Move Left
  - `Arrow Right` / `D`: Move Right
  - `Space`: Tap (for certain interactive elements if applicable)
- **Touhou Mode**:
  - `WASD` / `Arrow Keys`: Move Up, Down, Left, Right
  - `Shift`: Focus Mode (slower movement, visible hitbox)
- **General**:
  - `Esc`: Pause
  - `F`: Fullscreen

**Mobile / Touch:**
- On-screen touch controls available (Left/Right/Up/Down buttons)
- Dodge Slider option for analog-style control
- Tap to interact

### Configuration
The game features a settings menu to customize your experience:
- **Audio**: Adjust Music and SFX volume independently.
- **Graphics**: Toggle Background Video, Visual Effects (VFX), and more.
- **Gameplay**:
  - **God Mode**: Invincibility for practice.
  - **Dodge Slider**: Enable an on-screen slider for alternative control.
  - **Touch Controls**: Toggle on-screen buttons.

### Technical Details
- Built with vanilla JavaScript (ES6 modules)
- HTML5 Canvas for rendering
- CSS3 for UI overlay and animations
- Custom chart format (JSON) for level design
- Responsive design for desktop and mobile

---
Made with Claude Opus 4.5, Gemini 3 & Rice 🍚
