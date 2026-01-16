// Detect mobile device
export function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1) || window.innerWidth < 768;
}

// Settings (persisted to localStorage)
export const settings = {
    musicVolume: 0.8,
    sfxVolume: 0.7,
    bgVideoEnabled: true,
    vfxEnabled: true,
    dodgeSliderEnabled: false,
    touchControlsEnabled: isMobileDevice(),
    godMode: false,  // God mode - player cannot die from collisions
    showHitboxes: true,  // Debug: show hitbox bounding boxes for dodge notes
};

// Load settings from localStorage
export function loadSettings() {
    const saved = localStorage.getItem('rhythmDodgerSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(settings, parsed);
        } catch (e) {
            console.log('Could not parse saved settings');
        }
    }
}

// Save settings to localStorage
export function saveSettings() {
    localStorage.setItem('rhythmDodgerSettings', JSON.stringify(settings));
}
