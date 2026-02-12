export class ElevationManager {
    constructor() {
        this.baseUrl = "https://api.open-meteo.com/v1/elevation";
        this.MAX_SAMPLES = 600; // Limite massimo safe per il tier free
    }

    /**
     * Arricchisce i punti con l'altitudine usando downsampling + interpolazione
     */
    async enrichCoursePoints(points) {
        if (!points || points.length === 0) return points;

        // 1. Seleziona gli indici chiave per restare nel rate limit
        const indicesToFetch = this._selectKeyIndices(points.length);
        const pointsToFetch = indicesToFetch.map(i => points[i]);

        // 2. Scarica i dati reali per il subset (mutando gli oggetti)
        await this._fetchElevationForSubset(pointsToFetch);

        // 3. Interpola linearmente i punti mancanti
        this._interpolateElevation(points);

        return points;
    }

    _selectKeyIndices(totalLength) {
        if (totalLength <= this.MAX_SAMPLES) {
            return Array.from({ length: totalLength }, (_, i) => i);
        }

        const indices = [];
        const step = (totalLength - 1) / (this.MAX_SAMPLES - 1);

        for (let i = 0; i < this.MAX_SAMPLES; i++) {
            indices.push(Math.round(i * step));
        }
        
        // Assicura che l'ultimo punto sia incluso
        if (indices[indices.length - 1] !== totalLength - 1) {
            indices[indices.length - 1] = totalLength - 1;
        }

        return indices;
    }

    async _fetchElevationForSubset(subsetPoints) {
        const CHUNK_SIZE = 100; // Limite URL/Request Open-Meteo
        const chunks = [];

        for (let i = 0; i < subsetPoints.length; i += CHUNK_SIZE) {
            chunks.push(subsetPoints.slice(i, i + CHUNK_SIZE));
        }

        try {
            for (const chunk of chunks) {
                const lats = chunk.map(p => p.lat).join(',');
                const lons = chunk.map(p => p.lon).join(',');
                const url = `${this.baseUrl}?latitude=${lats}&longitude=${lons}`;
                
                const res = await fetch(url);
                if (!res.ok) throw new Error(`API Error ${res.status}`);
                
                const data = await res.json();
                
                if (data.elevation && data.elevation.length === chunk.length) {
                    chunk.forEach((p, i) => {
                        // Salviamo temporaneamente il dato grezzo
                        p._fetchedAlt = data.elevation[i];
                    });
                }
            }
            console.log(`LiveTrackPro: Elevation fetched for ${subsetPoints.length} sample points.`);
        } catch (e) {
            console.error("LiveTrackPro: Elevation fetch failed", e);
        }
    }

    _interpolateElevation(allPoints) {
        let lastKnownIdx = 0;
        
        // Fallback: se il primo punto non ha dati, mettiamo 0
        if (allPoints[0]._fetchedAlt === undefined) allPoints[0]._fetchedAlt = 0;

        for (let i = 0; i < allPoints.length; i++) {
            const p = allPoints[i];

            if (p._fetchedAlt !== undefined) {
                p.altitude = p._fetchedAlt;
                delete p._fetchedAlt; // Cleanup
                
                this._fillGap(allPoints, lastKnownIdx, i);
                lastKnownIdx = i;
            }
        }
    }

    _fillGap(points, startIdx, endIdx) {
        if (endIdx - startIdx <= 1) return;

        const startP = points[startIdx];
        const endP = points[endIdx];
        
        const startAlt = startP.altitude;
        const diffAlt = endP.altitude - startAlt;
        
        const startDist = startP.totalDistanceMeters || 0;
        const diffDist = (endP.totalDistanceMeters || 0) - startDist;

        // Se i punti sono sovrapposti (distanza 0), copia il valore
        if (diffDist <= 0) {
            for (let i = startIdx + 1; i < endIdx; i++) points[i].altitude = startAlt;
            return;
        }

        // Interpolazione lineare basata sulla distanza progressiva
        for (let i = startIdx + 1; i < endIdx; i++) {
            const currentDist = points[i].totalDistanceMeters || 0;
            const fraction = (currentDist - startDist) / diffDist;
            points[i].altitude = startAlt + (diffAlt * fraction);
        }
    }
}