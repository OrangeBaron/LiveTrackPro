import { CONFIG } from '../config.js';
import { MapComponent } from '../components/MapComponent.js';
import { ChartComponent } from '../components/ChartComponent.js';
import { DASHBOARD_TEMPLATE } from './DashboardTemplate.js';

export class DashboardUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.isInitialized = false;
        
        // --- Inizializzazione Componenti ---
        
        // Colonna 1
        this.mapComponent = new MapComponent('map-container');
        
        this.elevationChart = new ChartComponent(
            'elevation-chart', 
            'Altitudine (m)', 
            CONFIG.colors.chartPrimary,
            'dual-line',
            { 
                label2: 'Pendenza (%)', 
                color2: CONFIG.colors.slope, // REF: config
                dashed2: true 
            }
        );
        
        this.climbChart = new ChartComponent(
            'climb-chart', 
            'VAM (m/h)', 
            CONFIG.colors.vam // REF: config
        );
        
        // Colonna 2
        this.powerHrChart = new ChartComponent(
            'power-hr-chart', 
            'Power (W)', 
            CONFIG.colors.power, // REF: config
            'dual-line',
            { 
                label2: 'Heart Rate (bpm)', 
                color2: CONFIG.colors.hr, // REF: config
                dashed2: false 
            }
        );

        this.advancedChart = new ChartComponent(
            'advanced-chart', 
            "W' Balance (J)", 
            CONFIG.colors.wPrime, 
            'dual-line',
            { label2: 'Efficiency (Pw/HR)', color2: CONFIG.colors.efficiency, dashed2: true }
        ); 
        
        this.powerZonesChart = new ChartComponent('power-zones-chart', 'Power Zones', '', 'bar', {
            labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7'],
            barColors: CONFIG.colors.powerZones // REF: config
        });

        this.hrZonesChart = new ChartComponent('hr-zones-chart', 'HR Zones', '', 'bar', {
            labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
            barColors: CONFIG.colors.hrZones // REF: config
        });
    }

    async bootstrap() {
        if (this.isInitialized) return;
        
        await this.loadResources();

        const meta = this.extractPageMetadata();
        
        this.cleanOriginalUI();
        this.injectCustomStyles();
        this.renderStructure(meta);
        
        // Init dei chart sui canvas appena creati
        this.mapComponent.init();
        this.elevationChart.init();
        this.climbChart.init();
        this.powerHrChart.init();
        this.advancedChart.init();
        this.powerZonesChart.init();
        this.hrZonesChart.init(); 
        
        // Sottoscrizione agli aggiornamenti
        this.dataManager.subscribe(data => this.refresh(data));
        
        this.isInitialized = true;
        console.log("LiveTrackPro: UI Loaded & Ready.");

        // Se ci sono già dati (es. dallo storico), aggiorna subito
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

    extractPageMetadata() {
        try {
            const nameEl = document.querySelector("div[class*='AthleteDetails'] strong") 
                           || document.querySelector("strong[id*=':r']");
            
            const sessionEl = document.querySelector("div[class*='SessionInfo'] span[title]");

            return {
                name: nameEl ? nameEl.innerText.trim() : 'Live Track Pro',
                info: sessionEl ? sessionEl.getAttribute('title') : 'Analytics'
            };
        } catch (e) {
            console.warn("LiveTrackPro: Impossibile estrarre metadati pagina", e);
            return { name: 'Live Track Pro', info: 'Analytics' };
        }
    }

    cleanOriginalUI() {
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') child.style.display = 'none';
        });
    }

    injectCustomStyles() {
        // Anche qui usiamo i colori dal CONFIG per consistenza
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
            .border-grad { border-color: ${CONFIG.colors.slope}; } 
            .border-vam { border-color: ${CONFIG.colors.vam}; }
        `;
        document.head.appendChild(style);
    }

    renderStructure(meta) {
        const container = document.createElement('div');
        container.id = 'livetrack-pro-dashboard';
        
        const metricsHtml = [
            this.createMetricBox('speed', 'Speed', 'km/h', 'border-blue'),
            this.createMetricBox('power', 'Power', 'W', 'border-orange'),
            this.createMetricBox('hr', 'Heart Rate', 'bpm', 'border-red'),
            this.createMetricBox('cadence', 'Cadence', 'rpm', 'border-purple'),
            this.createMetricBox('gradient', 'Gradient', '%', 'border-grad'),
            this.createMetricBox('vam', 'V.A.M.', 'm/h', 'border-vam')
        ].join('');

        const summaryHtml = [
            this.createSummaryItem('time', 'Time', ''),
            this.createSummaryItem('distance', 'Distance', 'km'),
            this.createSummaryItem('elevation', 'Ascent', 'm'),
            this.createSummaryItem('np', 'Norm. Pwr', 'W'),
            this.createSummaryItem('if', 'Intensity', 'IF'),
            this.createSummaryItem('tss', 'TSS', 'pts'),
            this.createSummaryItem('work', 'Work', 'kJ'),
            this.createSummaryItem('weather', 'Live Weather', '')
        ].join('');

        let finalHtml = DASHBOARD_TEMPLATE
            .replace('{{ATHLETE_NAME}}', meta.name)
            .replace('{{SESSION_INFO}}', meta.info)
            .replace('{{METRICS_GRID}}', metricsHtml)
            .replace('{{SUMMARY_BAR}}', summaryHtml)
            .replace('{{COLOR_WPRIME}}', CONFIG.colors.wPrime)
            .replace('{{COLOR_EFFICIENCY}}', CONFIG.colors.efficiency);

        container.innerHTML = finalHtml;
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

        const timeStr = new Date(lastPoint.dateTime).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        document.getElementById('status-log').innerHTML = 
            `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${live.length}`;

        this.updateTextMetric('live-speed', lastPoint.speed ? (lastPoint.speed * 3.6).toFixed(1) : '-');
        this.updateTextMetric('live-power', lastPoint.powerWatts || '-');
        this.updateTextMetric('live-cadence', lastPoint.cadenceCyclesPerMin || '-');
        this.updateTextMetric('live-hr', lastPoint.heartRateBeatsPerMin || '-');
        this.updateTextMetric('live-gradient', stats && stats.gradient !== undefined ? stats.gradient : '-');
        this.updateTextMetric('live-vam', stats && stats.vam !== undefined ? stats.vam : '-');

        if (stats) {
            this.updateTextMetric('summary-time', stats.duration || '00:00:00');
            this.updateTextMetric('summary-distance', stats.distance || '0.0');
            this.updateTextMetric('summary-elevation', stats.elevationGain ? `+${Math.round(stats.elevationGain)}` : '0');
            this.updateTextMetric('summary-np', stats.np || '-');
            this.updateTextMetric('summary-if', stats.if || '-');
            this.updateTextMetric('summary-tss', stats.tss || '0');
            this.updateTextMetric('summary-work', stats.workKj || '-');

            if (stats.weather) {
                const w = stats.weather;
                const icon = (w.description || '').includes('pioggia') ? '🌧️' : ((w.description || '').includes('nubi') ? '☁️' : '☀️');
                const arrow = this.getWindArrow(w.windDeg);
                const html = `${w.temp}° <small>${icon}</small> <small style="color:#666; font-size:14px; margin-left:5px;">${arrow} ${w.windSpeed}</small>`;
                const el = document.getElementById('summary-weather');
                if (el) el.innerHTML = html;
            } else {
                const el = document.getElementById('summary-weather');
                if(el) el.innerHTML = '<span style="font-size:12px; color:#ccc;">No API Key</span>';
            }
        }

        this.mapComponent.update(live, course);
        
        this.elevationChart.update(
            live, 
            live,
            p => (p.altitude !== undefined ? p.altitude : p.elevation), 
            p => p.gradient
        );

        this.climbChart.update(
            live, 
            null,
            p => p.vam,
            null
        );

        this.powerHrChart.update(live, null, p => p.powerSmooth, p => p.heartRateBeatsPerMin);

        this.advancedChart.update(live, null, p => p.wPrimeBal, p => p.efficiency);
        if (powerZones) this.powerZonesChart.update(powerZones);
        if (hrZones) this.hrZonesChart.update(hrZones);
    }

    updateTextMetric(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }
}