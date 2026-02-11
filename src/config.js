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
    mapUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

    weatherApiKey: USER_SETTINGS.owmKey || null,

    libs: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8', 
        'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1'
    ],
    css: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    ],
    
    // --- SEZIONE COLORI CENTRALIZZATA ---
    colors: {
        // Linee Mappa
        liveLine: '#3b97f3',
        courseLine: '#ac06bc',
        marker: '#0056b3',

        // Metriche Singole
        elevation: '#0056b3',      // Altitudine
        speed: '#0056b3',          // Velocità
        slope: '#7f8c8d',          // Pendenza
        vam: '#16a085',            // VAM
        power: '#e67e22',          // Power Line
        hr: '#e74c3c',             // Heart Rate Line
        wPrime: '#e74c3c',         // W' Balance
        efficiency: '#27ae60',     // Efficienza

        // Palette Zone (Array)
        powerZones: ['#95a5a6', '#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#8e44ad'], // Z1-Z7
        hrZones: ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'] // Z1-Z5
    },

    athlete: {
        cp: parseInt(USER_SETTINGS.cp) || 280, 
        wPrime: parseInt(USER_SETTINGS.wPrime) || 20000, 
        hrZones: USER_SETTINGS.hrZones || [135, 150, 165, 178, 200] 
    }
};