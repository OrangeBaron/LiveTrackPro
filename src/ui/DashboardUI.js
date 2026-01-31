import { CONFIG } from '../config.js';
import { MapComponent } from '../components/MapComponent.js';
import { ChartComponent } from '../components/ChartComponent.js';

export class DashboardUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.isInitialized = false;
        
        // --- COLONNA 1 (Geografica/Fisica) ---
        this.mapComponent = new MapComponent('map-container');
        this.elevationChart = new ChartComponent('elevation-chart', 'Altitudine (m)', CONFIG.colors.chartPrimary);
        this.speedChart = new ChartComponent('speed-chart', 'Velocità (km/h)', CONFIG.colors.chartPrimary);
        
        // --- COLONNA 2 (Fisiologica/Avanzata) ---
        // Nuovo Grafico: Potenza e Cuore
        this.powerHrChart = new ChartComponent('power-hr-chart', '', '', 'dual-line');

        // 'dual-line' e 'bar' sono i tipi gestiti dal nuovo ChartComponent
        this.advancedChart = new ChartComponent('advanced-chart', '', '', 'dual-line'); 
        this.zonesChart = new ChartComponent('zones-chart', 'Tempo in Zona (min)', '', 'bar');
    }

    async bootstrap() {
        if (this.isInitialized) return;
        
        await this.loadResources();
        this.cleanOriginalUI();
        this.renderStructure();
        
        // Inizializzazione Componenti Colonna 1
        this.mapComponent.init();
        this.elevationChart.init();
        this.speedChart.init();
        
        // Inizializzazione Componenti Colonna 2
        
        // 1. Nuovo Grafico Power & HR
        this.powerHrChart.initDualLine(
            "Power (W)", 
            "#e67e22", // Arancio (Uso codici hardcoded per coerenza con CSS)
            "Heart Rate (bpm)", 
            "#e74c3c", // Rosso
            false      // False = Linea continua (non tratteggiata) per HR
        );

        // 2. Grafico W' Balance & Efficiency
        this.advancedChart.initDualLine(
            "W' Balance (J)", 
            CONFIG.colors.wPrime, 
            "Efficiency (Pw/HR)", 
            CONFIG.colors.efficiency,
            true       // True = Linea tratteggiata per Efficiency
        );
        
        this.zonesChart.init(); // Si inizializza come bar chart (definito nel costruttore)
        
        // Sottoscrizione ai dati
        this.dataManager.subscribe(data => this.refresh(data));
        
        this.isInitialized = true;
        console.log("LiveTrackPro: UI Loaded & Ready.");

        // Recupero dati pregressi se esistenti (fix race condition)
        if (this.dataManager.hasReceivedLive) {
            this.dataManager.notify(); // Forza un refresh immediato
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
        // Nasconde tutti i figli diretti del body tranne gli script
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') child.style.display = 'none';
        });
    }

    renderStructure() {
        const container = document.createElement('div');
        container.id = 'livetrack-pro-dashboard';
        
        // Template HTML
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
                ${this.createMetricBox('cadence', 'Cadence', 'rpm', 'border-purple')}
                ${this.createMetricBox('hr', 'Heart Rate', 'bpm', 'border-red')}
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
                        <h3 style="margin:0 0 10px 0; color:#444;">Profilo Velocità</h3>
                        <div class="ltp-chart-container"><canvas id="speed-chart"></canvas></div>
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
                        <h3 style="margin:0 0 10px 0; color:#444;">Distribuzione Zone Cardiache</h3>
                        <div class="ltp-chart-container" style="height: 300px;">
                            <canvas id="zones-chart"></canvas>
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

    // Metodo principale di aggiornamento
    refresh({ live, course, zones }) {
        if (!live || live.length === 0) return;
        const lastPoint = live[live.length - 1];

        // 1. Aggiornamento Header Info
        const timeStr = lastPoint.dateTime.split('T')[1].replace('Z', '').split('.')[0]; // HH:MM:SS
        document.getElementById('status-log').innerHTML = 
            `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${live.length}`;

        // 2. Aggiornamento Metriche Testuali
        this.updateTextMetric('live-speed', lastPoint.speed ? (lastPoint.speed * 3.6).toFixed(1) : '-');
        this.updateTextMetric('live-power', lastPoint.powerWatts || '-');
        this.updateTextMetric('live-cadence', lastPoint.cadenceCyclesPerMin || '-');
        this.updateTextMetric('live-hr', lastPoint.heartRateBeatsPerMin || '-');

        // 3. Aggiornamento Colonna 1 (Standard)
        this.mapComponent.update(live, course);
        
        this.elevationChart.update(
            live, 
            course, 
            p => (p.altitude !== undefined ? p.altitude : p.elevation), // Estrattore Live
            p => p.altitude // Estrattore Course
        );

        this.speedChart.update(
            live, 
            null,
            p => p.speed ? (p.speed * 3.6) : 0, 
            null
        );

        // 4. Aggiornamento Colonna 2 (Advanced)
        
        // Aggiorniamo il nuovo grafico Power/HR passando gli estrattori specifici
        this.powerHrChart.update(
            live,
            null,
            p => p.powerWatts,           // Dataset 0 (Left Axis)
            p => p.heartRateBeatsPerMin  // Dataset 1 (Right Axis)
        );

        // Aggiorniamo il grafico W'/Efficiency passando gli estrattori specifici
        // (necessario ora che abbiamo reso la logica generica)
        this.advancedChart.update(
            live, 
            null,
            p => p.wPrimeBal, // Dataset 0
            p => p.efficiency // Dataset 1
        ); 
        
        // Passiamo l'array accumulatore delle zone (secondi)
        this.zonesChart.update(zones);
    }

    updateTextMetric(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }
}