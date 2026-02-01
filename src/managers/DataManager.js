import { getDistanceFromLatLonInMeters, calculateVam, calculateGradient, formatDuration } from '../utils.js';
import { CONFIG } from '../config.js';
import { WeatherManager } from './WeatherManager.js';

export class DataManager {
    constructor() {
        this.rawLivePoints = new Map(); // Mantiene l'unicità (per ID o timestamp)
        this.livePoints = [];           // Array ordinato e PROCESSATO (con VAM, W', etc.)
        this.coursePoints = [];
        
        // Metriche "di stato" (devono persistere tra gli update incrementali)
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        this.timeInHrZones = [0, 0, 0, 0, 0];           
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];  
        
        // Accumulatori per NP/TSS
        this.rollingPowerSum4 = 0;
        this.rollingPowerCount = 0;
        
        // Metriche Calcolate Finali
        this.normalizedPower = 0;
        this.intensityFactor = 0;
        this.tss = 0;

        // Stato Ricezione
        this.hasReceivedCourses = false;
        this.hasReceivedLive = false;
        
        this.listeners = [];

        // Inizializza Gestore Meteo
        this.weatherManager = new WeatherManager(() => this.notify());
    }

    resetAccumulators() {
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        this.timeInHrZones = [0, 0, 0, 0, 0];           
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];  
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        
        this.rollingPowerSum4 = 0;
        this.rollingPowerCount = 0;
        this.normalizedPower = 0;
        this.intensityFactor = 0;
        this.tss = 0;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        if (!this.hasReceivedLive) return;

        let durationStr = "00:00:00";
        if (this.livePoints.length > 0) {
            const start = new Date(this.livePoints[0].dateTime);
            const end = new Date(this.livePoints[this.livePoints.length - 1].dateTime);
            durationStr = formatDuration(end - start);
        }

        const lastPoint = this.livePoints[this.livePoints.length - 1] || {};

        this.listeners.forEach(cb => cb({
            live: this.livePoints,
            course: this.coursePoints,
            
            // Mapping ottimizzato per i grafici
            wPrime: this.livePoints.map(p => ({ x: p.distanceKm, y: p.wPrimeBal })),
            efficiency: this.livePoints.map(p => ({ x: p.distanceKm, y: p.efficiency })),
            
            hrZones: this.timeInHrZones,
            powerZones: this.timeInPowerZones,

            stats: {
                duration: durationStr,
                distance: lastPoint.totalDistanceMeters ? (lastPoint.totalDistanceMeters / 1000).toFixed(1) : '0.0',
                elevationGain: this.totalElevationGain,
                workKj: Math.round(this.totalWorkJ / 1000),
                np: Math.round(this.normalizedPower),
                if: this.intensityFactor.toFixed(2),
                tss: Math.round(this.tss),
                vam: lastPoint.vam || 0,
                gradient: lastPoint.gradient || 0,
                weather: this.weatherManager.current
            }
        }));
    }

    ingestCourse(data) {
        const points = data.geoPoints || data.trackPoints || [];
        this.coursePoints = [];
        let distAccumulator = 0;

        points.forEach((p, i) => {
            const lat = p.latitude || p.lat;
            const lon = p.longitude || p.lon;
            const ele = p.elevation || p.altitude || 0;

            if (i > 0) {
                const prev = this.coursePoints[i - 1];
                distAccumulator += getDistanceFromLatLonInMeters(prev.lat, prev.lon, lat, lon);
            }

            this.coursePoints.push({ lat, lon, altitude: ele, totalDistanceMeters: distAccumulator });
        });

        this.hasReceivedCourses = true;
        this.notify();
    }

    ingestLive(data) {
        if (!data.trackPoints || data.trackPoints.length === 0) return;

        const incomingPoints = data.trackPoints;
        
        // 1. Identifica l'ultimo timestamp processato (se esiste)
        let lastProcessedTime = 0;
        if (this.livePoints.length > 0) {
            lastProcessedTime = new Date(this.livePoints[this.livePoints.length - 1].dateTime).getTime();
        }

        // 2. Controlla se i nuovi dati sono "nel futuro" (Append) o "nel passato" (Merge & Rebuild)
        // Basta controllare il primo punto del batch in arrivo (assumendo che il batch stesso sia ordinato o coerente)
        const firstIncomingTime = new Date(incomingPoints[0].dateTime).getTime();
        
        // OPTIMIZATION STRATEGY:
        // Se il primo punto nuovo è successivo all'ultimo processato, facciamo l'append incrementale.
        // Altrimenti (buchi riempiti, dati disordinati), facciamo il rebuild completo.
        const isAppendSafe = (lastProcessedTime === 0) || (firstIncomingTime > lastProcessedTime);

        if (isAppendSafe && lastProcessedTime > 0) {
            // --- STRATEGIA A: INCREMENTALE (Veloce) ---
            // Processiamo solo i punti nuovi, mantenendo lo stato degli accumulatori
            const newValidPoints = [];
            incomingPoints.forEach(p => {
                // Doppio check per sicurezza: aggiungi solo se veramente nuovo
                if (new Date(p.dateTime).getTime() > lastProcessedTime) {
                    this.rawLivePoints.set(p.dateTime, p); // Teniamo il map aggiornato per sicurezza
                    newValidPoints.push(p);
                }
            });

            if (newValidPoints.length > 0) {
                // Aggiungiamo i punti grezzi all'array principale
                const startIndex = this.livePoints.length;
                this.livePoints.push(...newValidPoints);
                
                // Processiamo SOLO la coda (startIndex -> fine)
                this.processMetricsLoop(startIndex);
                console.log(`LiveTrackPro: Optimized Update (+${newValidPoints.length} points)`);
            }

        } else {
            // --- STRATEGIA B: FULL REBUILD (Lento ma Sicuro) ---
            // Caso iniziale o "riempimento buchi"
            incomingPoints.forEach(point => {
                if (point.dateTime) this.rawLivePoints.set(point.dateTime, point);
            });

            // Ricostruiamo l'array da zero
            this.livePoints = Array.from(this.rawLivePoints.values())
                .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

            // Reset totale accumulatori
            this.resetAccumulators();
            
            // Ricalcoliamo tutto dall'inizio
            this.processMetricsLoop(0);
            console.log(`LiveTrackPro: Full Rebuild (${this.livePoints.length} points)`);
        }
        
        if (!this.hasReceivedLive) {
            this.hasReceivedLive = true;
        }
        
        this.notify();
    }

    /**
     * Il cuore del calcolo. Itera su this.livePoints partendo da 'startIndex'.
     * - Se startIndex == 0, ricalcola tutta la gara.
     * - Se startIndex > 0, calcola solo i nuovi punti continuando ad accumulare.
     */
    processMetricsLoop(startIndex) {
        const cp = CONFIG.athlete.cp;
        // Zone per statistiche (Fixed array per evitare allocazioni nel loop)
        const pZones = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50].map(pct => Math.round(cp * pct));

        // Se siamo in append mode, distAccumulator deve partire dall'ultimo valore noto
        let distAccumulator = 0;
        if (startIndex > 0) {
            distAccumulator = this.livePoints[startIndex - 1].totalDistanceMeters || 0;
        }

        for (let i = startIndex; i < this.livePoints.length; i++) {
            const p = this.livePoints[i];
            const pTime = new Date(p.dateTime).getTime();
            
            // 1. Calcolo Delta Tempo (dt) e Distanza
            let dt = 0; 
            if (i > 0) {
                const prev = this.livePoints[i - 1];
                const prevTime = new Date(prev.dateTime).getTime();
                dt = (pTime - prevTime) / 1000;
                
                if (p.position && prev.position) {
                    distAccumulator += getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                }
                const altDiff = (p.altitude || p.elevation || 0) - (prev.altitude || prev.elevation || 0);
                if (altDiff > 0) this.totalElevationGain += altDiff;
            }

            // 2. SMOOTHING POTENZA (Media Mobile 30s)
            // Nota: getRolling30sStats guarda indietro nell'array. Poiché stiamo lavorando
            // sullo stesso array 'this.livePoints' che contiene anche lo storico, funziona perfettamente
            // anche in modalità incrementale.
            const { avgPower30s, altOld, distOld, timeDeltaWindow } = this.getRolling30sStats(i, pTime, distAccumulator);
            
            const smoothPower = avgPower30s !== null ? avgPower30s : (p.powerWatts || 0);

            // 3. Calcoli Altimetrici
            p.vam = calculateVam((p.altitude || 0), altOld, timeDeltaWindow);
            p.gradient = calculateGradient((p.altitude || 0), altOld, distAccumulator - distOld);

            if (avgPower30s !== null) {
                this.rollingPowerSum4 += Math.pow(avgPower30s, 4);
                this.rollingPowerCount++;
            }

            // 4. METRICA W' (Modello Skiba) & Efficienza
            if (dt > 0 && dt < 1000) { // filtro pause lunghe o errori
                this.totalWorkJ += (p.powerWatts || 0) * dt; 

                // --- ALGORITMO SKIBA ---
                if (smoothPower > cp) {
                    this.wPrimeBalance -= (smoothPower - cp) * dt;
                } else {
                    const underP = cp - smoothPower;
                    // Tau dinamico Skiba 2015
                    const tau = 546 * Math.exp(-0.01 * underP) + 316;
                    
                    const wPrimeExpended = CONFIG.athlete.wPrime - this.wPrimeBalance;
                    const newWPrimeExpended = wPrimeExpended * Math.exp(-dt / tau);
                    
                    this.wPrimeBalance = CONFIG.athlete.wPrime - newWPrimeExpended;
                }
                
                // Clamp W'
                this.wPrimeBalance = Math.min(Math.max(this.wPrimeBalance, 0), CONFIG.athlete.wPrime);

                this.accumulateZones(p.heartRateBeatsPerMin, smoothPower, dt, pZones);
            }

            // 5. Assegnazione valori puliti al punto
            p.totalDistanceMeters = distAccumulator;
            p.distanceKm = distAccumulator / 1000;
            p.wPrimeBal = this.wPrimeBalance;
            p.powerSmooth = Math.round(smoothPower); 
            
            // Efficienza (Decoupling) filtrata
            if (smoothPower > 10 && p.heartRateBeatsPerMin > 40) {
                p.efficiency = (smoothPower / p.heartRateBeatsPerMin).toFixed(2);
            } else {
                p.efficiency = null;
            }
        }

        // Finalize Statistiche Globali (aggiorniamo NP e TSS alla fine del blocco)
        if (this.rollingPowerCount > 0) {
            this.normalizedPower = Math.pow(this.rollingPowerSum4 / this.rollingPowerCount, 0.25);
        }
        this.intensityFactor = (cp > 0) ? this.normalizedPower / cp : 0;
        
        if (this.livePoints.length > 0 && cp > 0) {
            const startTime = new Date(this.livePoints[0].dateTime).getTime();
            const endTime = new Date(this.livePoints[this.livePoints.length - 1].dateTime).getTime();
            const durationSeconds = (endTime - startTime) / 1000;
            // Formula TSS standard
            this.tss = (durationSeconds * this.normalizedPower * this.intensityFactor) / (cp * 3600) * 100;
        }

        // Trigger Meteo sull'ultimo punto disponibile
        const lastP = this.livePoints[this.livePoints.length - 1];
        if (lastP?.position?.lat) {
            this.weatherManager.update(lastP.position.lat, lastP.position.lon);
        }
    }

    getRolling30sStats(currentIndex, currentTime, currentDist) {
        let sumPower = 0;
        let count = 0;
        let startIdx = currentIndex;

        // Guarda indietro nell'array (fino a max 30 secondi)
        // Poiché this.livePoints contiene tutto lo storico, funziona anche in aggiornamento parziale
        for (let j = currentIndex; j >= 0; j--) {
            const pastP = this.livePoints[j];
            const timeDiff = (currentTime - new Date(pastP.dateTime).getTime()) / 1000;
            
            sumPower += (pastP.powerWatts || 0);
            count++;
            
            if (timeDiff >= 30) { 
                startIdx = j; 
                break; 
            }
        }

        const p30s = this.livePoints[startIdx];
        // Fallback sicuro se p30s non esiste (caso indice 0)
        if (!p30s) {
             return { avgPower30s: 0, altOld: 0, distOld: 0, timeDeltaWindow: 1 };
        }

        return {
            avgPower30s: count > 0 ? sumPower / count : null,
            altOld: p30s.altitude || p30s.elevation || 0,
            distOld: p30s.totalDistanceMeters || 0, // Usiamo il valore già calcolato nello storico
            timeDeltaWindow: (currentTime - new Date(p30s.dateTime).getTime()) / 1000
        };
    }

    accumulateZones(hr, power, dt, pZones) {
        if (hr > 0) {
            let hIndex = CONFIG.athlete.hrZones.findIndex(limit => hr <= limit);
            if (hIndex === -1) hIndex = 4;
            this.timeInHrZones[hIndex] += dt;
        }
        if (power > 0) {
            let pIndex = pZones.findIndex(limit => power <= limit);
            if (pIndex === -1) pIndex = 6;
            this.timeInPowerZones[pIndex] += dt;
        }
    }
}