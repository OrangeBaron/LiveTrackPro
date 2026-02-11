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
        
        // Configurazione avanzata a 3 dataset per il grafico altimetrico
        this.elevationChart = new ChartComponent(
            'elevation-chart', 
            'Altitudine (m)', 
            CONFIG.colors.chartPrimary,
            'line',
            { 
                datasetsConfig: [
                    // Dataset 0: Altitudine Reale (Default - asse Y sx)
                    {
                        label: 'Altitudine (m)',
                        color: CONFIG.colors.chartPrimary,
                        yAxisID: 'y',
                        fill: true,
                        order: 2
                    },
                    // Dataset 1: Altitudine Pianificata (Course - asse Y sx)
                    { 
                        label: 'Pianificato (m)', 
                        color: CONFIG.colors.courseLine, 
                        dashed: true,
                        yAxisID: 'y', 
                        fill: false,
                        order: 1
                    },
                    // Dataset 2: Pendenza (Gradient - asse Y1 dx)
                    { 
                        label: 'Pendenza (%)', 
                        color: CONFIG.colors.slope, 
                        dashed: false, 
                        yAxisID: 'y1', 
                        fill: true,
                        order: 3
                    }
                ]
            }
        );
        
        this.climbChart = new ChartComponent(
            'climb-chart', 
            'VAM (m/h)', 
            CONFIG.colors.vam
        );
        
        // Colonna 2
        this.powerHrChart = new ChartComponent(
            'power-hr-chart', 
            'Power (W)', 
            CONFIG.colors.power,
            'dual-line',
            { 
                label2: 'Heart Rate (bpm)', 
                color2: CONFIG.colors.hr,
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
            barColors: CONFIG.colors.powerZones
        });

        this.hrZonesChart = new ChartComponent('hr-zones-chart', 'HR Zones', '', 'bar', {
            labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
            barColors: CONFIG.colors.hrZones
        });
    }

    async bootstrap() {
        if (this.isInitialized) return;
        
        await this.loadResources();

        const meta = this.extractPageMetadata();
        
        this.cleanOriginalUI();
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
        
        // --- GESTIONE GRAFICO ALTIMETRIA (AGGIORNATO) ---
        // Passiamo 3 dataset espliciti: 
        // 1. Live -> Altitudine Reale
        // 2. Course -> Altitudine Pianificata (se presente)
        // 3. Live -> Pendenza
        
        const sourceRealAlt = live;
        const sourceCourseAlt = (course && course.length > 0) ? course : []; // Usa course solo se esiste
        const sourceGradient = live;

        this.elevationChart.update(
            [sourceRealAlt, sourceCourseAlt, sourceGradient],
            [
                p => (p.altitude !== undefined ? p.altitude : p.elevation), // Estrattore 1 (Reale)
                p => (p.altitude !== undefined ? p.altitude : p.elevation), // Estrattore 2 (Pianificato)
                p => p.gradient                                             // Estrattore 3 (Pendenza)
            ]
        );

        // --- AGGIORNAMENTO ALTRI GRAFICI LINEARI ---
        
        this.climbChart.update(
            [live], 
            [p => p.vam]
        );

        this.powerHrChart.update(
            [live, live], 
            [p => p.powerSmooth, p => p.heartRateBeatsPerMin]
        );

        this.advancedChart.update(
            [live, live], 
            [p => p.wPrimeBal, p => p.efficiency]
        );
        
        // I grafici a barre usano logica diversa
        if (powerZones) this.powerZonesChart.update(powerZones);
        if (hrZones) this.hrZonesChart.update(hrZones);
    }

    updateTextMetric(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }
}