import { CONFIG } from '../config.js';
import { MapComponent } from '../components/MapComponent.js';
import { ChartComponent } from '../components/ChartComponent.js';
import { DASHBOARD_TEMPLATE } from './DashboardTemplate.js';
import { ViewHelpers } from './ViewHelpers.js'; // Nuovo Import

export class DashboardUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.isInitialized = false;
        
        // Componenti (inizializzati nel bootstrap)
        this.mapComponent = null;
        this.charts = {}; 
    }

    /**
     * Entry point: Carica risorse, prepara il DOM e avvia i componenti
     */
    async bootstrap() {
        if (this.isInitialized) return;
        
        await this._loadResources();
        
        const meta = this._extractPageMetadata();
        this._cleanOriginalUI();
        this._renderStructure(meta);
        
        this._initComponents();
        
        // Sottoscrizione agli aggiornamenti del DataManager
        this.dataManager.subscribe(data => this.refresh(data));
        
        this.isInitialized = true;
        console.log("LiveTrackPro: UI Loaded & Ready.");

        // Se ci sono già dati (es. dallo storico), aggiorna subito
        if (this.dataManager.hasReceivedLive) {
            this.dataManager.notify(); 
        }
    }

    /**
     * Metodo principale di aggiornamento chiamato dal DataManager
     */
    refresh(data) {
        const { live, course, stats, hrZones, powerZones } = data;

        if (!live || live.length === 0) return;
        const lastPoint = live[live.length - 1];

        // 1. Aggiorna Log Stato
        this._updateStatusLog(lastPoint, live.length);

        // 2. Aggiorna Metriche "Live" (Box colorati)
        this._updateLiveMetrics(lastPoint, stats);

        // 3. Aggiorna Summary Bar (Totali)
        this._updateSummaryBar(stats);

        // 4. Aggiorna Mappa
        this.mapComponent.update(live, course);

        // 5. Aggiorna Grafici
        this._updateCharts(live, course, hrZones, powerZones);
    }

    // --- SEZIONE SETUP DOM ---

    _renderStructure(meta) {
        const container = document.createElement('div');
        container.id = 'livetrack-pro-dashboard';
        
        // Generazione HTML dinamico usando il template
        // Nota: Qui potremmo ottimizzare ulteriormente, ma per ora teniamo la logica esistente
        const metricsHtml = this._buildMetricsHtml();
        const summaryHtml = this._buildSummaryHtml();

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

    _initComponents() {
        // Mappa
        this.mapComponent = new MapComponent('map-container');
        this.mapComponent.init();

        // Grafici
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

        // Inizializza tutti i chart
        Object.values(this.charts).forEach(c => c.init());
    }

    // --- SEZIONE AGGIORNAMENTI UI ---

    _updateStatusLog(lastPoint, count) {
        const timeStr = ViewHelpers.formatTime(lastPoint.dateTime);
        const el = document.getElementById('status-log');
        if (el) el.innerHTML = `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${count}`;
    }

    _updateLiveMetrics(p, stats) {
        // Helper interno per brevità
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('live-speed', p.speed ? ViewHelpers.formatNumber(p.speed * 3.6, 1) : '-');
        setTxt('live-power', ViewHelpers.formatInt(p.powerWatts));
        setTxt('live-cadence', ViewHelpers.formatInt(p.cadenceCyclesPerMin));
        setTxt('live-hr', ViewHelpers.formatInt(p.heartRateBeatsPerMin));
        
        // Dati derivati dallo StatsEngine
        setTxt('live-gradient', ViewHelpers.formatNumber(stats?.gradient, 1));
        setTxt('live-vam', ViewHelpers.formatInt(stats?.vam));
    }

    _updateSummaryBar(stats) {
        if (!stats) return;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('summary-time', stats.duration);
        setTxt('summary-distance', stats.distance);
        setTxt('summary-elevation', stats.elevationGain ? `+${Math.round(stats.elevationGain)}` : '0');
        
        setTxt('summary-np', ViewHelpers.formatInt(stats.np));
        setTxt('summary-if', stats.if);
        setTxt('summary-tss', ViewHelpers.formatInt(stats.tss));
        setTxt('summary-work', ViewHelpers.formatInt(stats.workKj));

        const weatherEl = document.getElementById('summary-weather');
        if (weatherEl) {
            weatherEl.innerHTML = ViewHelpers.getWeatherHtml(stats.weather);
        }
    }

    _updateCharts(live, course, hrZones, powerZones) {
        // Line Charts
        const courseData = (course && course.length > 0) ? course : [];
        
        this.charts.elevation.update(
            [live, courseData, live], 
            [
                p => (p.altitude ?? p.elevation), // Reale
                p => (p.altitude ?? p.elevation), // Pianificato
                p => p.gradient                   // Pendenza
            ]
        );

        this.charts.climb.update(
            [live, live],
            [p => (p.speed || 0) * 3.6, p => p.vam]
        );
        
        this.charts.powerHr.update(
            [live, live], 
            [p => p.powerSmooth, p => p.heartRateBeatsPerMin]
        );

        this.charts.advanced.update(
            [live, live], 
            [p => p.wPrimeBal, p => p.efficiency]
        );

        // Bar Charts
        if (powerZones) {
            this.charts.powerZones.update(powerZones, ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7']);
        }
        if (hrZones) {
            this.charts.hrZones.update(hrZones, ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
        }
    }

    // --- UTILS & HELPERS ---

    _createMetricBox(id, label, unit, colorClass) {
        return `<div class="ltp-metric-box ${colorClass}">
            <div class="ltp-metric-label">${label}</div>
            <div class="ltp-metric-value-group">
                <span id="live-${id}" class="ltp-value">--</span>
                <span class="ltp-unit">${unit}</span>
            </div>
        </div>`;
    }

    _createSummaryItem(id, label, unit) {
        return `<div class="ltp-summary-item">
            <div class="ltp-summary-label">${label}</div>
            <div>
                <span id="summary-${id}" class="ltp-summary-value">--</span>
                <span class="ltp-summary-unit">${unit}</span>
            </div>
        </div>`;
    }

    _buildMetricsHtml() {
        return [
            this._createMetricBox('speed', 'Speed', 'km/h', 'border-blue'),
            this._createMetricBox('power', 'Power', 'W', 'border-orange'),
            this._createMetricBox('hr', 'Heart Rate', 'bpm', 'border-red'),
            this._createMetricBox('cadence', 'Cadence', 'rpm', 'border-purple'),
            this._createMetricBox('gradient', 'Gradient', '%', 'border-grad'),
            this._createMetricBox('vam', 'V.A.M.', 'm/h', 'border-vam')
        ].join('');
    }

    _buildSummaryHtml() {
        return [
            this._createSummaryItem('time', 'Time', ''),
            this._createSummaryItem('distance', 'Distance', 'km'),
            this._createSummaryItem('elevation', 'Ascent', 'm'),
            this._createSummaryItem('np', 'Norm. Pwr', 'W'),
            this._createSummaryItem('if', 'Intensity', 'IF'),
            this._createSummaryItem('tss', 'TSS', 'pts'),
            this._createSummaryItem('work', 'Work', 'kJ'),
            this._createSummaryItem('weather', 'Live Weather', '')
        ].join('');
    }

    _extractPageMetadata() {
        try {
            const nameEl = document.querySelector("div[class*='AthleteDetails'] strong") 
                        || document.querySelector("strong[id*=':r']");
            const sessionEl = document.querySelector("div[class*='SessionInfo'] span[title]");
            return {
                name: nameEl ? nameEl.innerText.trim() : 'Live Track Pro',
                info: sessionEl ? sessionEl.getAttribute('title') : 'Analytics'
            };
        } catch (e) {
            return { name: 'Live Track Pro', info: 'Analytics' };
        }
    }

    _cleanOriginalUI() {
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') child.style.display = 'none';
        });
    }

    _loadResources() {
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
}