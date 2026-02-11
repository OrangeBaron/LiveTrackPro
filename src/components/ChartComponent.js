import { CONFIG } from '../config.js';

export class ChartComponent {
    constructor(canvasId, label, color, type = 'line', options = {}) {
        this.canvasId = canvasId;
        this.label = label;
        this.color = color;
        this.type = type;
        this.chart = null;
        this.extraOptions = options; 
    }

    init() {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        
        const commonConfig = {
            responsive: true, 
            maintainAspectRatio: false, 
            animation: false,
            interaction: { mode: 'index', intersect: false }, 
            scales: { x: { grid: { display: false } } }
        };

        if (this.type === 'bar') {
            this._initBarChart(ctx, commonConfig);
        } else {
            this._initLineChart(ctx, commonConfig);
        }
    }

    _initBarChart(ctx, config) {
        // Recuperiamo le opzioni con fallback
        const labels = this.extraOptions.labels || ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
        const colors = this.extraOptions.barColors || ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'];

        // Creiamo un array di zeri lungo quanto le labels
        const initialData = new Array(labels.length).fill(0);

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: labels,
                datasets: [{
                    label: this.label,
                    data: initialData,
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: { 
                ...config, 
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        display: false,
                        grid: { display: false } 
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    }

    _initLineChart(ctx, config) {
        let datasets = [];
        let enableY1 = false;

        // 1. MODALITÀ AVANZATA: datasetsConfig esplicito (es. Elevation Chart a 3 vie)
        if (this.extraOptions.datasetsConfig && Array.isArray(this.extraOptions.datasetsConfig)) {
            datasets = this.extraOptions.datasetsConfig.map(ds => {
                // Mappatura proprietà custom -> proprietà Chart.js
                return {
                    label: ds.label,
                    data: [],
                    borderColor: ds.color || ds.borderColor,
                    backgroundColor: (ds.color || ds.borderColor) + '11', // Trasparenza
                    borderDash: ds.dashed ? [5, 5] : [],
                    yAxisID: ds.yAxisID || 'y',
                    borderWidth: 2, 
                    pointRadius: 0, 
                    tension: 0.2, 
                    fill: ds.fill !== undefined ? ds.fill : false,
                    order: ds.order || 0
                };
            });

            // Se almeno un dataset usa 'y1', abilitiamo l'asse secondario
            if (datasets.some(d => d.yAxisID === 'y1')) {
                enableY1 = true;
            }

        } else {
            // 2. MODALITÀ LEGACY: Costruzione standard (es. Power/HR Chart)
            
            // Dataset Principale
            datasets.push({
                label: this.label,
                data: [],
                borderColor: this.color,
                backgroundColor: this.color + '33',
                yAxisID: 'y',
                borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true
            });

            // Dataset Secondario (Opzionale via label2)
            if (this.extraOptions.label2) {
                const { label2, color2, dashed2, useSecondaryAxis } = this.extraOptions;
                enableY1 = useSecondaryAxis !== undefined ? useSecondaryAxis : (this.type === 'dual-line');

                datasets.push({
                    label: label2,
                    data: [],
                    borderColor: color2 || '#ccc',
                    backgroundColor: (color2 || '#ccc') + '11',
                    borderDash: dashed2 ? [5, 5] : [],
                    yAxisID: enableY1 ? 'y1' : 'y', 
                    borderWidth: 2, pointRadius: 0, tension: 0.2, 
                    fill: !dashed2 
                });
            }
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [],
                datasets: datasets
            },
            options: {
                ...config,
                plugins: { legend: { display: false } },
                scales: {
                    x: { type: 'linear', min: 0, grid: { display: false } },
                    y: { 
                        type: 'linear', display: true, position: 'left',
                        grid: { color: '#f0f0f0' },
                        beginAtZero: false
                    },
                    y1: { 
                        type: 'linear', display: enableY1, position: 'right',
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    /**
     * Aggiorna dinamicamente la configurazione del dataset secondario (Legacy).
     * Mantenuto per compatibilità, ma meno usato con la nuova struttura datasetsConfig.
     */
    updateSecondaryConfig(label, color, dashed, useSecondaryAxis = true) {
        if (!this.chart || this.type === 'bar' || this.chart.data.datasets.length < 2) return;

        const dataset = this.chart.data.datasets[1];
        const scaleY1 = this.chart.options.scales.y1;

        // 1. Aggiorna stile visivo
        dataset.label = label;
        dataset.borderColor = color;
        dataset.borderDash = dashed ? [5, 5] : [];
        dataset.fill = !dashed; 

        // 2. Aggiorna assegnazione Asse
        const targetAxis = useSecondaryAxis ? 'y1' : 'y';
        
        if (dataset.yAxisID !== targetAxis) {
            dataset.yAxisID = targetAxis;
        }
        
        if (scaleY1) {
            scaleY1.display = useSecondaryAxis;
            if (scaleY1.title) scaleY1.title.text = label;
        }

        this.chart.update('none');
    }

    /**
     * Metodo Update Unificato.
     * Supporta due firme:
     * 1. update(dataArray) -> Per grafici a barre (array di numeri)
     * 2. update(sourcesArray, extractorsArray) -> Per grafici lineari multi-dataset
     */
    update(dataSources, extractors) {
        if (!this.chart) return;

        // --- GESTIONE GRAFICO A BARRE ---
        if (this.type === 'bar') {
            // dataSources qui è l'array diretto dei valori (es. [10, 20, 5, ...])
            const values = Array.isArray(dataSources) ? dataSources : [];
            this.chart.data.datasets[0].data = values;
            this.chart.update();
            return;
        }

        // --- GESTIONE GRAFICO LINEARE (Multi-Dataset) ---
        // Funzione helper per mappare i punti {x, y}
        const mapData = (points, extractor) => {
            if (!points || !extractor) return [];
            return points.map(p => ({
                x: (p.distanceKm !== undefined) ? p.distanceKm : (p.totalDistanceMeters || 0) / 1000,
                y: extractor(p)
            })).filter(pt => pt.y !== null && isFinite(pt.y));
        };

        // Normalizziamo gli argomenti per gestire sia la nuova firma array che quella vecchia
        let sources = [];
        let exts = [];

        if (Array.isArray(extractors)) {
            // Nuova firma: update([src1, src2], [ext1, ext2])
            sources = dataSources;
            exts = extractors;
        } else {
            // Vecchia firma fallback: update(src1, src2, ext1, ext2)
            // (Mantenuta per robustezza nel caso qualche chiamata sia sfuggita)
            sources = [arguments[0], arguments[1]];
            exts = [arguments[2], arguments[3]];
        }

        // Iteriamo sui dataset configurati nel chart e li aggiorniamo
        this.chart.data.datasets.forEach((dataset, index) => {
            const source = sources[index];
            const extractor = exts[index];

            // Se abbiamo una fonte e un estrattore per questo indice, aggiorniamo i dati
            // Nota: Se source è null/undefined, saltiamo l'aggiornamento per preservare o svuotare
            if (source && extractor) {
                dataset.data = mapData(source, extractor);
            } else if (source == []) {
                dataset.data = [];
            }
        });
        
        this.chart.update('none'); // Aggiorna senza animazione per performance
    }
}