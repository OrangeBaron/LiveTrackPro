export const CONFIG = {
    mapUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    libs: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/chart.js'
    ],
    css: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    ],
    colors: {
        liveLine: '#e67e22',   // Arancione (Track Reale)
        courseLine: '#95a5a6', // Grigio (Track Prevista)
        marker: '#0056b3',
        chartPrimary: '#0056b3',
        chartSecondary: '#bdc3c7'
    }
};