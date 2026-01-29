(function() {
    console.log("Inizializzazione intercettazione...");

    const originalFetch = window.fetch;
    let uiCreated = false;

    // Sovrascriviamo fetch
    window.fetch = async function(...args) {
        // Lasciamo che la richiesta originale parta
        const responsePromise = originalFetch(...args);

        // Controllo se l'URL è quello dei track-points
        if (args[0] && args[0].toString().includes('track-points')) {
            // Dobbiamo aspettare che la promise si risolva per clonarla
            responsePromise.then(response => {
                // Importante: clona solo se la risposta è OK (200)
                if (response.ok) {
                    const clone = response.clone();
                    clone.json().then(data => {
                        processData(data);
                    }).catch(err => console.error("Errore parsing JSON", err));
                }
            });
        }

        return responsePromise;
    };

    function processData(data) {
        // Creiamo l'interfaccia solo se arrivano dati validi
        if (!uiCreated) {
            createOverlayUI();
            uiCreated = true;
        }

        if (data.trackPoints && data.trackPoints.length > 0) {
            updateTable(data.trackPoints);
        }
    }

    function createOverlayUI() {
        // Invece di cancellare il body, creiamo un DIV che copre tutto lo schermo
        
        const overlayId = 'garmin-raw-overlay';
        if (document.getElementById(overlayId)) return;

        const overlay = document.createElement('div');
        overlay.id = overlayId;
        
        // Stile per coprire interamente la pagina sottostante
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "white"; 
        overlay.style.zIndex = "9999";
        overlay.style.overflowY = "auto";
        overlay.style.padding = "20px";
        overlay.style.fontFamily = "Consolas, monospace";
        overlay.style.boxSizing = "border-box";

        overlay.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #333; padding-bottom:10px; margin-bottom:20px;">
                    <h1 style="margin: 0; color: #333; font-size: 24px;">Garmin Raw Data</h1>
                    <div id="status-log" style="color: #666; font-size: 14px;">In attesa...</div>
                </div>
                
                <div style="overflow-x: auto; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 800px;">
                        <thead style="position: sticky; top: 0; background: #333; color: white; z-index: 10;">
                            <tr style="text-align: left;">
                                <th style="padding: 10px;">Time</th>
                                <th style="padding: 10px;">Lat</th>
                                <th style="padding: 10px;">Lon</th>
                                <th style="padding: 10px;">Alt (m)</th>
                                <th style="padding: 10px;">Spd (km/h)</th>
                                <th style="padding: 10px;">Watts</th>
                                <th style="padding: 10px;">Cad</th>
                                <th style="padding: 10px;">HR</th>
                            </tr>
                        </thead>
                        <tbody id="garmin-data-body"></tbody>
                    </table>
                </div>
                <div style="margin-top: 20px; font-size: 10px; color: #999; text-align: center;">
                    Original Interface running in background
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Opzionale: Nascondiamo la scrollbar del body originale per evitare doppi scroll
        document.body.style.overflow = "hidden";
    }

    function updateTable(points) {
        const tbody = document.getElementById('garmin-data-body');
        const status = document.getElementById('status-log');
        
        if(!tbody) return;

        status.innerText = `LAST UPDATE: ${new Date().toLocaleTimeString()} | Punti nel pacchetto: ${points.length}`;

        points.forEach(point => {
            const speedKmh = point.speed ? (point.speed * 3.6).toFixed(1) : '0.0';
            const time = point.dateTime ? point.dateTime.split('T')[1].replace('Z','') : '-';
            const hr = point.heartRateBeatsPerMin || '-';
            const watts = point.powerWatts || '-';
            const cad = point.cadenceCyclesPerMin || '-';
            const lat = point.position ? point.position.lat.toFixed(5) : '-';
            const lon = point.position ? point.position.lon.toFixed(5) : '-';
            const alt = point.altitude ? point.altitude.toFixed(1) : '-';

            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            tr.style.backgroundColor = "white";
            
            // Alternanza colori righe per leggibilità
            tr.onmouseover = () => tr.style.backgroundColor = "#f9f9f9";
            tr.onmouseout = () => tr.style.backgroundColor = "white";

            tr.innerHTML = `
                <td style="padding: 8px; font-weight: bold; color: #0056b3;">${time}</td>
                <td style="padding: 8px;">${lat}</td>
                <td style="padding: 8px;">${lon}</td>
                <td style="padding: 8px;">${alt}</td>
                <td style="padding: 8px;">${speedKmh}</td>
                <td style="padding: 8px;">${watts}</td>
                <td style="padding: 8px;">${cad}</td>
                <td style="padding: 8px;">${hr}</td>
            `;

            // Inseriamo sempre in cima
            tbody.insertBefore(tr, tbody.firstChild);
        });
    }

})();