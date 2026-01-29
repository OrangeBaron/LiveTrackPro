(function() {
    console.log("LiveTrackPro: Inizializzazione...");

    // --- CONFIGURAZIONE E STATO ---
    const originalFetch = window.fetch;
    let uiCreated = false;
    let librariesLoaded = false;
    
    // Stato locale dati
    let allTrackPoints = [];
    const processedTimestamps = new Set();

    // Istanze grafiche
    let mapInstance = null;
    let polyline = null;
    let currentMarker = null;
    let chartInstance = null;

    // --- INTERCETTAZIONE FETCH ---
    window.fetch = function(...args) {
        const responsePromise = originalFetch.apply(this, args);

        try {
            let url = '';
            if (typeof args[0] === 'string') {
                url = args[0];
            } else if (args[0] && typeof args[0] === 'object' && args[0].url) {
                url = args[0].url;
            }

            if (url && url.includes('track-points')) {
                responsePromise
                    .then(response => {
                        if (response.ok) {
                            response.clone().json()
                                .then(data => processData(data))
                                .catch(err => console.warn("LiveTrackPro: JSON Warning", err));
                        }
                    })
                    .catch(() => {});
            }
        } catch (e) {
            console.warn("LiveTrackPro: Errore interno nell'interceptor", e);
        }

        return responsePromise;
    };

    // --- LOGICA DATI ---
    function processData(data) {
        if (!uiCreated) {
            loadExternalLibraries(() => {
                initDashboard();
                uiCreated = true;
                handleNewPoints(data);
            });
            return;
        }
        
        handleNewPoints(data);
    }

    function handleNewPoints(data) {
        if (data.trackPoints && data.trackPoints.length > 0) {
            const newPoints = data.trackPoints.filter(point => {
                if (!point.dateTime) return false;
                if (processedTimestamps.has(point.dateTime)) return false;
                return true;
            });

            if (newPoints.length > 0) {
                console.log(`LiveTrackPro: Trovati ${newPoints.length} nuovi punti.`);
                
                newPoints.forEach(p => {
                    processedTimestamps.add(p.dateTime);
                    allTrackPoints.push(p);
                });

                // Ordine Cronologico per i grafici
                allTrackPoints.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

                updateVisuals();
            }
        }
    }

    // --- CARICAMENTO LIBRERIE ESTERNE (CDN) ---
    function loadExternalLibraries(callback) {
        console.log("LiveTrackPro: Caricamento librerie grafiche...");
        const head = document.head;

        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        head.appendChild(leafletCSS);

        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = reject;
                head.appendChild(s);
            });
        };

        Promise.all([
            loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'),
            loadScript('https://cdn.jsdelivr.net/npm/chart.js')
        ]).then(() => {
            console.log("LiveTrackPro: Librerie caricate.");
            librariesLoaded = true;
            if(callback) callback();
        }).catch(err => console.error("LiveTrackPro: Errore caricamento librerie", err));
    }

    // --- GESTIONE UI ---
    function initDashboard() {
        const dashboardId = 'livetrack-pro-dashboard';
        if (document.getElementById(dashboardId)) return;

        // Nascondi UI originale
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') child.style.display = 'none';
        });

        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.backgroundColor = "#f0f2f5";
        document.body.style.overflow = "auto";

        const container = document.createElement('div');
        container.id = dashboardId;
        container.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        container.style.padding = "20px";
        container.style.width = "95%";
        container.style.maxWidth = "none";
        container.style.margin = "0 auto";
        container.style.boxSizing = "border-box";

        container.innerHTML = `
            <div style="background: white; padding: 15px 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h1 style="margin: 0; color: #1a1a1a; font-size: 26px; font-weight: 700;">Live Track Pro <span style="font-weight:300; color: #666; font-size: 18px;">| Traka 200 Dashboard</span></h1>
                </div>
                <div id="status-log" style="text-align:right; color: #666; font-size: 13px;">In attesa di dati...</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px;">
                
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 5px solid #0056b3;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5px;">Speed</div>
                    <div style="display:flex; align-items:baseline;">
                        <span id="live-speed" style="font-size: 32px; font-weight: 700; color: #1a1a1a;">--</span>
                        <span style="font-size: 14px; color: #666; margin-left: 5px;">km/h</span>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 5px solid #e67e22;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5px;">Power</div>
                    <div style="display:flex; align-items:baseline;">
                        <span id="live-power" style="font-size: 32px; font-weight: 700; color: #1a1a1a;">--</span>
                        <span style="font-size: 14px; color: #666; margin-left: 5px;">W</span>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 5px solid #9b59b6;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5px;">Cadence</div>
                    <div style="display:flex; align-items:baseline;">
                        <span id="live-cadence" style="font-size: 32px; font-weight: 700; color: #1a1a1a;">--</span>
                        <span style="font-size: 14px; color: #666; margin-left: 5px;">rpm</span>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 5px solid #e74c3c;">
                    <div style="font-size: 12px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5px;">Heart Rate</div>
                    <div style="display:flex; align-items:baseline;">
                        <span id="live-hr" style="font-size: 32px; font-weight: 700; color: #1a1a1a;">--</span>
                        <span style="font-size: 14px; color: #666; margin-left: 5px;">bpm</span>
                    </div>
                </div>
            </div>

            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #444; font-size: 16px;">Percorso Live</h3>
                <div id="map-container" style="width: 100%; height: 500px; border-radius: 8px; border: 1px solid #eee; z-index: 0; margin-bottom: 25px;"></div>
                
                <h3 style="margin: 0 0 10px 0; color: #444; font-size: 16px;">Profilo Altimetrico</h3>
                <div style="width: 100%; height: 250px; border-radius: 8px; border: 1px solid #eee; padding: 10px; position: relative;">
                    <canvas id="elevation-chart"></canvas>
                </div>
            </div>
            
            <div style="background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; padding: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #444; font-size: 16px;">Log Dati Telemetrici</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap;">
                        <thead style="background: #f8f9fa; color: #555; border-bottom: 2px solid #eee;">
                            <tr style="text-align: left;">
                                <th style="padding: 12px 15px;">Time</th>
                                <th style="padding: 12px 15px;">Lat / Lon</th>
                                <th style="padding: 12px 15px;">Alt (m)</th>
                                <th style="padding: 12px 15px;">Speed (km/h)</th>
                                <th style="padding: 12px 15px;">Power (W)</th>
                                <th style="padding: 12px 15px;">Cad (rpm)</th>
                                <th style="padding: 12px 15px;">HR (bpm)</th>
                            </tr>
                        </thead>
                        <tbody id="garmin-data-body"></tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 20px; text-align: center; color: #aaa; font-size: 11px;">
                LiveTrackPro Interface Active • Original Garmin App running in background
            </div>
        `;

        document.body.appendChild(container);

        initMap();
        initChart();
    }

    function initMap() {
        if (!L) return;
        mapInstance = L.map('map-container', { zoomControl: false }).setView([41.98, 2.82], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        polyline = L.polyline([], {color: '#e67e22', weight: 5}).addTo(mapInstance);
    }

    function initChart() {
        if (typeof Chart === 'undefined') return;
        
        const ctx = document.getElementById('elevation-chart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 86, 179, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 86, 179, 0.0)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Altitudine (m)',
                    data: [],
                    borderColor: '#0056b3',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 0,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: { display: false },
                    y: { 
                        beginAtZero: false,
                        grid: { color: '#f0f0f0' }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    function updateVisuals() {
        if (allTrackPoints.length === 0) return;

        // 0. UPDATE METRICHE LIVE
        updateRealTimeMetrics();

        // 1. UPDATE MAPPA
        if (mapInstance && polyline) {
            const latLngs = allTrackPoints
                .filter(p => p.position && p.position.lat && p.position.lon)
                .map(p => [p.position.lat, p.position.lon]);

            if (latLngs.length > 0) {
                polyline.setLatLngs(latLngs);
                const lastPos = latLngs[latLngs.length - 1];
                
                if (!currentMarker) {
                    currentMarker = L.circleMarker(lastPos, {
                        radius: 8,
                        fillColor: "#0056b3",
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(mapInstance);
                } else {
                    currentMarker.setLatLng(lastPos);
                }
                
                if (latLngs.length < 5) {
                     mapInstance.setView(lastPos, 14);
                } else {
                    mapInstance.panTo(lastPos);
                }
            }
        }

        // 2. UPDATE GRAFICO
        if (chartInstance) {
            const labels = allTrackPoints.map(p => p.dateTime.split('T')[1].substring(0,5));
            const altData = allTrackPoints.map(p => p.altitude || null);
            
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = altData;
            chartInstance.update();
        }

        // 3. UPDATE TABELLA
        renderTable();
    }

    function updateRealTimeMetrics() {
        // Prende l'ultimo punto disponibile
        const lastPoint = allTrackPoints[allTrackPoints.length - 1];
        if (!lastPoint) return;

        const elSpeed = document.getElementById('live-speed');
        const elPower = document.getElementById('live-power');
        const elCadence = document.getElementById('live-cadence');
        const elHr = document.getElementById('live-hr');

        if (elSpeed) elSpeed.innerText = lastPoint.speed ? (lastPoint.speed * 3.6).toFixed(1) : '-';
        if (elPower) elPower.innerText = lastPoint.powerWatts || '-';
        if (elCadence) elCadence.innerText = lastPoint.cadenceCyclesPerMin || '-';
        if (elHr) elHr.innerText = lastPoint.heartRateBeatsPerMin || '-';
    }

    function renderTable() {
        const tbody = document.getElementById('garmin-data-body');
        const status = document.getElementById('status-log');
        if(!tbody) return;

        const pointsForTable = [...allTrackPoints].reverse(); 
        const lastPoint = pointsForTable[0];

        const lastTime = lastPoint ? lastPoint.dateTime.split('T')[1].replace('Z','') : '--:--:--';
        status.innerHTML = `
            <strong>ULTIMO AGGIORNAMENTO:</strong> ${lastTime} &bull; 
            <strong>PUNTI:</strong> ${allTrackPoints.length}
        `;

        tbody.innerHTML = '';
        
        const pointsToShow = pointsForTable.slice(0, 100);

        pointsToShow.forEach(point => {
            const speedKmh = point.speed ? (point.speed * 3.6).toFixed(1) : '-';
            const time = point.dateTime ? point.dateTime.split('T')[1].replace('Z','') : '-';
            const hr = point.heartRateBeatsPerMin || '-';
            const watts = point.powerWatts || '-';
            const cad = point.cadenceCyclesPerMin || '-';
            const lat = point.position ? point.position.lat.toFixed(5) : '-';
            const lon = point.position ? point.position.lon.toFixed(5) : '-';
            const alt = point.altitude ? point.altitude.toFixed(0) : '-';

            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #f1f1f1";
            
            tr.innerHTML = `
                <td style="padding: 10px 15px; color: #0056b3; font-weight: 500;">${time}</td>
                <td style="padding: 10px 15px; color: #555;">${lat}, ${lon}</td>
                <td style="padding: 10px 15px; color: #555;">${alt}</td>
                <td style="padding: 10px 15px; font-weight:bold; color: #333;">${speedKmh}</td>
                <td style="padding: 10px 15px; color: ${watts !== '-' ? '#e67e22' : '#ccc'}; font-weight:500;">${watts}</td>
                <td style="padding: 10px 15px; color: #555;">${cad}</td>
                <td style="padding: 10px 15px; color: ${hr !== '-' ? '#e74c3c' : '#ccc'}; font-weight:500;">${hr}</td>
            `;
            tbody.appendChild(tr);
        });
    }

})();