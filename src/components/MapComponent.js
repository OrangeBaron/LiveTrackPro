import { CONFIG } from '../config.js';

export class MapComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.livePolyline = null;
        this.coursePolyline = null;
        this.marker = null;
    }

    init() {
        if (!window.L) return;
        this.map = L.map(this.containerId, { zoomControl: false }).setView([0, 0], 13);
        L.tileLayer(CONFIG.mapUrl, { attribution: '© OpenStreetMap' }).addTo(this.map);
        
        this.coursePolyline = L.polyline([], { 
            color: CONFIG.colors.courseLine, 
            weight: 4, 
            dashArray: '5, 10', 
            opacity: 0.7 
        }).addTo(this.map);

        this.livePolyline = L.polyline([], { 
            color: CONFIG.colors.liveLine, 
            weight: 5 
        }).addTo(this.map);
    }

    update(livePoints, coursePoints) {
        if (!this.map) return;

        // Disegna Course (se esiste)
        if (coursePoints && coursePoints.length > 0) {
            const courseLatLngs = coursePoints.map(p => [p.lat, p.lon]);
            this.coursePolyline.setLatLngs(courseLatLngs);
            // Fit bounds solo se abbiamo pochi punti live (avvio)
            if (livePoints.length < 5) {
                this.map.fitBounds(this.coursePolyline.getBounds());
            }
        }

        // Disegna Live Track
        const liveLatLngs = livePoints
            .filter(p => p.position && p.position.lat && p.position.lon)
            .map(p => [p.position.lat, p.position.lon]);

        if (liveLatLngs.length > 0) {
            this.livePolyline.setLatLngs(liveLatLngs);
            const lastPos = liveLatLngs[liveLatLngs.length - 1];

            if (!this.marker) {
                this.marker = L.circleMarker(lastPos, {
                    radius: 8, fillColor: CONFIG.colors.marker, color: "#fff", 
                    weight: 2, opacity: 1, fillOpacity: 0.8
                }).addTo(this.map);
            } else {
                this.marker.setLatLng(lastPos);
            }
            
            // Pan sul ciclista
            this.map.panTo(lastPos);
        }
    }
}