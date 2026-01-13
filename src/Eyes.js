// Eyes.js - Animated eyes menu background

const EYE_COUNT = 13;
let eyesData = [];
let eyesContainer = null;
let mouseX = 400; // Default to center
let mouseY = 300;
let animationId = null;

// Check collision between eyes to prevent overlap
function checkCollision(x, y, radius, existing) {
    const buffer = 40;
    for (let e of existing) {
        const dx = x - e.x;
        const dy = y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (radius + e.radius + buffer)) return true;
    }
    return false;
}

// Create a single eye DOM element
function createEyeDOM(x, y, width, height, rotation, index) {
    const uid = `clip-${Math.random().toString(36).substr(2, 9)}`;

    const html = `
        <div class="eye-element eye-closed"
             id="eye-${index}"
             style="width: ${width}px; height: ${height}px;
                    left: ${x}px; top: ${y}px;
                    transform: translate(-50%, -50%) rotate(${rotation}deg);">
            <svg viewBox="0 0 100 60" style="width: 100%; height: 100%; overflow: visible;">
                <defs>
                    <clipPath id="${uid}">
                        <path d="M 0 30 Q 50 -10 100 30 Q 50 70 0 30 Z"></path>
                    </clipPath>
                </defs>
                <g class="eyelid" style="transform-origin: center;">
                    <path d="M 0 30 Q 50 -10 100 30 Q 50 70 0 30 Z" fill="#000" stroke="#ef4444" stroke-width="2"></path>
                    <g clip-path="url(#${uid})">
                        <g id="pupil-${index}" class="pupil-group">
                            <circle cx="50" cy="30" r="18" fill="#991b1b"></circle>
                            <circle cx="50" cy="30" r="8" fill="black"></circle>
                        </g>
                    </g>
                </g>
            </svg>
        </div>
    `;
    eyesContainer.insertAdjacentHTML('beforeend', html);
}

// Generate all eyes with collision avoidance
export function generateEyes() {
    eyesContainer = document.getElementById('eyes-container');
    if (!eyesContainer) {
        console.error('Eyes container not found!');
        return;
    }

    eyesContainer.innerHTML = '';
    eyesData = [];

    const w = 800; // CONFIG.WIDTH
    const h = 600; // CONFIG.HEIGHT

    // Avoid center column (30% to 70%) to keep menu readable
    const centerStart = w * 0.30;
    const centerEnd = w * 0.70;
    const padding = 60;

    for (let i = 0; i < EYE_COUNT; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 500) {
            attempts++;

            // Size: scaled relative to container
            const minDim = Math.min(w, h);
            const width = minDim * (0.12 + Math.random() * 0.12);
            const height = width * 0.6; // SVG viewbox aspect ratio 100:60
            const radius = width * 0.5;

            const x = padding + Math.random() * (w - 2 * padding);
            const y = padding + Math.random() * (h - 2 * padding);

            // Skip if in center column (where menu text is)
            if (x > centerStart && x < centerEnd) continue;

            // Skip if overlapping with existing eyes
            if (checkCollision(x, y, radius, eyesData)) continue;

            const rotation = Math.random() * 360;
            createEyeDOM(x, y, width, height, rotation, i);

            eyesData.push({
                id: i,
                x: x,
                y: y,
                rotation: rotation,
                radius: radius,
                element: document.getElementById(`eye-${i}`),
                pupil: document.getElementById(`pupil-${i}`)
            });

            placed = true;
        }
    }

    console.log(`Generated ${eyesData.length} eyes`);

    // Start mouse tracking
    startTracking();
}

// Mouse tracking for pupil movement
function startTracking() {
    // Track mouse position relative to game container
    const container = document.getElementById('game-container');

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 600 / rect.height;
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    });

    // Start animation loop
    animateEyes();
}

// Animate pupils to track mouse
function animateEyes() {
    eyesData.forEach(eye => {
        if (!eye.pupil) return;

        // Calculate vector to mouse
        const dx = mouseX - eye.x;
        const dy = mouseY - eye.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const globalAngle = Math.atan2(dy, dx);

        // Adjust for eye rotation
        const rotationRad = eye.rotation * (Math.PI / 180);
        const localAngle = globalAngle - rotationRad;

        // Constraints in SVG units (viewBox 0 0 100 60, center at 50,30)
        const limitX = 22;
        const limitY = 6;

        // Calculate ellipse radius at this angle
        const cosA = Math.cos(localAngle);
        const sinA = Math.sin(localAngle);
        const maxRadiusAtAngle = (limitX * limitY) /
            Math.sqrt(Math.pow(limitY * cosA, 2) + Math.pow(limitX * sinA, 2));

        // Map screen distance to SVG unit movement
        const lookIntensity = Math.min(dist * 0.05, maxRadiusAtAngle);

        // Calculate translation
        const tx = lookIntensity * cosA;
        const ty = lookIntensity * sinA;

        // Apply transform
        eye.pupil.setAttribute('transform', `translate(${tx}, ${ty})`);
    });

    animationId = requestAnimationFrame(animateEyes);
}

// Open all eyes with staggered timing
export function openEyes() {
    return new Promise((resolve) => {
        // First make eyes visible
        if (eyesContainer) {
            eyesContainer.style.opacity = '1';
        }

        let maxDelay = 0;

        eyesData.forEach((eye) => {
            const delay = Math.random() * 400;
            maxDelay = Math.max(maxDelay, delay);

            setTimeout(() => {
                if (eye.element) {
                    eye.element.classList.remove('eye-closed');
                    eye.element.classList.add('eye-open');
                }
            }, delay);
        });

        // Resolve after all eyes have opened plus a buffer
        setTimeout(resolve, maxDelay + 400);
    });
}

// Close all eyes
export function closeEyes() {
    eyesData.forEach(eye => {
        if (eye.element) {
            eye.element.classList.remove('eye-open');
            eye.element.classList.add('eye-closed');
        }
    });
}

// Hide the eyes container
export function hideEyes() {
    if (eyesContainer) {
        eyesContainer.classList.add('hidden');
    }
    const overlays = document.getElementById('menu-overlays');
    if (overlays) {
        overlays.classList.add('hidden');
    }
}

// Show the eyes container (but keep eyes invisible until openEyes is called)
export function showEyes() {
    if (eyesContainer) {
        eyesContainer.classList.remove('hidden');
        eyesContainer.style.opacity = '0'; // Start invisible
    }
    const overlays = document.getElementById('menu-overlays');
    if (overlays) {
        overlays.classList.remove('hidden');
    }
    // Regenerate eyes when showing menu
    generateEyes();
    closeEyes();
}

// Stop animation (cleanup)
export function stopEyesAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}
