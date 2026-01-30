export const CONFIG = {
    // URL per i tile della mappa (OpenStreetMap)
    mapUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',

    // Librerie esterne da caricare
    libs: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/chart.js'
    ],

    // Fogli di stile esterni
    css: [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    ],

    // Palette colori dell'applicazione
    colors: {
        liveLine: '#e67e22',   // Arancione (Track Reale)
        courseLine: '#95a5a6', // Grigio (Track Prevista)
        marker: '#0056b3',     // Blu (Posizione attuale)
        
        // Grafici Standard
        chartPrimary: '#0056b3',   // Blu scuro
        chartSecondary: '#bdc3c7', // Grigio chiaro
        
        // Grafici Avanzati
        wPrime: '#e74c3c',     // Rosso (W' Balance)
        efficiency: '#27ae60'  // Verde (Efficienza/Decoupling)
    },

    // =========================================================
    // DATI ATLETA - INSERISCI QUI I TUOI VALORI
    // =========================================================
    athlete: {
        // Critical Power (CP) in Watt
        // La potenza che puoi sostenere "quasi indefinitamente" (soglia anaerobica)
        cp: 310, 

        // W' (W Prime) in Joules
        // La tua riserva di energia anaerobica disponibile sopra la CP
        wPrime: 26000, 

        // Zone Cardiache (Limiti Superiori)
        // Inserisci il valore massimo di battiti per ogni zona:
        // [Fine Z1, Fine Z2, Fine Z3, Fine Z4, Fine Z5 (Max HR)]
        hrZones: [130, 145, 160, 175, 200] 
    }
};