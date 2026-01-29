(function() {
    console.log("LiveTrackPro: Inizializzazione...");

    const originalFetch = window.fetch;
    let uiCreated = false;
    
    // Stato locale per gestire i dati
    let allTrackPoints = [];
    const processedTimestamps = new Set();

    // Sovrascriviamo fetch
    window.fetch = function(...args) {
        // 1. Eseguiamo la fetch originale preservando il contesto
        const responsePromise = originalFetch.apply(this, args);

        // 2. Logica di intercettazione isolata in un blocco try/catch sincrono
        try {
            // Estrazione sicura dell'URL
            let url = '';
            if (typeof args[0] === 'string') {
                url = args[0];
            } else if (args[0] && typeof args[0] === 'object' && args[0].url) {
                url = args[0].url;
            }

            // Controllo se è l'URL dei track-points
            if (url && url.includes('track-points')) {
                responsePromise
                    .then(response => {
                        // Lavoriamo solo se la risposta è OK
                        if (response.ok) {
                            // Cloniamo la risposta
                            response.clone().json()
                                .then(data => processData(data))
                                .catch(err => console.warn("LiveTrackPro: JSON Warning", err));
                        }
                    })
                    .catch(() => {
                        // CATCH SILENZIOSO
                    });
            }
        } catch (e) {
            console.warn("LiveTrackPro: Errore interno nell'interceptor", e);
        }

        return responsePromise;
    };

    function processData(data) {
        // Creiamo l'interfaccia alla prima ricezione dati utile
        if (!uiCreated) {
            initDashboard();
            uiCreated = true;
        }

        if (data.trackPoints && data.trackPoints.length > 0) {
            // 1. Filtriamo solo i punti che non abbiamo ancora processato
            const newPoints = data.trackPoints.filter(point => {
                if (!point.dateTime) return false;
                if (processedTimestamps.has(point.dateTime)) {
                    return false; // Punto già presente
                }
                return true;
            });

            if (newPoints.length > 0) {
                console.log(`LiveTrackPro: Trovati ${newPoints.length} nuovi punti.`);
                
                // 2. Aggiungiamo i nuovi punti al nostro storico e al set di controllo
                newPoints.forEach(p => {
                    processedTimestamps.add(p.dateTime);
                    allTrackPoints.push(p);
                });

                // 3. Ordiniamo tutto l'array in ordine Cronologico Inverso (dal più recente al più vecchio)
                allTrackPoints.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

                // 4. Aggiorniamo la tabella con l'array ordinato e pulito
                renderTable();
            }
        }
    }

    function initDashboard() {
        const dashboardId = 'livetrack-pro-dashboard';
        if (document.getElementById(dashboardId)) return;

        // --- NASCONDIAMO L'INTERFACCIA ORIGINALE ---
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') {
                child.style.display = 'none';
            }
        });

        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.backgroundColor = "#f4f4f4";
        document.body.style.overflow = "auto";

        const container = document.createElement('div');
        container.id = dashboardId;
        // Stili inline per brevità (come nel tuo originale)
        container.style.fontFamily = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        container.style.padding = "20px";
        container.style.maxWidth = "1200px";
        container.style.margin = "0 auto";
        container.style.backgroundColor = "white";
        container.style.minHeight = "100vh";
        container.style.boxSizing = "border-box";

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #0056b3; padding-bottom:15px; margin-bottom:25px;">
                <div>
                    <h1 style="margin: 0; color: #333; font-size: 28px;">Live Track Pro</h1>
                    <span style="font-size: 12px; color: #777;">GARMIN DATA INTERCEPTOR - TRAKA 200 EDITION</span>
                </div>
                <div id="status-log" style="text-align:right; color: #666; font-size: 13px;">
                    In attesa di dati...
                </div>
            </div>
            
            <div style="background: #fff; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow: hidden;">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap;">
                        <thead style="background: #f8f9fa; color: #444; border-bottom: 2px solid #eee;">
                            <tr style="text-align: left;">
                                <th style="padding: 15px; font-weight: 600;">Time</th>
                                <th style="padding: 15px; font-weight: 600;">Lat / Lon</th>
                                <th style="padding: 15px; font-weight: 600;">Alt (m)</th>
                                <th style="padding: 15px; font-weight: 600;">Speed (km/h)</th>
                                <th style="padding: 15px; font-weight: 600;">Power (W)</th>
                                <th style="padding: 15px; font-weight: 600;">Cad (rpm)</th>
                                <th style="padding: 15px; font-weight: 600;">HR (bpm)</th>
                            </tr>
                        </thead>
                        <tbody id="garmin-data-body"></tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; text-align: center; color: #aaa; font-size: 11px;">
                LiveTrackPro Interface Active • Original Garmin App running in background
            </div>
        `;

        document.body.appendChild(container);
    }

    function renderTable() {
        const tbody = document.getElementById('garmin-data-body');
        const status = document.getElementById('status-log');
        
        if(!tbody) return;

        const lastPoint = allTrackPoints[0];
        const lastTime = lastPoint ? lastPoint.dateTime.split('T')[1].replace('Z','') : '--:--:--';
        status.innerHTML = `
            <strong>ULTIMO AGGIORNAMENTO:</strong> ${lastTime}<br>
            Punti Totali: ${allTrackPoints.length}
        `;

        tbody.innerHTML = '';

        allTrackPoints.forEach(point => {
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
                <td style="padding: 12px 15px; color: #0056b3; font-weight: 500;">${time}</td>
                <td style="padding: 12px 15px; color: #555;">${lat}, ${lon}</td>
                <td style="padding: 12px 15px; color: #555;">${alt}</td>
                <td style="padding: 12px 15px; font-weight:bold; color: #333;">${speedKmh}</td>
                <td style="padding: 12px 15px; color: ${watts !== '-' ? '#e67e22' : '#ccc'}; font-weight:500;">${watts}</td>
                <td style="padding: 12px 15px; color: #555;">${cad}</td>
                <td style="padding: 12px 15px; color: ${hr !== '-' ? '#e74c3c' : '#ccc'}; font-weight:500;">${hr}</td>
            `;

            tbody.appendChild(tr);
        });
    }

})();