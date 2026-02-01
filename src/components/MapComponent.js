import { CONFIG } from '../config.js';
import { formatDuration } from '../utils/helpers.js';

export class MapComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.livePolyline = null;
        this.coursePolyline = null;
        this.marker = null;
        this.hoverMarker = null;
    }

    init() {
        if (!window.L) return;
        this.map = L.map(this.containerId, { zoomControl: false }).setView([0, 0], 13);
        L.tileLayer(CONFIG.mapUrl, { attribution: '© OpenStreetMap' }).addTo(this.map);
        
        // --- Setup Polylines ---
        this.coursePolyline = L.polyline([], { 
            color: CONFIG.colors.courseLine, 
            weight: 4, 
            dashArray: '5, 10', 
            opacity: 0.7,
            lineCap: 'round'
        }).addTo(this.map);

        this.livePolyline = L.polyline([], { 
            color: CONFIG.colors.liveLine, 
            weight: 5, 
            lineCap: 'round'
        }).addTo(this.map);

        // --- Setup Marker Hover ---
        this.hoverMarker = L.circleMarker([0, 0], {
            radius: 6,
            color: '#333',
            weight: 2,
            fillColor: '#fff',
            fillOpacity: 1,
            opacity: 0, 
            interactive: false 
        }).addTo(this.map);

        this.hoverMarker.bindTooltip('', {
            direction: 'top',
            offset: [0, -10],
            permanent: true,
            className: 'ltp-map-tooltip'
        });
    }

    update(livePoints, coursePoints) {
        if (!this.map) return;

        // --- Course ---
        if (coursePoints && coursePoints.length > 0) {
            const courseLatLngs = coursePoints.map(p => [p.lat, p.lon]);
            this.coursePolyline.setLatLngs(courseLatLngs);
            this.attachHoverEvents(this.coursePolyline, coursePoints, 'course');

            if (livePoints.length < 5) {
                this.map.fitBounds(this.coursePolyline.getBounds());
            }
        }

        // --- Live Track ---
        const validLivePoints = livePoints.filter(p => p.position && p.position.lat && p.position.lon);
        const liveLatLngs = validLivePoints.map(p => [p.position.lat, p.position.lon]);

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
            
            this.map.panTo(lastPos);
            this.attachHoverEvents(this.livePolyline, validLivePoints, 'live');
        }
    }

    attachHoverEvents(polyline, data, type) {
        polyline.off('mousemove');
        polyline.off('mouseout');

        polyline.on('mousemove', (e) => {
            const closest = this.findClosestPoint(e.latlng, data, type);
            
            if (closest) {
                const lat = type === 'live' ? closest.position.lat : closest.lat;
                const lon = type === 'live' ? closest.position.lon : closest.lon;
                
                this.hoverMarker.setLatLng([lat, lon]);
                this.hoverMarker.setStyle({ opacity: 1, fillOpacity: 1 });

                let content = `<div style="text-align:center; min-width:80px;">`;
                
                const km = ((closest.totalDistanceMeters || 0) / 1000).toFixed(2);
                content += `<div style="font-weight:700; color:#fff;">${km} km</div>`;

                if (type === 'live' && data.length > 0) {
                    const startTime = new Date(data[0].dateTime).getTime();
                    const currTime = new Date(closest.dateTime).getTime();
                    const elapsed = formatDuration(currTime - startTime);
                    content += `<div style="color:#ccc; font-size:11px; margin-top:3px; border-top:1px solid #555; padding-top:2px;">⏱️ ${elapsed}</div>`;
                } else if (type === 'course') {
                     content += `<div style="color:#999; font-size:10px; margin-top:2px;">COURSE</div>`;
                }

                content += `</div>`;

                this.hoverMarker.setTooltipContent(content);
                
                if (!this.map.hasLayer(this.hoverMarker.getTooltip())) {
                    this.hoverMarker.openTooltip();
                }
            }
        });

        polyline.on('mouseout', () => {
            this.hoverMarker.setStyle({ opacity: 0, fillOpacity: 0 });
            this.hoverMarker.closeTooltip();
        });
    }

    findClosestPoint(latlng, points, type) {
        if (!points || points.length === 0) return null;
        let minDist = Infinity;
        let closestPoint = null;
        for (const p of points) {
            const pLat = type === 'live' ? p.position.lat : p.lat;
            const pLon = type === 'live' ? p.position.lon : p.lon;
            const dist = latlng.distanceTo([pLat, pLon]);
            if (dist < minDist) {
                minDist = dist;
                closestPoint = p;
            }
        }
        return closestPoint;
    }
}