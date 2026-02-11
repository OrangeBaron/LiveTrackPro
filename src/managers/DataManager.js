import { getDistanceFromLatLonInMeters, calculateVam, calculateGradient, formatDuration } from '../utils/helpers.js';
import { CONFIG } from '../config.js';
import { WeatherManager } from './WeatherManager.js';
import { ElevationManager } from './ElevationManager.js'; // [NUOVO]
import { CyclingPhysics } from '../utils/CyclingPhysics.js';

export class DataManager {
    constructor() {
        this.rawLivePoints = new Map();
        this.livePoints = [];
        this.coursePoints = [];
        
        // Metriche "di stato"
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        this.timeInHrZones = [0, 0, 0, 0, 0];           
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];  
        
        // Accumulatori per NP/TSS
        this.rollingPowerSum4 = 0;
        this.rollingPowerCount = 0;
        
        // Metriche Calcolate Finali
        this.stats = {
            np: 0,
            if: 0,
            tss: 0
        };

        // Stato Ricezione
        this.hasReceivedCourses = false;
        this.hasReceivedLive = false;
        
        this.listeners = [];
        this.weatherManager = new WeatherManager(() => this.notify());
        this.elevationManager = new ElevationManager(); // [NUOVO]
    }

    resetAccumulators() {
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        this.timeInHrZones = [0, 0, 0, 0, 0];           
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];  
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        
        this.rollingPowerSum4 = 0;
        this.rollingPowerCount = 0;
        this.stats = { np: 0, if: 0, tss: 0 };
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
            
            // Mapping per grafici
            wPrime: this.livePoints.map(p => ({ x: p.distanceKm, y: p.wPrimeBal })),
            efficiency: this.livePoints.map(p => ({ x: p.distanceKm, y: p.efficiency })),
            
            hrZones: this.timeInHrZones,
            powerZones: this.timeInPowerZones,

            stats: {
                duration: durationStr,
                distance: lastPoint.totalDistanceMeters ? (lastPoint.totalDistanceMeters / 1000).toFixed(1) : '0.0',
                elevationGain: this.totalElevationGain,
                workKj: Math.round(this.totalWorkJ / 1000),
                
                // Usiamo le statistiche calcolate
                np: Math.round(this.stats.np),
                if: this.stats.if.toFixed(2),
                tss: Math.round(this.stats.tss),
                
                vam: lastPoint.vam || 0,
                gradient: lastPoint.gradient || 0,
                weather: this.weatherManager.current
            }
        }));
    }

    // Ora è asincrono per gestire il fetch dell'elevazione
    async ingestCourse(data) {
        // 1. Estrazione Array Punti: Gestiamo la struttura annidata "courses[0].coursePoints"
        let rawPoints = [];
        
        if (data.courses && data.courses.length > 0 && data.courses[0].coursePoints) {
            rawPoints = data.courses[0].coursePoints;
        } else {
            // Fallback per strutture legacy o differenti endpoint
            rawPoints = data.geoPoints || data.trackPoints || [];
        }

        this.coursePoints = [];
        let distAccumulator = 0;

        rawPoints.forEach((p, i) => {
            // 2. Estrazione Coordinate: Gestiamo l'oggetto "position"
            const pos = p.position || p;
            const lat = pos.lat || pos.latitude;
            const lon = pos.lon || pos.longitude;
            
            // Se non abbiamo coordinate valide, saltiamo il punto
            if (!lat || !lon) return;

            const ele = p.elevation || p.altitude || 0;
            
            // Uso della distanza nativa se presente nel JSON (più preciso)
            let dist = 0;
            const nativeDist = (p.distanceMeters !== undefined && p.distanceMeters !== null) 
                                ? p.distanceMeters 
                                : null;

            if (nativeDist !== null) {
                dist = nativeDist;
                // Allineiamo l'accumulatore
                distAccumulator = dist;
            } else {
                // Fallback: Calcolo manuale geodetico
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
        
        // Disegna subito la mappa (con altitudine piatta se mancante)
        this.notify();

        // 3. FETCH ELEVAZIONE (Se necessario)
        this.coursePoints = await this.elevationManager.enrichCoursePoints(this.coursePoints);
        
        // Aggiorna il grafico altimetrico con i dati nuovi
        this.notify();
    }

    ingestLive(data) {
        if (!data.trackPoints || data.trackPoints.length === 0) return;

        const incomingPoints = data.trackPoints;
        
        let lastProcessedTime = 0;
        if (this.livePoints.length > 0) {
            lastProcessedTime = new Date(this.livePoints[this.livePoints.length - 1].dateTime).getTime();
        }

        const firstIncomingTime = new Date(incomingPoints[0].dateTime).getTime();
        const isAppendSafe = (lastProcessedTime === 0) || (firstIncomingTime > lastProcessedTime);

        if (isAppendSafe && lastProcessedTime > 0) {
            const newValidPoints = incomingPoints.filter(p => new Date(p.dateTime).getTime() > lastProcessedTime);
            
            if (newValidPoints.length > 0) {
                newValidPoints.forEach(p => this.rawLivePoints.set(p.dateTime, p));
                const startIndex = this.livePoints.length;
                this.livePoints.push(...newValidPoints);
                this.processMetricsLoop(startIndex);
            }
        } else {
            // Full Rebuild
            incomingPoints.forEach(point => {
                if (point.dateTime) this.rawLivePoints.set(point.dateTime, point);
            });

            this.livePoints = Array.from(this.rawLivePoints.values())
                .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

            this.resetAccumulators();
            this.processMetricsLoop(0);
        }
        
        this.hasReceivedLive = true;
        this.notify();
    }

    processMetricsLoop(startIndex) {
        const cp = CONFIG.athlete.cp;
        // Pre-calcolo soglie zone potenza per efficienza
        const pZones = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50].map(pct => Math.round(cp * pct));

        let distAccumulator = 0;
        if (startIndex > 0) {
            distAccumulator = this.livePoints[startIndex - 1].totalDistanceMeters || 0;
        }

        for (let i = startIndex; i < this.livePoints.length; i++) {
            const p = this.livePoints[i];
            const pTime = new Date(p.dateTime).getTime();
            
            // 1. Calcolo Delta Tempo (dt)
            let dt = 0; 
            if (i > 0) {
                const prev = this.livePoints[i - 1];
                const prevTime = new Date(prev.dateTime).getTime();
                dt = (pTime - prevTime) / 1000;
            }

            // 2. Calcolo Distanza
            const nativeDist = (p.distanceMeters !== undefined && p.distanceMeters !== null) 
                               ? p.distanceMeters 
                               : ((p.totalDistanceMeters !== undefined && p.totalDistanceMeters !== null) ? p.totalDistanceMeters : null);

            if (nativeDist !== null) {
                distAccumulator = nativeDist;
            } else if (i > 0) {
                const prev = this.livePoints[i - 1];
                if (p.position && prev.position) {
                    const d = getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                    // Ignora micro-movimenti GPS da fermo
                    if (d > 0.5) distAccumulator += d;
                }
            }

            // Accumulo Dislivello
            if (i > 0) {
                const prev = this.livePoints[i - 1];
                const altDiff = (p.altitude || p.elevation || 0) - (prev.altitude || prev.elevation || 0);
                if (altDiff > 0) this.totalElevationGain += altDiff;
            }

            // 3. RECUPERO STATISTICHE ROLLING (via CyclingPhysics)
            const { avgPower30s, altOld, distOld, timeDeltaWindow } = CyclingPhysics.getRollingStats(this.livePoints, i);
            
            const smoothPower = avgPower30s !== null ? avgPower30s : (p.powerWatts || 0);

            // 4. Calcoli Altimetrici
            p.vam = calculateVam((p.altitude || 0), altOld, timeDeltaWindow);
            p.gradient = calculateGradient((p.altitude || 0), altOld, distAccumulator - distOld);

            // Accumulo per NP
            if (avgPower30s !== null) {
                this.rollingPowerSum4 += Math.pow(avgPower30s, 4);
                this.rollingPowerCount++;
            }

            // 5. METRICA W' (via CyclingPhysics)
            if (dt > 0) { 
                const currentWatts = p.powerWatts || 0;
                
                // Calcoliamo il lavoro accumulato (kJ)
                if (dt < 300) { 
                     this.totalWorkJ += currentWatts * dt; 
                }

                // Calcolo W' Balance
                this.wPrimeBalance = CyclingPhysics.updateWPrimeBalance(
                    this.wPrimeBalance, 
                    smoothPower, 
                    dt, 
                    cp, 
                    CONFIG.athlete.wPrime
                );

                this.accumulateZones(p.heartRateBeatsPerMin, smoothPower, dt, pZones);
            }

            // 6. Assegnazione valori finali al punto
            p.totalDistanceMeters = distAccumulator;
            p.distanceKm = distAccumulator / 1000;
            p.wPrimeBal = this.wPrimeBalance;
            p.powerSmooth = Math.round(smoothPower); 
            p.efficiency = CyclingPhysics.calculateEfficiency(smoothPower, p.heartRateBeatsPerMin);
            
            // Fallback Velocità
            if (p.speed === undefined && p.speedMetersPerSec !== undefined) {
                p.speed = p.speedMetersPerSec;
            }
        }

        // 7. Calcolo metriche globali (NP, IF, TSS)
        if (this.livePoints.length > 0) {
            const startTime = new Date(this.livePoints[0].dateTime).getTime();
            const endTime = new Date(this.livePoints[this.livePoints.length - 1].dateTime).getTime();
            const durationSeconds = (endTime - startTime) / 1000;

            this.stats = CyclingPhysics.calculateStressMetrics(
                this.rollingPowerSum4,
                this.rollingPowerCount,
                cp,
                durationSeconds
            );
        }

        // Trigger Meteo
        const lastP = this.livePoints[this.livePoints.length - 1];
        if (lastP?.position?.lat) {
            this.weatherManager.update(lastP.position.lat, lastP.position.lon);
        }
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