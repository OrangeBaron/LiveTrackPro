(function() {
    console.log("LiveTrackPro: Core System initializing...");

    // 1. CONFIGURAZIONE E STILI
    const CONFIG = {
        mapUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        libs: [
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            'https://cdn.jsdelivr.net/npm/chart.js'
        ],
        css: [
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        ]
    };

    const DASHBOARD_STYLES = `
        body { margin: 0; padding: 0; background-color: #f0f2f5; overflow: auto; }
        #livetrack-pro-dashboard {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 20px; width: 95%; margin: 0 auto; box-sizing: border-box;
        }
        .ltp-card {
            background: white; padding: 20px; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px;
        }
        .ltp-header {
            display: flex; justify-content: space-between; align-items: center; padding: 15px 25px;
        }
        .ltp-title { margin: 0; color: #1a1a1a; font-size: 26px; font-weight: 700; }
        .ltp-subtitle { font-weight: 300; color: #666; font-size: 18px; }
        .ltp-status { text-align: right; color: #666; font-size: 13px; }
        
        /* Grid Metriche */
        .ltp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
        .ltp-metric-box {
            background: white; padding: 20px; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 5px solid #ccc;
        }
        .ltp-metric-label { font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600; margin-bottom: 5px; }
        .ltp-metric-value-group { display: flex; align-items: baseline; }
        .ltp-value { font-size: 32px; font-weight: 700; color: #1a1a1a; }
        .ltp-unit { font-size: 14px; color: #666; margin-left: 5px; }

        /* Colori Metriche */
        .border-blue { border-color: #0056b3; }
        .border-orange { border-color: #e67e22; }
        .border-purple { border-color: #9b59b6; }
        .border-red { border-color: #e74c3c; }
        
        /* Container Visualizzazioni */
        .ltp-vis-container { height: 500px; width: 100%; border-radius: 8px; border: 1px solid #eee; margin-bottom: 25px; z-index: 0; }
        .ltp-chart-container { height: 250px; width: 100%; border-radius: 8px; border: 1px solid #eee; padding: 10px; position: relative; }
        
        .ltp-footer { text-align: center; color: #aaa; font-size: 11px; margin-top: 20px; }
    `;

    // 2. DATA MANAGER
    class DataManager {
        constructor() {
            this.trackPoints = [];
            this.processedTimestamps = new Set();
            this.listeners = [];
        }

        subscribe(callback) {
            this.listeners.push(callback);
        }

        notify() {
            // Ordine cronologico
            this.trackPoints.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
            this.listeners.forEach(cb => cb(this.trackPoints));
        }

        ingest(data) {
            if (!data.trackPoints || data.trackPoints.length === 0) return;

            let hasNewData = false;
            data.trackPoints.forEach(point => {
                if (point.dateTime && !this.processedTimestamps.has(point.dateTime)) {
                    this.processedTimestamps.add(point.dateTime);
                    this.trackPoints.push(point);
                    hasNewData = true;
                }
            });

            if (hasNewData) {
                console.log(`LiveTrackPro: Ingested ${data.trackPoints.length} points.`);
                this.notify();
            }
        }
    }

    // 3. COMPONENTI UI

    class MapComponent {
        constructor(containerId) {
            this.containerId = containerId;
            this.map = null;
            this.polyline = null;
            this.marker = null;
        }

        init() {
            if (!window.L) return;
            this.map = L.map(this.containerId, { zoomControl: false }).setView([0, 0], 13);
            L.tileLayer(CONFIG.mapUrl, { attribution: '© OpenStreetMap' }).addTo(this.map);
            this.polyline = L.polyline([], { color: '#e67e22', weight: 5 }).addTo(this.map);
        }

        update(points) {
            if (!this.map || !points.length) return;

            const latLngs = points
                .filter(p => p.position && p.position.lat && p.position.lon)
                .map(p => [p.position.lat, p.position.lon]);

            if (latLngs.length > 0) {
                this.polyline.setLatLngs(latLngs);
                const lastPos = latLngs[latLngs.length - 1];

                if (!this.marker) {
                    this.marker = L.circleMarker(lastPos, {
                        radius: 8, fillColor: "#0056b3", color: "#fff", 
                        weight: 2, opacity: 1, fillOpacity: 0.8
                    }).addTo(this.map);
                } else {
                    this.marker.setLatLng(lastPos);
                }

                // Auto-follow
                latLngs.length < 5 ? this.map.setView(lastPos, 14) : this.map.panTo(lastPos);
            }
        }
    }

    class ChartComponent {
        constructor(canvasId, label, color) {
            this.canvasId = canvasId;
            this.label = label;
            this.color = color;
            this.chart = null;
        }

        init() {
            if (typeof Chart === 'undefined') return;
            const ctx = document.getElementById(this.canvasId).getContext('2d');
            
            // Helper per convertire HEX in RGB per l'opacità
            const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 86, 179';
            };
            const rgb = hexToRgb(this.color);

            // Gradiente
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, `rgba(${rgb}, 0.4)`);
            gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);

            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: this.label, 
                        data: [], 
                        borderColor: this.color,
                        backgroundColor: gradient, 
                        borderWidth: 2, 
                        fill: true,
                        pointRadius: 0, 
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: false,
                    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                    scales: { x: { display: false }, y: { beginAtZero: false, grid: { color: '#f0f0f0' } } },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }

        update(points, dataExtractor) {
            if (!this.chart || !points.length) return;
            const labels = points.map(p => p.dateTime.split('T')[1].substring(0, 5));
            const data = points.map(dataExtractor);

            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = data;
            this.chart.update();
        }
    }

    class DashboardUI {
        constructor(dataManager) {
            this.dataManager = dataManager;
            this.isInitialized = false;
            this.mapComponent = new MapComponent('map-container');
            // Configurazione grafici: ID Canvas, Etichetta, Colore HEX
            this.elevationChart = new ChartComponent('elevation-chart', 'Altitudine (m)', '#0056b3');
            this.speedChart = new ChartComponent('speed-chart', 'Velocità (km/h)', '#0056b3');
        }

        async bootstrap() {
            if (this.isInitialized) return;
            
            // 1. Carica risorse esterne
            await this.loadResources();
            
            // 2. Prepara il DOM
            this.cleanOriginalUI();
            this.injectStyles();
            this.renderStructure();
            
            // 3. Inizializza componenti
            this.mapComponent.init();
            this.elevationChart.init();
            this.speedChart.init();
            
            // 4. Collega Dati -> UI
            this.dataManager.subscribe(points => this.refresh(points));
            
            this.isInitialized = true;
            console.log("LiveTrackPro: UI Loaded.");
        }

        loadResources() {
            const head = document.head;
            
            // Carica CSS Leaflet
            CONFIG.css.forEach(href => {
                const link = document.createElement('link');
                link.rel = 'stylesheet'; link.href = href;
                head.appendChild(link);
            });

            // Carica JS Scripts
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

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = DASHBOARD_STYLES;
            document.head.appendChild(style);
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

        refresh(points) {
            const lastPoint = points[points.length - 1];
            if (!lastPoint) return;

            // Aggiorna Status Header
            const timeStr = lastPoint.dateTime.split('T')[1].replace('Z', '');
            document.getElementById('status-log').innerHTML = 
                `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${points.length}`;

            // 1. Metriche Testuali
            this.updateTextMetric('live-speed', lastPoint.speed ? (lastPoint.speed * 3.6).toFixed(1) : '-');
            this.updateTextMetric('live-power', lastPoint.powerWatts || '-');
            this.updateTextMetric('live-cadence', lastPoint.cadenceCyclesPerMin || '-');
            this.updateTextMetric('live-hr', lastPoint.heartRateBeatsPerMin || '-');

            // 2. Visualizzazioni
            this.mapComponent.update(points);
            
            // Aggiorna Grafici
            // Altimetria
            this.elevationChart.update(points, p => p.altitude || null);
            // Velocità (conversione m/s -> km/h)
            this.speedChart.update(points, p => p.speed ? (p.speed * 3.6) : 0);
        }

        updateTextMetric(id, value) {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        }
    }

    // 4. MAIN & INTERCEPTOR
    
    const dataManager = new DataManager();
    const dashboard = new DashboardUI(dataManager);
    
    // Interceptor di rete
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const responsePromise = originalFetch.apply(this, args);
        
        try {
            const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
            
            if (url.includes('track-points')) {
                // Trovati dati interessanti
                if (!dashboard.isInitialized) {
                    dashboard.bootstrap();
                }

                responsePromise.then(res => {
                    if (res.ok) {
                        res.clone().json()
                            .then(data => dataManager.ingest(data))
                            .catch(e => console.warn("LiveTrackPro: JSON Parse error", e));
                    }
                }).catch(() => {});
            }
        } catch (e) {
            console.warn("LiveTrackPro: Interceptor error", e);
        }
        
        return responsePromise;
    };

})();