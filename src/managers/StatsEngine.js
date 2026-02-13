import { getDistanceFromLatLonInMeters, calculateVam, calculateGradient } from '../utils/helpers.js';
import { CyclingPhysics } from '../utils/CyclingPhysics.js';
import { CONFIG } from '../config.js';

export class StatsEngine {
    constructor() {
        this.reset();
    }

    reset() {
        // Metriche "di stato"
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        
        // Accumulatori Zone
        this.timeInHrZones = [0, 0, 0, 0, 0];
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];
        
        // Accumulatori per NP/TSS
        this.rollingPowerSum4 = 0;
        this.rollingPowerCount = 0;
        
        // Cache per ottimizzazione zone
        this.cp = CONFIG.athlete.cp;
        this.powerZoneThresholds = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50].map(pct => Math.round(this.cp * pct));
    }

    /**
     * Processa una sequenza di punti e arricchisce i dati
     * @param {Array} points - Riferimento all'array completo dei punti
     * @param {number} startIndex - Indice da cui partire a processare
     */
    processPoints(points, startIndex) {
        let distAccumulator = 0;
        
        // Recuperiamo l'accumulatore distanza dal punto precedente se non siamo all'inizio
        if (startIndex > 0 && points[startIndex - 1]) {
            distAccumulator = points[startIndex - 1].totalDistanceMeters || 0;
        }

        for (let i = startIndex; i < points.length; i++) {
            const p = points[i];
            const pTime = new Date(p.dateTime).getTime();
            
            // 1. Calcolo Delta Tempo (dt)
            let dt = 0; 
            if (i > 0) {
                const prev = points[i - 1];
                const prevTime = new Date(prev.dateTime).getTime();
                dt = (pTime - prevTime) / 1000;
            }

            // 2. Calcolo Distanza (Native o Calcolata)
            const nativeDist = (p.distanceMeters ?? p.totalDistanceMeters ?? null);

            if (nativeDist !== null) {
                distAccumulator = Math.max(distAccumulator, nativeDist);
            } else if (i > 0) {
                const prev = points[i - 1];
                if (p.position && prev.position) {
                    const d = getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                    if (d > 0.5) distAccumulator += d;
                }
            }

            // 3. Accumulo Dislivello
            if (i > 0) {
                const prev = points[i - 1];
                const altDiff = (p.altitude || p.elevation || 0) - (prev.altitude || prev.elevation || 0);
                if (altDiff > 0) this.totalElevationGain += altDiff;
            }

            // 4. Statistiche Rolling (30s avg per VAM/Power)
            const { avgPower30s, altOld, distOld, timeDeltaWindow } = CyclingPhysics.getRollingStats(points, i);
            const smoothPower = avgPower30s !== null ? avgPower30s : (p.powerWatts || 0);

            // 5. Arricchimento Punto (VAM, Gradient)
            p.vam = calculateVam((p.altitude || 0), altOld, timeDeltaWindow);
            p.gradient = calculateGradient((p.altitude || 0), altOld, distAccumulator - distOld);

            // Accumulo per NP (Normalized Power)
            if (avgPower30s !== null) {
                this.rollingPowerSum4 += Math.pow(avgPower30s, 4);
                this.rollingPowerCount++;
            }

            // 6. W' Balance e Lavoro
            if (dt > 0) { 
                const currentWatts = p.powerWatts || 0;
                
                // Ignoriamo buchi temporali enormi (> 5 min) per il calcolo del lavoro
                if (dt < 300) { 
                     this.totalWorkJ += currentWatts * dt; 
                }

                this.wPrimeBalance = CyclingPhysics.updateWPrimeBalance(
                    this.wPrimeBalance, 
                    currentWatts, 
                    dt, 
                    this.cp, 
                    CONFIG.athlete.wPrime
                );

                this._accumulateZones(p.heartRateBeatsPerMin, currentWatts, dt);
            }

            // 7. Finalizzazione Punto
            p.totalDistanceMeters = distAccumulator;
            p.distanceKm = distAccumulator / 1000;
            p.wPrimeBal = this.wPrimeBalance;
            p.powerSmooth = Math.round(smoothPower); 
            p.efficiency = CyclingPhysics.calculateEfficiency(smoothPower, p.heartRateBeatsPerMin);
            
            // Normalizzazione velocità
            if (p.speed === undefined && p.speedMetersPerSec !== undefined) {
                p.speed = p.speedMetersPerSec;
            }
        }
    }

    _accumulateZones(hr, power, dt) {
        if (hr > 0) {
            let hIndex = CONFIG.athlete.hrZones.findIndex(limit => hr <= limit);
            if (hIndex === -1) hIndex = 4; // Z5+
            this.timeInHrZones[hIndex] += dt;
        }
        if (power > 0) {
            let pIndex = this.powerZoneThresholds.findIndex(limit => power <= limit);
            if (pIndex === -1) pIndex = 6; // Z7
            this.timeInPowerZones[pIndex] += dt;
        }
    }

    getGlobalStats(durationSeconds) {
        return {
            ...CyclingPhysics.calculateStressMetrics(
                this.rollingPowerSum4,
                this.rollingPowerCount,
                this.cp,
                durationSeconds
            ),
            elevationGain: this.totalElevationGain,
            workKj: Math.round(this.totalWorkJ / 1000),
            hrZones: this.timeInHrZones,
            powerZones: this.timeInPowerZones
        };
    }
}