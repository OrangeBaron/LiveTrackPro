export const DASHBOARD_TEMPLATE = `
<div class="ltp-card ltp-header">
    <div>
        <h1 class="ltp-title">
            {{ATHLETE_NAME}} <span class="ltp-subtitle">| {{SESSION_INFO}}</span>
        </h1>
    </div>
    <div id="status-log" class="ltp-status">In attesa di dati...</div>
</div>

<div class="ltp-grid">
    {{METRICS_GRID}}
</div>

<div class="ltp-summary-bar">
    {{SUMMARY_BAR}}
</div>

<div class="ltp-content-grid">
    
    <div class="ltp-column">
        <div class="ltp-card">
            <h3 style="margin:0 0 5px 0; color:#444;">Posizione & Percorso</h3>
            <p style="font-size:11px; color:#666; margin:0 0 15px 0;">
                <span style="color:#e67e22">●</span> Live Track &nbsp; 
                <span style="color:#95a5a6">●</span> Course (Pianificato)
            </p>
            <div id="map-container" class="ltp-vis-container"></div>
        </div>

        <div class="ltp-card">
            <h3 style="margin:0 0 5px 0; color:#444;">Profilo Altimetrico</h3>
            <p style="font-size:11px; color:#666; margin:0 0 15px 0;">
                <span style="color:#0056b3">●</span> Altitudine (m) &nbsp; 
                <span style="color:#bdc3c7">●</span> Course (Previsto)
            </p>
            <div class="ltp-chart-container"><canvas id="elevation-chart"></canvas></div>
        </div>

        <div class="ltp-card">
            <h3 style="margin:0 0 5px 0; color:#444;">Profilo Salita</h3>
            <p style="font-size:11px; color:#666; margin:0 0 15px 0;">
                <span style="color:#16a085">●</span> VAM (m/h) &nbsp; 
                <span style="color:#7f8c8d">●</span> Pendenza (%)
            </p>
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
                <span style="color:{{COLOR_WPRIME}}">●</span> W' Balance (J) &nbsp; 
                <span style="color:{{COLOR_EFFICIENCY}}">●</span> Efficienza (Watt/HR)
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