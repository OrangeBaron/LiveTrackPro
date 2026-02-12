import { getDistanceFromLatLonInMeters } from '../utils/helpers.js';

export class CourseMatcher {
    constructor() {
        this.coursePoints = [];
        this.reset();
    }

    // --- Inizializzazione e Stato ---
    reset() {
        this.lastMatchIndex = 0;
        this.offCourseBuffer = [];
        this.isOffCourse = false;
        
        this.exitCourseDistMeters = 0;
        this.distSinceExit = 0;
        
        this.MAX_OFF_COURSE_DIST = 70;
        this.SEARCH_WINDOW = 500;
    }

    setCourse(points) {
        this.coursePoints = points || [];
        this.reset();
    }

    // --- Logica Principale di Proiezione ---
    processPoints(livePoints, startIndex = 0) {
        if (!this.coursePoints.length) return;

        if (startIndex === 0) this.reset();

        for (let i = startIndex; i < livePoints.length; i++) {
            const p = livePoints[i];
            if (!p.position) continue;

            const match = this._findBestMatch(p);

            if (match.distance <= this.MAX_OFF_COURSE_DIST) {
                // *** ON COURSE ***
                
                if (this.isOffCourse) {
                    // Gestione Rientro (Rejoin): Interpola il buffer nel gap
                    this._resolveGap(this.offCourseBuffer, this.lastMatchIndex, match.index);
                    
                    this.offCourseBuffer = [];
                    this.isOffCourse = false;
                    this.distSinceExit = 0;
                }

                this.lastMatchIndex = match.index;
                
                const courseP = this.coursePoints[match.index];
                if (courseP.totalDistanceMeters !== undefined) {
                    p.distanceKm = courseP.totalDistanceMeters / 1000;
                    this.exitCourseDistMeters = courseP.totalDistanceMeters;
                }

            } else {
                // *** OFF COURSE ***
                
                this.isOffCourse = true;
                this.offCourseBuffer.push(p);

                let delta = 0;
                if (i > 0 && livePoints[i-1]?.position) {
                    const prev = livePoints[i-1];
                    delta = getDistanceFromLatLonInMeters(
                        prev.position.lat, prev.position.lon,
                        p.position.lat, p.position.lon
                    );
                }

                this.distSinceExit += delta;

                // Proiezione Live: Avanzamento basato su metri reali pedalati
                p.distanceKm = (this.exitCourseDistMeters + this.distSinceExit) / 1000;
            }
        }
    }

    // --- Helpers di Ricerca e Interpolazione ---
    _findBestMatch(livePoint) {
        let minDistance = Infinity;
        let bestIndex = this.lastMatchIndex;
        
        const maxSearch = Math.min(this.coursePoints.length, this.lastMatchIndex + this.SEARCH_WINDOW);

        for (let j = this.lastMatchIndex; j < maxSearch; j++) {
            const courseP = this.coursePoints[j];
            const d = getDistanceFromLatLonInMeters(
                livePoint.position.lat, livePoint.position.lon,
                courseP.lat, courseP.lon
            );

            if (d < minDistance) {
                minDistance = d;
                bestIndex = j;
            }
        }
        
        return { index: bestIndex, distance: minDistance };
    }

    _resolveGap(bufferPoints, exitIndex, entryIndex) {
        if (bufferPoints.length === 0) return;

        const startDist = (this.coursePoints[exitIndex]?.totalDistanceMeters || 0);
        const endDist = (this.coursePoints[entryIndex]?.totalDistanceMeters || 0);
        const gapSize = endDist - startDist;

        if (gapSize <= 0) {
            const safeDist = endDist / 1000;
            bufferPoints.forEach(p => p.distanceKm = safeDist);
            return;
        }

        let detourLength = 0;
        const dists = [0];

        for (let i = 1; i < bufferPoints.length; i++) {
            const prev = bufferPoints[i-1];
            const curr = bufferPoints[i];
            const d = getDistanceFromLatLonInMeters(
                prev.position.lat, prev.position.lon,
                curr.position.lat, curr.position.lon
            );
            detourLength += d;
            dists.push(detourLength);
        }

        if (detourLength === 0) detourLength = 1;

        // Sovrascrittura retroattiva (Interpolazione Lineare)
        bufferPoints.forEach((p, i) => {
            const progressRatio = dists[i] / detourLength;
            const projectedMeters = startDist + (progressRatio * gapSize);
            p.distanceKm = projectedMeters / 1000;
        });
    }
}