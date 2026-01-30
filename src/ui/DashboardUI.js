import { CONFIG } from '../config.js';
import { MapComponent } from '../components/MapComponent.js';
import { ChartComponent } from '../components/ChartComponent.js';

export class DashboardUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.isInitialized = false;
        
        this.mapComponent = new MapComponent('map-container');
        this.elevationChart = new ChartComponent('elevation-chart', 'Altitudine (m)', CONFIG.colors.chartPrimary, true);
        this.speedChart = new ChartComponent('speed-chart', 'Velocità (km/h)', CONFIG.colors.chartPrimary, false);
    }

    async bootstrap() {
        if (this.isInitialized) return;
        
        await this.loadResources();
        this.cleanOriginalUI();
        this.renderStructure();
        
        this.mapComponent.init();
        this.elevationChart.init();
        this.speedChart.init();
        
        this.dataManager.subscribe(data => this.refresh(data));
        
        this.isInitialized = true;
        console.log("LiveTrackPro: UI Loaded & Ready.");

        // FIX RACE CONDITION
        if (this.dataManager.hasReceivedLive) {
            this.refresh({
                live: this.dataManager.livePoints,
                course: this.dataManager.coursePoints
            });
        }
    }

    loadResources() {
        const head = document.head;
        CONFIG.css.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = href;
            head.appendChild(link);
        });

        const scripts = CONFIG.libs.map(src => {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src; s.onload = resolve; s.onerror = reject;
                head.appendChild(s);
            });
        });
        return Promise.all(scripts);
    }

    cleanOriginalUI() {
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') child.style.display = 'none';
        });
    }

    renderStructure() {
        const container = document.createElement('div');
        container.id = 'livetrack-pro-dashboard';
        container.innerHTML = `
            <div class="ltp-card ltp-header">
                <div>
                    <h1 class="ltp-title">Live Track Pro <span class="ltp-subtitle">| Dashboard</span></h1>
                </div>
                <div id="status-log" class="ltp-status">In attesa di dati...</div>
            </div>

            <div class="ltp-grid">
                ${this.createMetricBox('speed', 'Speed', 'km/h', 'border-blue')}
                ${this.createMetricBox('power', 'Power', 'W', 'border-orange')}
                ${this.createMetricBox('cadence', 'Cadence', 'rpm', 'border-purple')}
                ${this.createMetricBox('hr', 'Heart Rate', 'bpm', 'border-red')}
            </div>

            <div class="ltp-card">
                <h3 style="margin:0 0 10px 0; color:#444;">Percorso Live</h3>
                <div id="map-container" class="ltp-vis-container"></div>
                
                <h3 style="margin:20px 0 10px 0; color:#444;">Profilo Altimetrico</h3>
                <div class="ltp-chart-container"><canvas id="elevation-chart"></canvas></div>
            </div>

            <div class="ltp-card">
                <h3 style="margin:0 0 10px 0; color:#444;">Profilo Velocità</h3>
                <div class="ltp-chart-container"><canvas id="speed-chart"></canvas></div>
            </div>
            
            <div class="ltp-footer">LiveTrackPro Active Interface</div>
        `;
        document.body.appendChild(container);
    }

    createMetricBox(id, label, unit, colorClass) {
        return `
            <div class="ltp-metric-box ${colorClass}">
                <div class="ltp-metric-label">${label}</div>
                <div class="ltp-metric-value-group">
                    <span id="live-${id}" class="ltp-value">--</span>
                    <span class="ltp-unit">${unit}</span>
                </div>
            </div>`;
    }

    refresh({ live, course }) {
        if (!live || live.length === 0) return;
        const lastPoint = live[live.length - 1];

        // Header info
        const timeStr = lastPoint.dateTime.split('T')[1].replace('Z', '');
        document.getElementById('status-log').innerHTML = 
            `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${live.length}`;

        // Metriche
        this.updateTextMetric('live-speed', lastPoint.speed ? (lastPoint.speed * 3.6).toFixed(1) : '-');
        this.updateTextMetric('live-power', lastPoint.powerWatts || '-');
        this.updateTextMetric('live-cadence', lastPoint.cadenceCyclesPerMin || '-');
        this.updateTextMetric('live-hr', lastPoint.heartRateBeatsPerMin || '-');

        // Mappa
        this.mapComponent.update(live, course);
        
        // Grafici
        this.elevationChart.update(
            live, 
            course, 
            p => (p.altitude !== undefined ? p.altitude : p.elevation), 
            p => p.altitude 
        );

        this.speedChart.update(
            live, 
            null,
            p => p.speed ? (p.speed * 3.6) : 0, 
            null
        );
    }

    updateTextMetric(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }
}