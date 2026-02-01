import { CONFIG } from './config.js';

// Calcolo distanza tra due coordinate
export function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calcolo VAM (Velocità Ascensionale Media)
export function calculateVam(altNow, altOld, timeSeconds) {
    if (timeSeconds <= 0) return 0;
    const vam = (altNow - altOld) / (timeSeconds / 3600);
    // Filtro per valori impossibili (es. errori GPS)
    return (vam > -5000 && vam < 5000) ? Math.round(vam) : 0;
}

// Calcolo Gradiente (%)
export function calculateGradient(altNow, altOld, distDelta) {
    if (distDelta <= 10) return 0; // Distanza minima per evitare picchi assurdi
    const grad = ((altNow - altOld) / distDelta) * 100;
    // Clamp tra -30% e +30%
    return Math.max(-30, Math.min(30, parseFloat(grad.toFixed(1))));
}

// Formatta durata in HH:MM:SS
export function formatDuration(ms) {
    return new Date(ms).toISOString().slice(11, 19);
}