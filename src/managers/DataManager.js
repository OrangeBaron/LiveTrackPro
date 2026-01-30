import { getDistanceFromLatLonInMeters } from '../utils.js';
import { CONFIG } from '../config.js';

export class DataManager {
    constructor() {
        // Strutture dati base
        this.rawLivePoints = new Map(); 
        this.livePoints = [];
        this.coursePoints = [];
        
        // Metriche avanzate (Stato iniziale)
        this.wPrimeBalance = CONFIG.athlete.wPrime; // Parte dal massimo
        this.timeInZones = [0, 0, 0, 0, 0];         // 5 Zone (Z1-Z5)
        
        // Stato Ricezione
        this.hasReceivedCourses = false;
        this.hasReceivedLive = false;
        
        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        if (this.hasReceivedCourses && this.hasReceivedLive) {
            this.listeners.forEach(cb => cb({
                live: this.livePoints,
                course: this.coursePoints,
                // Nuovi payload per i grafici avanzati
                wPrime: this.livePoints.map(p => ({ x: p.distanceKm, y: p.wPrimeBal })),
                efficiency: this.livePoints.map(p => ({ x: p.distanceKm, y: p.efficiency })),
                zones: this.timeInZones
            }));
        }
    }

    // Gestione Traccia Pianificata (Course)
    ingestCourse(data) {
        const points = data.geoPoints || data.trackPoints || [];
        
        this.coursePoints = [];
        let distAccumulator = 0;

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const lat = p.latitude || p.lat;
            const lon = p.longitude || p.lon;
            const ele = p.elevation || p.altitude || 0;

            if (i > 0) {
                const prev = this.coursePoints[i - 1];
                distAccumulator += getDistanceFromLatLonInMeters(prev.lat, prev.lon, lat, lon);
            }

            this.coursePoints.push({
                lat: lat,
                lon: lon,
                altitude: ele,
                totalDistanceMeters: distAccumulator
            });
        }

        console.log(`LiveTrackPro: Course ingested. Points: ${this.coursePoints.length}`);
        this.hasReceivedCourses = true;
        this.notify();
    }

    // Gestione Traccia Reale (Live)
    ingestLive(data) {
        if (!data.trackPoints || data.trackPoints.length === 0) return;

        // 1. Merge dei dati grezzi nella Map (deduplica per timestamp)
        data.trackPoints.forEach(point => {
            if (point.dateTime) {
                this.rawLivePoints.set(point.dateTime, point);
            }
        });

        // 2. Ordina cronologicamente
        const sortedPoints = Array.from(this.rawLivePoints.values())
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // 3. Ricalcolo completo delle metriche su tutta la serie storica
        // (Necessario perché i punti possono arrivare fuori ordine o in batch)
        let distAccumulator = 0;
        let currentWPrime = CONFIG.athlete.wPrime; // Reset al valore iniziale
        let zonesAccumulator = [0, 0, 0, 0, 0];    // Reset zone

        for (let i = 0; i < sortedPoints.length; i++) {
            const p = sortedPoints[i];
            
            // --- A. Calcolo Distanza ---
            if (i > 0) {
                const prev = sortedPoints[i - 1];
                
                // Distanza geografica
                if (p.position && prev.position) {
                    const d = getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                    distAccumulator += d;
                }

                // --- B. Calcolo W' Balance (Algoritmo Integrale) ---
                const dt = (new Date(p.dateTime) - new Date(prev.dateTime)) / 1000; // Secondi trascorsi
                const power = p.powerWatts || 0;

                if (dt > 0 && dt < 1000) { // Filtra salti temporali assurdi
                    if (power > CONFIG.athlete.cp) {
                        // Spesa Energetica (Depletion)
                        // W' speso = (Potenza - CP) * tempo
                        currentWPrime -= (power - CONFIG.athlete.cp) * dt;
                    } else {
                        // Recupero (Recovery)
                        // Modello semplificato lineare per real-time: Recupera (CP - Potenza) * dt
                        // Nota: Esistono modelli esponenziali più complessi (Skiba), ma questo è sufficiente per live tracking.
                        const recovery = (CONFIG.athlete.cp - power) * dt;
                        currentWPrime += recovery;
                    }
                }

                // Cap al valore massimo (non puoi avere più del 100% di batteria)
                if (currentWPrime > CONFIG.athlete.wPrime) currentWPrime = CONFIG.athlete.wPrime;
                // Floor a 0 (non puoi avere energia negativa)
                if (currentWPrime < 0) currentWPrime = 0;

                // --- C. Calcolo Zone Cardiache ---
                const hr = p.heartRateBeatsPerMin || 0;
                if (hr > 0 && dt > 0 && dt < 1000) {
                    // Trova l'indice della zona basato sui limiti in CONFIG
                    // Esempio hrZones: [130, 145, 160, 175, 200]
                    // Se hr = 150, è <= 130? No. <= 145? No. <= 160? Si -> Indice 2 (Z3)
                    let zIndex = CONFIG.athlete.hrZones.findIndex(limit => hr <= limit);
                    
                    // Se supera il massimo (es. 205bpm), lo mettiamo nell'ultima zona (Z5)
                    if (zIndex === -1) zIndex = 4;
                    
                    zonesAccumulator[zIndex] += dt;
                }
            }

            // Assegnazione valori calcolati al punto
            p.totalDistanceMeters = distAccumulator;
            p.distanceKm = distAccumulator / 1000;
            p.wPrimeBal = currentWPrime;
            
            // --- D. Efficienza (Decoupling Proxy) ---
            // Power / HR (Watt per battito)
            p.efficiency = (p.powerWatts && p.heartRateBeatsPerMin) 
                ? (p.powerWatts / p.heartRateBeatsPerMin).toFixed(2) 
                : null;
        }

        // Aggiorna lo stato della classe
        this.livePoints = sortedPoints;
        this.timeInZones = zonesAccumulator;
        
        // Logica di prima attivazione
        if (!this.hasReceivedLive) {
            this.hasReceivedLive = true;
            console.log(`LiveTrackPro: First Live Data sync. Points: ${this.livePoints.length}`);
        }
        
        this.notify();
    }
}