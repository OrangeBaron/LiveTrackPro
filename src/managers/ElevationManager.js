export class ElevationManager {
    constructor() {
        this.baseUrl = "https://api.open-meteo.com/v1/elevation";
    }

    /**
     * Arricchisce un array di punti course con l'altitudine.
     * @param {Array} points - Array di oggetti {lat, lon, ...}
     * @returns {Promise<Array>} - Array con proprietà 'altitude' aggiornata
     */
    async enrichCoursePoints(points) {
        if (!points || points.length === 0) return points;

        console.log(`LiveTrackPro: Fetching elevation for ${points.length} points...`);

        // L'API Open-Meteo accetta molti punti, ma per sicurezza dividiamo in chunk da 100
        const CHUNK_SIZE = 100;
        const chunks = [];

        for (let i = 0; i < points.length; i += CHUNK_SIZE) {
            chunks.push(points.slice(i, i + CHUNK_SIZE));
        }

        try {
            // Eseguiamo le chiamate in sequenza (o parallelo limitato)
            for (const chunk of chunks) {
                const lats = chunk.map(p => p.lat).join(',');
                const lons = chunk.map(p => p.lon).join(',');
                
                const url = `${this.baseUrl}?latitude=${lats}&longitude=${lons}`;
                
                const res = await fetch(url);
                if (!res.ok) throw new Error(`API Error ${res.status}`);
                
                const data = await res.json();
                
                if (data.elevation && data.elevation.length === chunk.length) {
                    // Aggiorniamo i punti originali
                    chunk.forEach((p, index) => {
                        // Sovrascriviamo l'altitudine solo se era 0 o null
                        if (!p.altitude || p.altitude === 0) {
                            p.altitude = data.elevation[index];
                        }
                    });
                }
            }
            console.log("LiveTrackPro: Elevation data fetched successfully.");
            return points;

        } catch (e) {
            console.error("LiveTrackPro: Elevation fetch failed", e);
            return points; // Ritorniamo i punti originali in caso di errore
        }
    }
}