import { CONFIG } from '../config.js';
import { ChartComponent } from '../components/ChartComponent.js';

export class ChartManager {
    constructor() {
        this.charts = {};
    }

    init() {
        this.charts.elevation = new ChartComponent('elevation-chart', 'line', [
            { label: 'Altitudine (m)', color: CONFIG.colors.elevation, yAxisID: 'y', order: 1 },
            { label: 'Pianificato (m)', color: CONFIG.colors.courseLine, dashed: true, yAxisID: 'y', order: 2 },
            { label: 'Pendenza (%)', color: CONFIG.colors.slope, yAxisID: 'y1', fill: true, order: 3 }
        ]);

        this.charts.climb = new ChartComponent('climb-chart', 'line', [
            { label: 'Speed (km/h)', color: CONFIG.colors.speed, yAxisID: 'y', fill: false, order: 1 },
            { label: 'VAM (m/h)', color: CONFIG.colors.vam, yAxisID: 'y1', fill: true, order: 2 }
        ]);

        this.charts.powerHr = new ChartComponent('power-hr-chart', 'line', [
            { label: 'Power (W)', color: CONFIG.colors.power, yAxisID: 'y', fill: true, order: 2 },
            { label: 'Heart Rate (bpm)', color: CONFIG.colors.hr, yAxisID: 'y1', order: 1 }
        ]);

        this.charts.advanced = new ChartComponent('advanced-chart', 'line', [
            { label: "W' Balance (J)", color: CONFIG.colors.wPrime, yAxisID: 'y', fill: 'end', order: 2 },
            { label: 'Efficiency (Pw/HR)', color: CONFIG.colors.efficiency, yAxisID: 'y1', order: 1 }
        ]);

        this.charts.powerZones = new ChartComponent('power-zones-chart', 'bar', [
            { label: 'Power Zones', color: CONFIG.colors.powerZones }
        ]);

        this.charts.hrZones = new ChartComponent('hr-zones-chart', 'bar', [
            { label: 'HR Zones', color: CONFIG.colors.hrZones }
        ]);

        // Inizializza istanze Chart.js
        Object.values(this.charts).forEach(c => c.init());
    }

    update(live, course, hrZones, powerZones) {
        // 1. Calcolo Distanza Reale
        let liveMaxKm = 0;
        if (live && live.length > 0) {
            const lastP = live[live.length - 1];
            const dist = lastP.distanceKm ?? (lastP.totalDistanceMeters / 1000);
            if (dist) liveMaxKm = dist;
        }

        // 2. Calcolo Distanza Totale
        let overallMaxKm = liveMaxKm; 

        if (course && course.length > 0) {
            const lastC = course[course.length - 1];
            const courseKm = (lastC.totalDistanceMeters || 0) / 1000;
            
            if (courseKm > overallMaxKm) {
                overallMaxKm = courseKm;
            }
        }

        const courseData = (course && course.length > 0) ? course : [];
        
        // --- Aggiornamento Grafici ---

        // A. GRAFICO ALTIMETRIA
        this.charts.elevation.update(
            [live, courseData, live], 
            [
                p => (p.altitude ?? p.elevation), 
                p => (p.altitude ?? p.elevation), 
                p => p.gradient                   
            ],
            overallMaxKm
        );

        // B. GRAFICI TELEMETRIA

        this.charts.climb.update(
            [live, live],
            [p => (p.speed || 0) * 3.6, p => p.vam],
            liveMaxKm
        );
        
        this.charts.powerHr.update(
            [live, live], 
            [p => p.powerSmooth, p => p.heartRateBeatsPerMin],
            liveMaxKm
        );

        this.charts.advanced.update(
            [live, live], 
            [p => p.wPrimeBal, p => p.efficiency],
            liveMaxKm
        );

        // Update Bar Charts
        if (powerZones) {
            this.charts.powerZones.update(powerZones, ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7']);
        }
        if (hrZones) {
            this.charts.hrZones.update(hrZones, ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
        }
    }
}