import { getDistanceFromLatLonInMeters, calculateVam, calculateGradient, formatDuration } from '../utils.js';
import { CONFIG } from '../config.js';
import { WeatherManager } from './WeatherManager.js';

export class DataManager {
    constructor() {
        this.rawLivePoints = new Map(); 
        this.livePoints = [];
        this.coursePoints = [];
        
        // Metriche avanzate
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        
        // Accumulatori
        this.resetAccumulators();

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
        this.normalizedPower = 0;
        this.intensityFactor = 0;
        this.tss = 0;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        if (!this.hasReceivedLive) return;

        // Calcolo Durata
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

        data.trackPoints.forEach(point => {
            if (point.dateTime) this.rawLivePoints.set(point.dateTime, point);
        });

        const sortedPoints = Array.from(this.rawLivePoints.values())
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        this.processPoints(sortedPoints);
        
        if (!this.hasReceivedLive) {
            this.hasReceivedLive = true;
            console.log(`LiveTrackPro: First Live Data sync.`);
        }
        
        this.notify();
    }

    processPoints(sortedPoints) {
        this.resetAccumulators();
        
        let distAccumulator = 0;
        
        // --- SETUP W' (Modello Skiba) ---
        let wPrimeBalance = CONFIG.athlete.wPrime; 
        const cp = CONFIG.athlete.cp;
        
        // Zone per statistiche
        const pZones = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50].map(pct => Math.round(cp * pct));

        let rollingPowerSum4 = 0; 
        let rollingPowerCount = 0;

        for (let i = 0; i < sortedPoints.length; i++) {
            const p = sortedPoints[i];
            const pTime = new Date(p.dateTime).getTime();
            
            // 1. Calcolo Delta Tempo (dt) e Distanza
            let dt = 0; 
            if (i > 0) {
                const prev = sortedPoints[i - 1];
                dt = (pTime - new Date(prev.dateTime).getTime()) / 1000;
                
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
            const { avgPower30s, altOld, distOld, timeDeltaWindow } = this.getRolling30sStats(sortedPoints, i, pTime, distAccumulator);
            // Se non abbiamo ancora abbastanza storico per la media, usiamo il valore istantaneo
            const smoothPower = avgPower30s !== null ? avgPower30s : (p.powerWatts || 0);

            // 3. Calcoli Altimetrici
            p.vam = calculateVam((p.altitude || 0), altOld, timeDeltaWindow);
            p.gradient = calculateGradient((p.altitude || 0), altOld, distAccumulator - distOld);

            if (avgPower30s !== null) {
                rollingPowerSum4 += Math.pow(avgPower30s, 4);
                rollingPowerCount++;
            }

            // 4. METRICA W' (Modello Skiba Esponenziale) & Efficienza
            if (dt > 0 && dt < 1000) { 
                this.totalWorkJ += (p.powerWatts || 0) * dt; 

                // --- ALGORITMO SKIBA ---
                if (smoothPower > cp) {
                    wPrimeBalance -= (smoothPower - cp) * dt;
                } else {
                    const underP = cp - smoothPower;
                    // Tau dinamico Skiba 2015
                    const tau = 546 * Math.exp(-0.01 * underP) + 316;
                    
                    const wPrimeExpended = CONFIG.athlete.wPrime - wPrimeBalance;
                    const newWPrimeExpended = wPrimeExpended * Math.exp(-dt / tau);
                    
                    wPrimeBalance = CONFIG.athlete.wPrime - newWPrimeExpended;
                }
                
                // Clamp W'
                wPrimeBalance = Math.min(Math.max(wPrimeBalance, 0), CONFIG.athlete.wPrime);

                this.accumulateZones(p.heartRateBeatsPerMin, smoothPower, dt, pZones);
            }

            // 5. Assegnazione valori puliti al punto
            p.totalDistanceMeters = distAccumulator;
            p.distanceKm = distAccumulator / 1000;
            p.wPrimeBal = wPrimeBalance;
            p.powerSmooth = Math.round(smoothPower); 
            
            // Efficienza (Decoupling) filtrata
            if (smoothPower > 10 && p.heartRateBeatsPerMin > 40) {
                p.efficiency = (smoothPower / p.heartRateBeatsPerMin).toFixed(2);
            } else {
                p.efficiency = null;
            }
        }

        // Finalize Statistiche Globali
        if (rollingPowerCount > 0) this.normalizedPower = Math.pow(rollingPowerSum4 / rollingPowerCount, 0.25);
        this.intensityFactor = (cp > 0) ? this.normalizedPower / cp : 0;
        if (sortedPoints.length > 0 && cp > 0) {
            const startTime = new Date(sortedPoints[0].dateTime).getTime();
            const endTime = new Date(sortedPoints[sortedPoints.length - 1].dateTime).getTime();
            const durationSeconds = (endTime - startTime) / 1000;
            this.tss = (durationSeconds * this.normalizedPower * this.intensityFactor) / (cp * 3600) * 100;
        }
        this.livePoints = sortedPoints;

        // Trigger Meteo
        const lastP = this.livePoints[this.livePoints.length - 1];
        if (lastP?.position?.lat) {
            this.weatherManager.update(lastP.position.lat, lastP.position.lon);
        }
    }

    getRolling30sStats(points, currentIndex, currentTime, currentDist) {
        let sumPower = 0;
        let count = 0;
        let startIdx = currentIndex;

        for (let j = currentIndex; j >= 0; j--) {
            const pastP = points[j];
            const timeDiff = (currentTime - new Date(pastP.dateTime).getTime()) / 1000;
            
            sumPower += (pastP.powerWatts || 0);
            count++;
            
            if (timeDiff >= 30) { 
                startIdx = j; 
                break; 
            }
        }

        const p30s = points[startIdx];
        return {
            avgPower30s: count > 0 ? sumPower / count : null,
            altOld: p30s.altitude || p30s.elevation || 0,
            distOld: p30s.totalDistanceMeters || 0, 
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