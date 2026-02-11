export const ViewHelpers = {

    // Formatta orario (HH:MM:SS)
    formatTime(dateString) {
        if (!dateString) return '--:--:--';
        return new Date(dateString).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
    },

    // Genera la freccia direzionale per il vento
    getWindArrow(deg) {
        if (deg === undefined || deg === null) return '-';
        const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
        return arrows[Math.round(deg / 45) % 8];
    },

    // Genera l'HTML per il blocco meteo
    getWeatherHtml(weather) {
        if (!weather) {
            return '<span style="font-size:12px; color:#ccc;">No API Key</span>';
        }
        
        const desc = (weather.description || '').toLowerCase();
        let icon = '☀️';
        if (desc.includes('pioggia')) icon = '🌧️';
        else if (desc.includes('nubi') || desc.includes('coperto')) icon = '☁️';
        else if (desc.includes('neve')) icon = '❄️';
        else if (desc.includes('nebbia')) icon = '🌫️';

        const arrow = this.getWindArrow(weather.windDeg);
        
        return `${weather.temp}° <small>${icon}</small> <small style="color:#666; font-size:14px; margin-left:5px;">${arrow} ${weather.windSpeed}</small>`;
    },

    // Formatta numeri decimali in modo sicuro
    formatNumber(val, decimals = 1, fallback = '-') {
        if (val === undefined || val === null || isNaN(val)) return fallback;
        return Number(val).toFixed(decimals);
    },

    // Formatta valori interi
    formatInt(val, fallback = '-') {
        if (val === undefined || val === null || isNaN(val)) return fallback;
        return Math.round(val).toString();
    }
};