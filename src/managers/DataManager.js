import { getDistanceFromLatLonInMeters } from '../utils.js';

export class DataManager {
    constructor() {
        this.rawLivePoints = new Map(); 
        this.livePoints = [];
        this.coursePoints = [];
        
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
                course: this.coursePoints
            }));
        }
    }

    // Gestione Traccia Pianificata
    ingestCourse(data) {
        const points = data.geoPoints || data.trackPoints || [];
        
        this.coursePoints = [];
        let distAccumulator = 0;

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const lat = p.latitude || p.lat;
            const lon = p.longitude || p.lon;
            // Normalizziamo subito l'elevazione
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

    // Gestione Traccia Reale
    ingestLive(data) {
        if (!data.trackPoints || data.trackPoints.length === 0) return;

        // 1. Merge dei dati grezzi nella Map
        data.trackPoints.forEach(point => {
            if (point.dateTime) {
                this.rawLivePoints.set(point.dateTime, point);
            }
        });

        // 2. Ricostruiamo l'array ordinato cronologicamente
        const sortedPoints = Array.from(this.rawLivePoints.values())
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // 3. Ricalcolo Distanze
        let distAccumulator = 0;
        
        for (let i = 0; i < sortedPoints.length; i++) {
            const p = sortedPoints[i];
            
            if (i > 0) {
                const prev = sortedPoints[i - 1];
                
                if (p.position && prev.position) {
                    const d = getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                    distAccumulator += d;
                }
            }
            
            p.totalDistanceMeters = distAccumulator;
        }

        this.livePoints = sortedPoints;
        
        // Logica di prima attivazione
        if (!this.hasReceivedLive) {
            this.hasReceivedLive = true;
            console.log(`LiveTrackPro: First Live Data sync. Points: ${this.livePoints.length}`);
        }
        
        this.notify();
    }
}