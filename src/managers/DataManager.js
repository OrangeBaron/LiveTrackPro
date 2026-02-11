import { getDistanceFromLatLonInMeters, formatDuration } from '../utils/helpers.js';
import { WeatherManager } from './WeatherManager.js';
import { ElevationManager } from './ElevationManager.js';
import { StatsEngine } from './StatsEngine.js'; // Nuovo Import

export class DataManager {
    constructor() {
        this.rawLivePoints = new Map();
        this.livePoints = [];
        this.coursePoints = [];
        
        // Flags di stato
        this.hasReceivedCourses = false;
        this.hasReceivedLive = false;
        
        // Gestori esterni
        this.listeners = [];
        this.weatherManager = new WeatherManager(() => this.notify());
        this.elevationManager = new ElevationManager();
        
        // Motore di calcolo
        this.statsEngine = new StatsEngine();
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        if (!this.hasReceivedLive) return;

        // Calcolo durata totale
        let durationStr = "00:00:00";
        let durationSeconds = 0;
        
        if (this.livePoints.length > 0) {
            const start = new Date(this.livePoints[0].dateTime);
            const end = new Date(this.livePoints[this.livePoints.length - 1].dateTime);
            const diff = end - start;
            durationStr = formatDuration(diff);
            durationSeconds = diff / 1000;
        }

        // Recupera le statistiche globali calcolate dall'engine
        const globalStats = this.statsEngine.getGlobalStats(durationSeconds);
        const lastPoint = this.livePoints[this.livePoints.length - 1] || {};

        this.listeners.forEach(cb => cb({
            live: this.livePoints,
            course: this.coursePoints,
            
            // Mapping per grafici (serie temporali)
            wPrime: this.livePoints.map(p => ({ x: p.distanceKm, y: p.wPrimeBal })),
            efficiency: this.livePoints.map(p => ({ x: p.distanceKm, y: p.efficiency })),
            
            // Istogrammi Zone
            hrZones: globalStats.hrZones,
            powerZones: globalStats.powerZones,

            // Dati "Summary" per la barra superiore
            stats: {
                duration: durationStr,
                distance: lastPoint.totalDistanceMeters ? (lastPoint.totalDistanceMeters / 1000).toFixed(1) : '0.0',
                elevationGain: globalStats.elevationGain,
                workKj: globalStats.workKj,
                
                np: Math.round(globalStats.np),
                if: globalStats.if.toFixed(2),
                tss: Math.round(globalStats.tss),
                
                vam: lastPoint.vam || 0,
                gradient: lastPoint.gradient || 0,
                weather: this.weatherManager.current
            }
        }));
    }

    async ingestCourse(data) {
        if (this.hasReceivedCourses) return;

        // Normalizzazione Dati (gestione strutture annidate)
        let rawPoints = [];
        if (data.courses?.[0]?.coursePoints) {
            rawPoints = data.courses[0].coursePoints;
        } else {
            rawPoints = data.geoPoints || data.trackPoints || [];
        }

        if (rawPoints.length === 0) return;

        // Parsing Punti Course
        this.coursePoints = [];
        let distAccumulator = 0;

        rawPoints.forEach((p, i) => {
            const pos = p.position || p;
            if (!pos.lat || (!pos.lon && !pos.longitude)) return;

            const lat = pos.lat || pos.latitude;
            const lon = pos.lon || pos.longitude;
            const ele = p.elevation || p.altitude || 0;
            
            // Gestione Distanza: Nativa vs Calcolata
            let dist = p.distanceMeters ?? null;
            if (dist !== null) {
                distAccumulator = dist;
            } else {
                if (i > 0 && this.coursePoints.length > 0) {
                    const prev = this.coursePoints[this.coursePoints.length - 1];
                    distAccumulator += getDistanceFromLatLonInMeters(prev.lat, prev.lon, lat, lon);
                }
                dist = distAccumulator;
            }

            this.coursePoints.push({ lat, lon, altitude: ele, totalDistanceMeters: dist });
        });

        console.log(`LiveTrackPro: Course ingested locally with ${this.coursePoints.length} points.`);
        this.hasReceivedCourses = true;
        this.notify();

        // Arricchimento asincrono elevazione
        this.coursePoints = await this.elevationManager.enrichCoursePoints(this.coursePoints);
        this.notify();
    }

    ingestLive(data) {
        if (!data.trackPoints || data.trackPoints.length === 0) return;

        const incomingPoints = data.trackPoints;
        let startIndex = 0;

        // Logica di merge (Append vs Rebuild)
        const lastProcessedTime = this.livePoints.length > 0 
            ? new Date(this.livePoints[this.livePoints.length - 1].dateTime).getTime() 
            : 0;
        
        const firstIncomingTime = new Date(incomingPoints[0].dateTime).getTime();
        const isAppend = (lastProcessedTime > 0) && (firstIncomingTime > lastProcessedTime);

        if (isAppend) {
            // Append Mode: aggiungi solo i nuovi punti
            const newPoints = incomingPoints.filter(p => new Date(p.dateTime).getTime() > lastProcessedTime);
            if (newPoints.length === 0) return;

            newPoints.forEach(p => this.rawLivePoints.set(p.dateTime, p));
            startIndex = this.livePoints.length; // Ricorda dove eravamo rimasti
            this.livePoints.push(...newPoints);

        } else {
            // Rebuild Mode: ricalcola tutto (es. caricamento iniziale o refresh pagina)
            incomingPoints.forEach(p => {
                if (p.dateTime) this.rawLivePoints.set(p.dateTime, p);
            });
            
            this.livePoints = Array.from(this.rawLivePoints.values())
                .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
            
            this.statsEngine.reset(); // Reset totale accumulatori
            startIndex = 0;
        }
        
        // DELEGA: Lascia che sia l'Engine a fare i calcoli sui punti
        this.statsEngine.processPoints(this.livePoints, startIndex);
        
        // Aggiorna Meteo (solo sull'ultimo punto)
        const lastP = this.livePoints[this.livePoints.length - 1];
        if (lastP?.position?.lat) {
            this.weatherManager.update(lastP.position.lat, lastP.position.lon);
        }

        this.hasReceivedLive = true;
        this.notify();
    }
}