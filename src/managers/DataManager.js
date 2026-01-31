import { getDistanceFromLatLonInMeters } from '../utils.js';
import { CONFIG } from '../config.js';

export class DataManager {
    constructor() {
        // Strutture dati base
        this.rawLivePoints = new Map(); 
        this.livePoints = [];
        this.coursePoints = [];
        
        // Metriche avanzate (Stato iniziale)
        this.wPrimeBalance = CONFIG.athlete.wPrime;
        
        // Accumulatori Zone
        this.timeInHrZones = [0, 0, 0, 0, 0];           
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];  
        
        // Accumulatori Totali
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        this.normalizedPower = 0;
        this.intensityFactor = 0;

        // Stato Meteo [NEW]
        this.weatherState = null; 
        this.lastWeatherUpdate = 0; // Timestamp

        // Stato Ricezione
        this.hasReceivedCourses = false;
        this.hasReceivedLive = false;
        
        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        if (this.hasReceivedLive) {
            // Calcolo Durata
            let durationStr = "00:00:00";
            if (this.livePoints.length > 0) {
                const start = new Date(this.livePoints[0].dateTime);
                const end = new Date(this.livePoints[this.livePoints.length - 1].dateTime);
                const diffMs = end - start;
                durationStr = new Date(diffMs).toISOString().substr(11, 8);
            }

            this.listeners.forEach(cb => cb({
                live: this.livePoints,
                course: this.coursePoints,
                
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
                    vam: this.livePoints.length > 0 ? this.livePoints[this.livePoints.length - 1].vam : 0,
                    gradient: this.livePoints.length > 0 ? this.livePoints[this.livePoints.length - 1].gradient : 0,
                    weather: this.weatherState // [NEW] Passiamo l'oggetto meteo
                }
            }));
        }
    }

    // [NEW] Funzione Fetch Meteo (Throttled 15 min)
    async updateWeather(lat, lon) {
        if (!CONFIG.weatherApiKey) return;
        
        const now = Date.now();
        // Aggiorna solo se sono passati 15 minuti dall'ultimo update
        if (now - this.lastWeatherUpdate < 900000) return;

        try {
            console.log("LiveTrackPro: Fetching weather data...");
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.weatherApiKey}&units=metric&lang=it`);
            if (res.ok) {
                const data = await res.json();
                this.weatherState = {
                    temp: Math.round(data.main.temp),
                    description: data.weather[0].description,
                    icon: data.weather[0].icon,
                    windSpeed: Math.round(data.wind.speed * 3.6),
                    windDeg: data.wind.deg
                };
                this.lastWeatherUpdate = now;
                console.log("LiveTrackPro: Weather updated", this.weatherState);
                
                // [IMPORTANTE] Avvisa subito la UI che il meteo è arrivato!
                this.notify(); 
            }
        } catch (e) {
            console.warn("LiveTrackPro: Weather fetch failed", e);
        }
    }

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

        // Reset Calcoli
        let distAccumulator = 0;
        let currentWPrime = CONFIG.athlete.wPrime;
        
        this.totalElevationGain = 0;
        this.totalWorkJ = 0;
        this.timeInHrZones = [0, 0, 0, 0, 0];
        this.timeInPowerZones = [0, 0, 0, 0, 0, 0, 0];
        
        let rollingPowerSum4 = 0; 
        let rollingPowerCount = 0;
        const cp = CONFIG.athlete.cp;
        const pZones = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50].map(pct => Math.round(cp * pct));

        for (let i = 0; i < sortedPoints.length; i++) {
            const p = sortedPoints[i];
            const pTime = new Date(p.dateTime).getTime();
            
            // Logica Distanza
            let dt = 0; 
            if (i > 0) {
                const prev = sortedPoints[i - 1];
                dt = (pTime - new Date(prev.dateTime).getTime()) / 1000;
                
                if (p.position && prev.position) {
                    const d = getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                    distAccumulator += d;
                }
                const altDiff = (p.altitude || p.elevation || 0) - (prev.altitude || prev.elevation || 0);
                if (altDiff > 0) this.totalElevationGain += altDiff;
            }

            // Logica 30s Rolling (VAM/Grad)
            let start30sIdx = i;
            let sumPower30s = 0;
            let count30s = 0;
            
            for (let j = i; j >= 0; j--) {
                const pastP = sortedPoints[j];
                const timeDiff = (pTime - new Date(pastP.dateTime).getTime()) / 1000;
                sumPower30s += (pastP.powerWatts || 0);
                count30s++;
                if (timeDiff >= 30) { start30sIdx = j; break; }
            }

            const p30s = sortedPoints[start30sIdx];
            const altNow = p.altitude || p.elevation || 0;
            const altOld = p30s.altitude || p30s.elevation || 0;
            const distNow = distAccumulator;
            const distOld = p30s.totalDistanceMeters || 0;
            const timeDeltaWindow = (pTime - new Date(p30s.dateTime).getTime()) / 1000;

            let vam = 0;
            if (timeDeltaWindow > 0) vam = (altNow - altOld) / (timeDeltaWindow / 3600);
            p.vam = (vam > -5000 && vam < 5000) ? Math.round(vam) : 0; 
            if (p.vam < 0) p.vam = 0;

            const distDeltaWindow = distNow - distOld;
            let grad = 0;
            if (distDeltaWindow > 10) grad = ((altNow - altOld) / distDeltaWindow) * 100;
            p.gradient = Math.max(-30, Math.min(30, parseFloat(grad.toFixed(1))));

            // NP Accumulator
            if (count30s > 0) {
                const avgPower30s = sumPower30s / count30s;
                rollingPowerSum4 += Math.pow(avgPower30s, 4);
                rollingPowerCount++;
            }

            // W' & Work
            const power = p.powerWatts || 0;
            if (dt > 0 && dt < 1000) { 
                this.totalWorkJ += power * dt;

                if (power > cp) currentWPrime -= (power - cp) * dt;
                else currentWPrime += (cp - power) * dt;
                
                if (currentWPrime > CONFIG.athlete.wPrime) currentWPrime = CONFIG.athlete.wPrime;
                if (currentWPrime < 0) currentWPrime = 0;

                const hr = p.heartRateBeatsPerMin || 0;
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

            p.totalDistanceMeters = distAccumulator;
            p.distanceKm = distAccumulator / 1000;
            p.wPrimeBal = currentWPrime;
            p.efficiency = (p.powerWatts && p.heartRateBeatsPerMin) 
                ? (p.powerWatts / p.heartRateBeatsPerMin).toFixed(2) : null;
        }

        if (rollingPowerCount > 0) this.normalizedPower = Math.pow(rollingPowerSum4 / rollingPowerCount, 0.25);
        this.intensityFactor = (cp > 0) ? this.normalizedPower / cp : 0;

        this.livePoints = sortedPoints;

        // [NEW] Trigger Meteo Update se abbiamo coordinate recenti
        const lastP = this.livePoints[this.livePoints.length - 1];
        if (lastP && lastP.position && lastP.position.lat) {
            this.updateWeather(lastP.position.lat, lastP.position.lon);
        }
        
        if (!this.hasReceivedLive) {
            this.hasReceivedLive = true;
            console.log(`LiveTrackPro: First Live Data sync.`);
        }
        
        this.notify();
    }
}