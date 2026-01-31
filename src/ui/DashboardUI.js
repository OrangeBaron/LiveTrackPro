import { CONFIG } from '../config.js';
import { MapComponent } from '../components/MapComponent.js';
import { ChartComponent } from '../components/ChartComponent.js';

export class DashboardUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.isInitialized = false;
        
        // --- COLONNA 1 ---
        this.mapComponent = new MapComponent('map-container');
        this.elevationChart = new ChartComponent('elevation-chart', 'Altitudine (m)', CONFIG.colors.chartPrimary);
        
        // ClimbChart (VAM vs Gradient)
        this.climbChart = new ChartComponent(
            'climb-chart', 
            'VAM (m/h)', 
            '#16a085', // Colore VAM (Verde Acqua)
            'dual-line',
            { 
                label2: 'Pendenza (%)', 
                color2: '#7f8c8d', // Colore Pendenza (Grigio)
                dashed2: true
            }
        );
        
        // --- COLONNA 2 ---
        
        // 1. Grafico Power & HR
        this.powerHrChart = new ChartComponent(
            'power-hr-chart', 
            'Power (W)', 
            '#e67e22',
            'dual-line',
            { label2: 'Heart Rate (bpm)', color2: '#e74c3c', dashed2: false }
        );

        // 2. Grafico W' Balance & Efficiency
        this.advancedChart = new ChartComponent(
            'advanced-chart', 
            "W' Balance (J)", 
            CONFIG.colors.wPrime, 
            'dual-line',
            { label2: 'Efficiency (Pw/HR)', color2: CONFIG.colors.efficiency, dashed2: true }
        ); 
        
        // 3. Grafici Zone
        this.powerZonesChart = new ChartComponent('power-zones-chart', 'Power Zones', '', 'bar', {
            labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'],
            barColors: ['#95a5a6', '#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c', '#8e44ad']
        });

        this.hrZonesChart = new ChartComponent('hr-zones-chart', 'HR Zones', '', 'bar', {
            labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
            barColors: ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c']
        });
    }

    async bootstrap() {
        if (this.isInitialized) return;
        
        await this.loadResources();
        this.cleanOriginalUI();
        this.injectCustomStyles();
        this.renderStructure();
        
        // Inizializzazione Componenti
        this.mapComponent.init();
        this.elevationChart.init();
        this.climbChart.init();
        
        this.powerHrChart.init();
        this.advancedChart.init();
        this.powerZonesChart.init();
        this.hrZonesChart.init(); 
        
        this.dataManager.subscribe(data => this.refresh(data));
        
        this.isInitialized = true;
        console.log("LiveTrackPro: UI Loaded & Ready.");

        if (this.dataManager.hasReceivedLive) {
            this.dataManager.notify(); 
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

    injectCustomStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .ltp-summary-bar {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                gap: 10px;
                background: #fff;
                padding: 15px;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                border-left: 5px solid #2c3e50;
            }
            .ltp-summary-item {
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 0 10px;
                border-right: 1px solid #eee;
            }
            .ltp-summary-item:last-child { border-right: none; }
            .ltp-summary-label {
                font-size: 11px;
                text-transform: uppercase;
                color: #888;
                font-weight: 600;
                margin-bottom: 2px;
            }
            .ltp-summary-value {
                font-size: 18px;
                font-weight: 700;
                color: #2c3e50;
            }
            .ltp-summary-unit { font-size: 12px; font-weight: 400; color: #666; margin-left: 2px; }
            .border-grad { border-color: #7f8c8d; }
            .border-vam { border-color: #16a085; }
        `;
        document.head.appendChild(style);
    }

    renderStructure() {
        const container = document.createElement('div');
        container.id = 'livetrack-pro-dashboard';
        
        container.innerHTML = `
            <div class="ltp-card ltp-header">
                <div>
                    <h1 class="ltp-title">Live Track Pro <span class="ltp-subtitle">| Analytics</span></h1>
                </div>
                <div id="status-log" class="ltp-status">In attesa di dati...</div>
            </div>

            <div class="ltp-grid">
                ${this.createMetricBox('speed', 'Speed', 'km/h', 'border-blue')}
                ${this.createMetricBox('power', 'Power', 'W', 'border-orange')}
                ${this.createMetricBox('hr', 'Heart Rate', 'bpm', 'border-red')}
                ${this.createMetricBox('cadence', 'Cadence', 'rpm', 'border-purple')}
                ${this.createMetricBox('gradient', 'Gradient', '%', 'border-grad')}
                ${this.createMetricBox('vam', 'V.A.M.', 'm/h', 'border-vam')}
            </div>

            <div class="ltp-summary-bar">
                ${this.createSummaryItem('time', 'Time', '')}
                ${this.createSummaryItem('elevation', 'Ascent', 'm')}
                ${this.createSummaryItem('np', 'Norm. Pwr', 'W')}
                ${this.createSummaryItem('if', 'Intensity', 'IF')}
                ${this.createSummaryItem('work', 'Work', 'kJ')}
                ${this.createSummaryItem('weather', 'Live Weather', '')}
            </div>

            <div class="ltp-content-grid">
                
                <div class="ltp-column">
                    <div class="ltp-card">
                        <h3 style="margin:0 0 10px 0; color:#444;">Posizione & Percorso</h3>
                        <div id="map-container" class="ltp-vis-container"></div>
                    </div>

                    <div class="ltp-card">
                        <h3 style="margin:0 0 10px 0; color:#444;">Profilo Altimetrico</h3>
                        <div class="ltp-chart-container"><canvas id="elevation-chart"></canvas></div>
                    </div>

                    <div class="ltp-card">
                        <h3 style="margin:0 0 10px 0; color:#444;">Profilo Salita</h3>
                        <div class="ltp-chart-container"><canvas id="climb-chart"></canvas></div>
                    </div>
                </div>

                <div class="ltp-column">
                    <div class="ltp-card">
                        <h3 style="margin:0 0 5px 0; color:#444;">Potenza & Cuore</h3>
                        <p style="font-size:11px; color:#666; margin:0 0 15px 0;">
                            <span style="color:#e67e22">●</span> Power (W) &nbsp; 
                            <span style="color:#e74c3c">●</span> Heart Rate (bpm)
                        </p>
                        <div class="ltp-vis-container" style="height: 300px;">
                            <canvas id="power-hr-chart"></canvas>
                        </div>
                    </div>

                    <div class="ltp-card">
                        <h3 style="margin:0 0 5px 0; color:#444;">Riserva Energetica & Efficienza</h3>
                        <p style="font-size:11px; color:#666; margin:0 0 15px 0;">
                            <span style="color:${CONFIG.colors.wPrime}">●</span> W' Balance (J) &nbsp; 
                            <span style="color:${CONFIG.colors.efficiency}">●</span> Efficienza (Watt/HR)
                        </p>
                        <div class="ltp-vis-container" style="height: 300px;">
                            <canvas id="advanced-chart"></canvas>
                        </div>
                    </div>

                    <div class="ltp-card">
                        <h3 style="margin:0 0 10px 0; color:#444;">Distribuzione Zone</h3>
                        <div style="display: flex; gap: 15px;">
                            <div style="flex: 1;">
                                <h4 style="margin:0 0 5px 0; font-size:12px; color:#666; text-align:center;">POWER (Coggan 7-Zones)</h4>
                                <div class="ltp-chart-container" style="height: 250px;">
                                    <canvas id="power-zones-chart"></canvas>
                                </div>
                            </div>
                            <div style="flex: 1;">
                                <h4 style="margin:0 0 5px 0; font-size:12px; color:#666; text-align:center;">HEART RATE (Friel 5-Zones)</h4>
                                <div class="ltp-chart-container" style="height: 250px;">
                                    <canvas id="hr-zones-chart"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
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

    createSummaryItem(id, label, unit) {
        return `
            <div class="ltp-summary-item">
                <div class="ltp-summary-label">${label}</div>
                <div>
                    <span id="summary-${id}" class="ltp-summary-value">--</span>
                    <span class="ltp-summary-unit">${unit}</span>
                </div>
            </div>`;
    }

    getWindArrow(deg) {
        const arrows = ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'];
        return arrows[Math.round(deg / 45) % 8];
    }

    refresh({ live, course, hrZones, powerZones, stats }) {
        if (!live || live.length === 0) return;
        const lastPoint = live[live.length - 1];

        // 1. Info
        const timeStr = new Date(lastPoint.dateTime).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        document.getElementById('status-log').innerHTML = 
            `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${live.length}`;

        // 2. Metriche Live
        this.updateTextMetric('live-speed', lastPoint.speed ? (lastPoint.speed * 3.6).toFixed(1) : '-');
        this.updateTextMetric('live-power', lastPoint.powerWatts || '-');
        this.updateTextMetric('live-cadence', lastPoint.cadenceCyclesPerMin || '-');
        this.updateTextMetric('live-hr', lastPoint.heartRateBeatsPerMin || '-');
        this.updateTextMetric('live-gradient', stats && stats.gradient !== undefined ? stats.gradient : '-');
        this.updateTextMetric('live-vam', stats && stats.vam !== undefined ? stats.vam : '-');

        // 3. Summary Stats
        if (stats) {
            this.updateTextMetric('summary-time', stats.duration || '00:00:00');
            this.updateTextMetric('summary-elevation', stats.elevationGain ? `+${Math.round(stats.elevationGain)}` : '0');
            this.updateTextMetric('summary-np', stats.np || '-');
            this.updateTextMetric('summary-if', stats.if || '-');
            this.updateTextMetric('summary-work', stats.workKj || '-');

            if (stats.weather) {
                const w = stats.weather;
                const icon = w.description.includes('pioggia') ? '🌧️' : (w.description.includes('nubi') ? '☁️' : '☀️');
                const arrow = this.getWindArrow(w.windDeg);
                const html = `${w.temp}° <small>${icon}</small> <small style="color:#666; font-size:14px; margin-left:5px;">${arrow} ${w.windSpeed}</small>`;
                const el = document.getElementById('summary-weather');
                if (el) el.innerHTML = html;
            } else {
                const el = document.getElementById('summary-weather');
                if(el) el.innerHTML = '<span style="font-size:12px; color:#ccc;">No API Key</span>';
            }
        }

        // 4. Update Grafici
        this.mapComponent.update(live, course);
        
        this.elevationChart.update(
            live, 
            course, 
            p => (p.altitude !== undefined ? p.altitude : p.elevation), 
            p => p.altitude
        );

        this.climbChart.update(
            live, 
            null,
            p => p.vam,
            p => p.gradient
        );

        this.powerHrChart.update(live, null, p => p.powerWatts, p => p.heartRateBeatsPerMin);
        this.advancedChart.update(live, null, p => p.wPrimeBal, p => p.efficiency);
        if (powerZones) this.powerZonesChart.update(powerZones);
        if (hrZones) this.hrZonesChart.update(hrZones);
    }

    updateTextMetric(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }
}