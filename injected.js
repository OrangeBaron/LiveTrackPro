(function() {
    console.log("LiveTrackPro: Core System initializing...");

    // ---------------------------------------------------------
    // 0. UTILS & HELPERS
    // ---------------------------------------------------------
    function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
        const R = 6371000; // Raggio Terra in metri
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // ---------------------------------------------------------
    // 1. CONFIGURAZIONE
    // ---------------------------------------------------------
    const CONFIG = {
        mapUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        libs: [
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            'https://cdn.jsdelivr.net/npm/chart.js'
        ],
        css: [
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        ],
        colors: {
            liveLine: '#e67e22',   // Arancione (Track Reale)
            courseLine: '#95a5a6', // Grigio (Track Prevista)
            marker: '#0056b3',
            chartPrimary: '#0056b3',
            chartSecondary: '#bdc3c7'
        }
    };

    // ---------------------------------------------------------
    // 2. DATA MANAGER
    // ---------------------------------------------------------
    class DataManager {
        constructor() {
            // Usiamo una Map per deduplicare automaticamente tramite timestamp
            this.rawLivePoints = new Map(); 
            this.livePoints = [];   // Array ordinato e processato
            this.coursePoints = []; // Array ordinato e processato
            
            // Stato Ricezione
            this.hasReceivedCourses = false;
            this.hasReceivedLive = false;
            
            this.listeners = [];
        }

        subscribe(callback) {
            this.listeners.push(callback);
        }

        notify() {
            if (this.hasReceivedCourses && this.hasReceivedLive) {
                this.listeners.forEach(cb => cb({
                    live: this.livePoints,
                    course: this.coursePoints
                }));
            }
        }

        // Gestione Traccia Pianificata (Course)
        ingestCourse(data) {
            const points = data.geoPoints || data.trackPoints || [];
            
            this.coursePoints = [];
            let distAccumulator = 0;

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const lat = p.latitude || p.lat;
                const lon = p.longitude || p.lon;
                // Normalizziamo subito l'elevazione
                const ele = p.elevation || p.altitude || 0;

                if (i > 0) {
                    const prev = this.coursePoints[i - 1];
                    distAccumulator += getDistanceFromLatLonInMeters(prev.lat, prev.lon, lat, lon);
                }

                this.coursePoints.push({
                    lat: lat,
                    lon: lon,
                    altitude: ele,
                    totalDistanceMeters: distAccumulator
                });
            }

            console.log(`LiveTrackPro: Course ingested. Points: ${this.coursePoints.length}`);
            this.hasReceivedCourses = true;
            this.notify();
        }

        // Gestione Traccia Reale (Live)
        ingestLive(data) {
            if (!data.trackPoints || data.trackPoints.length === 0) return;

            // 1. Merge dei dati grezzi nella Map (gestisce duplicati e aggiornamenti)
            data.trackPoints.forEach(point => {
                if (point.dateTime) {
                    this.rawLivePoints.set(point.dateTime, point);
                }
            });

            // 2. Ricostruiamo l'array ordinato cronologicamente
            // Questo corregge eventuali punti arrivati in ritardo (out-of-order)
            const sortedPoints = Array.from(this.rawLivePoints.values())
                .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

            // 3. Ricalcolo Distanze (fondamentale se abbiamo inserito punti nel mezzo)
            let distAccumulator = 0;
            
            // Iteriamo modificando l'oggetto (o arricchendolo)
            for (let i = 0; i < sortedPoints.length; i++) {
                const p = sortedPoints[i];
                
                if (i > 0) {
                    const prev = sortedPoints[i - 1];
                    
                    if (p.position && prev.position) {
                        const d = getDistanceFromLatLonInMeters(
                            prev.position.lat, prev.position.lon,
                            p.position.lat, p.position.lon
                        );
                        distAccumulator += d;
                    }
                }
                
                p.totalDistanceMeters = distAccumulator;
            }

            this.livePoints = sortedPoints;
            
            // Logica di prima attivazione
            if (!this.hasReceivedLive) {
                this.hasReceivedLive = true;
                console.log(`LiveTrackPro: First Live Data sync. Points: ${this.livePoints.length}`);
            }
            
            this.notify();
        }
    }

    // ---------------------------------------------------------
    // 3. COMPONENTI UI
    // ---------------------------------------------------------

    class MapComponent {
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

    class ChartComponent {
        constructor(canvasId, label, color, isDualSeries = false) {
            this.canvasId = canvasId;
            this.label = label;
            this.color = color;
            this.isDualSeries = isDualSeries;
            this.chart = null;
        }

        init() {
            if (typeof Chart === 'undefined') return;
            const ctx = document.getElementById(this.canvasId).getContext('2d');
            
            const datasets = [];

            // Serie "Prevista" (Background)
            if (this.isDualSeries) {
                datasets.push({
                    label: 'Previsto',
                    data: [],
                    borderColor: CONFIG.colors.chartSecondary,
                    backgroundColor: 'rgba(0,0,0,0)',
                    borderWidth: 2,
                    pointRadius: 0,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1,
                    order: 2
                });
            }

            // Serie "Live" (Foreground)
            datasets.push({
                label: this.label, 
                data: [],
                borderColor: this.color,
                backgroundColor: this.color + '33', // Opacity hack
                borderWidth: 2, 
                fill: true,
                pointRadius: 0, 
                tension: 0.2,
                order: 1
            });

            this.chart = new Chart(ctx, {
                type: 'line',
                data: { datasets: datasets },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: false,
                    plugins: { 
                        legend: { display: this.isDualSeries },
                        tooltip: { mode: 'index', intersect: false } 
                    },
                    scales: { 
                        x: { 
                            type: 'linear', 
                            grid: { display: false },
                            min: 0
                        }, 
                        y: { 
                            beginAtZero: false, 
                            grid: { color: '#f0f0f0' } 
                        } 
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }

        update(livePoints, coursePoints, dataExtractor, courseExtractor) {
            if (!this.chart) return;
            
            const toXY = (points, extractor) => {
                return points.map(p => ({
                    x: (p.totalDistanceMeters || 0) / 1000, // Metri -> KM
                    y: extractor(p)
                })).filter(pt => pt.y !== null && !isNaN(pt.y));
            };

            // Aggiorna Live (ultimo dataset)
            const liveIndex = this.chart.data.datasets.length - 1;
            this.chart.data.datasets[liveIndex].data = toXY(livePoints, dataExtractor);

            // Aggiorna Course (primo dataset, se esiste)
            if (this.isDualSeries && coursePoints && coursePoints.length > 0) {
                this.chart.data.datasets[0].data = toXY(coursePoints, courseExtractor);
            }

            this.chart.update();
        }
    }

    class DashboardUI {
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

            // FIX RACE CONDITION: Se i dati sono arrivati mentre caricavamo, aggiorna subito
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
            // Check di sicurezza: p.altitude o p.elevation per evitare grafici piatti
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

    // ---------------------------------------------------------
    // 4. MAIN & INTERCEPTOR
    // ---------------------------------------------------------
    
    const dataManager = new DataManager();
    const dashboard = new DashboardUI(dataManager);
    
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const responsePromise = originalFetch.apply(this, args);
        
        try {
            const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
            
            // Gestione Course (Percorso)
            if (url.includes('courses') || url.includes('course')) {
                responsePromise.then(res => {
                    if (res.ok) {
                        res.clone().json()
                            .then(data => {
                                dataManager.ingestCourse(data);
                                // Avvia dashboard se abbiamo tutto
                                if (dataManager.hasReceivedCourses && dataManager.hasReceivedLive && !dashboard.isInitialized) {
                                    dashboard.bootstrap();
                                }
                            })
                            .catch(e => console.warn("LiveTrackPro: Course parse error", e));
                    }
                }).catch(() => {});
            }

            // Gestione Live Track
            if (url.includes('common') || url.includes('trackPoints') || url.includes('track-points')) {
                responsePromise.then(res => {
                    if (res.ok) {
                        res.clone().json()
                            .then(data => {
                                dataManager.ingestLive(data);
                                // Avvia dashboard se abbiamo tutto
                                if (dataManager.hasReceivedCourses && dataManager.hasReceivedLive && !dashboard.isInitialized) {
                                    dashboard.bootstrap();
                                }
                            })
                            .catch(e => console.warn("LiveTrackPro: Live points parse error", e));
                    }
                }).catch(() => {});
            }

        } catch (e) {
            console.warn("LiveTrackPro: Interceptor error", e);
        }
        
        return responsePromise;
    };

})();