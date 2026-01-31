// Recupero delle impostazioni
let USER_SETTINGS = {};

try {
    const settingsElement = document.getElementById('ltp-user-settings');
    if (settingsElement && settingsElement.textContent) {
        USER_SETTINGS = JSON.parse(settingsElement.textContent);
        console.log("LiveTrackPro: User settings loaded!", USER_SETTINGS);
    }
} catch (e) {
    console.warn("LiveTrackPro: Could not load user settings, using defaults.", e);
}

export const CONFIG = {
    // URL per i tile della mappa
    mapUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

    libs: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/chart.js'
    ],
    css: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    ],
    colors: {
        liveLine: '#e67e22',
        courseLine: '#95a5a6',
        marker: '#0056b3',
        chartPrimary: '#0056b3',
        chartSecondary: '#bdc3c7',
        wPrime: '#e74c3c',
        efficiency: '#27ae60'
    },

    // Dati Atleta
    athlete: {
        cp: parseInt(USER_SETTINGS.cp) || 280, 
        wPrime: parseInt(USER_SETTINGS.wPrime) || 20000, 
        hrZones: USER_SETTINGS.hrZones || [135, 150, 165, 178, 200] 
    }
};