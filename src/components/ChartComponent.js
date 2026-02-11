export class ChartComponent {
    /**
     * @param {string} canvasId - ID dell'elemento canvas nel DOM
     * @param {string} type - 'line' oppure 'bar'
     * @param {Array} config - Array di oggetti configurazione dataset
     * Esempio config: [{ label: 'Power', color: '#ff0000', yAxisID: 'y', fill: true }]
     */
    constructor(canvasId, type = 'line', config = []) {
        this.canvasId = canvasId;
        this.type = type; 
        this.datasetsConfig = config;
        this.chart = null;
    }

    init() {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        
        const isBar = (this.type === 'bar');

        // Configurazione comune di base per tutti i grafici
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } } }
        };

        // Costruiamo i dataset per Chart.js mappando la nostra configurazione
        const datasets = this.datasetsConfig.map(cfg => {
            // Per i grafici a linea usiamo il colore con trasparenza per il background (fill)
            // Per i grafici a barre usiamo il colore pieno
            const bgColor = isBar ? cfg.color : (cfg.color + '33');

            return {
                label: cfg.label || '',
                data: [], // Inizialmente vuoto
                borderColor: cfg.color,
                backgroundColor: bgColor,
                borderDash: cfg.dashed ? [5, 5] : [],
                yAxisID: cfg.yAxisID || 'y',
                fill: cfg.fill !== undefined ? cfg.fill : false,
                order: cfg.order || 0,
                
                // Stile specifico per tipo
                borderRadius: isBar ? 4 : 0,
                borderWidth: isBar ? 0 : 2,
                pointRadius: 0,
                tension: 0.2
            };
        });

        // Controlliamo se qualcuno dei dataset richiede l'asse destro (y1)
        const enableY1 = datasets.some(d => d.yAxisID === 'y1');

        this.chart = new Chart(ctx, {
            type: this.type,
            data: { 
                labels: [], // Verranno popolate dinamicamente per i bar chart
                datasets: datasets 
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: { 
                        display: !isBar, // Nascondiamo asse Y per le barre "sparkline"
                        position: 'left', 
                        grid: { color: '#f0f0f0' },
                        beginAtZero: isBar 
                    },
                    y1: { 
                        display: enableY1, 
                        position: 'right', 
                        grid: { drawOnChartArea: false } 
                    },
                    x: {
                        ...commonOptions.scales.x,
                        // Se è una linea, l'asse X deve essere LINEARE (numerico: km)
                        // Se sono barre (Zone), deve essere CATEGORY (default)
                        type: isBar ? 'category' : 'linear',
                        min: 0,
                        
                        // Per i bar chart mostriamo le label (ticks), per le linee no (di solito)
                        ticks: { display: isBar, font: { size: 10 } }
                    }
                }
            }
        });
    }

    /**
     * Aggiorna i dati del grafico.
     * @param {Array} sources - Array di array di dati sorgente (es. [livePoints, coursePoints])
     * @param {Array} extractors - Array di funzioni (per linee) o array di labels (per barre)
     */
    update(sources, extractors) {
        if (!this.chart) return;

        // --- GESTIONE BAR CHART ---
        // Per i grafici a barre, 'sources' è direttamente l'array dei valori (es. [10, 20, 5])
        // e 'extractors' (opzionale) sono le labels dell'asse X.
        if (this.type === 'bar') {
            const values = Array.isArray(sources) ? sources : [];
            this.chart.data.datasets[0].data = values;
            
            if (extractors && Array.isArray(extractors)) {
                this.chart.data.labels = extractors;
            }
            
            this.chart.update();
            return;
        }

        // --- GESTIONE LINE CHART ---
        // Iteriamo sui dataset configurati e aggiorniamo ognuno con la sua sorgente ed estrattore
        this.chart.data.datasets.forEach((dataset, i) => {
            const source = sources[i] || [];
            const extractor = extractors ? extractors[i] : null;

            if (source.length > 0 && extractor) {
                // Mappiamo i dati nel formato {x, y} richiesto da Chart.js per le linee temporali/distanza
                dataset.data = source.map(p => ({
                    x: (p.distanceKm !== undefined) ? p.distanceKm : (p.totalDistanceMeters || 0) / 1000,
                    y: extractor(p)
                })).filter(pt => pt.y !== null && isFinite(pt.y)); // Filtriamo null o infiniti
            }
        });
        
        // Update 'none' per massimizzare le performance (no animazioni)
        this.chart.update('none');
    }
}