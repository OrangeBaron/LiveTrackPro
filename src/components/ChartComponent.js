import { ChartInteractions } from '../utils/ChartInteractions.js';
import { getChartOptions } from '../utils/ChartConfig.js'; 

export class ChartComponent {
    constructor(canvasId, type = 'line', config = []) {
        this.canvasId = canvasId;
        this.type = type; 
        this.datasetsConfig = config;
        this.chart = null;
        this.lastKnownMaxX = 0;
    }

    init() {
        if (typeof Chart === 'undefined') return;

        // Registrazione Plugin Zoom
        if (window.ChartZoom && typeof Chart.register === 'function') {
            Chart.register(window.ChartZoom);
        }

        const ctx = document.getElementById(this.canvasId).getContext('2d');
        const isBar = (this.type === 'bar');

        // 1. GENERAZIONE DATASET
        const datasets = this.datasetsConfig.map(cfg => {
            const bgColor = isBar ? cfg.color : (cfg.color + '33');
            return {
                label: cfg.label || '',
                data: [], 
                borderColor: cfg.color,
                backgroundColor: bgColor,
                borderDash: cfg.dashed ? [5, 5] : [],
                yAxisID: cfg.yAxisID || 'y',
                fill: cfg.fill !== undefined ? cfg.fill : false,
                order: cfg.order || 0,
                borderRadius: isBar ? 4 : 0,
                borderWidth: isBar ? 0 : 2,
                pointRadius: 0,
                tension: 0.2
            };
        });

        // 2. RECUPERO CONFIGURAZIONE
        const chartOptions = getChartOptions(this.type);

        // Attiva asse Y destro se necessario
        if (datasets.some(d => d.yAxisID === 'y1')) {
            chartOptions.scales.y1.display = true;
        }

        // 3. CREAZIONE GRAFICO
        this.chart = new Chart(ctx, {
            type: this.type,
            data: { labels: [], datasets: datasets },
            options: chartOptions
        });

        // 4. ATTIVAZIONE INTERAZIONI
        if (!isBar) {
            ChartInteractions.attach(this.chart);
        }
    }

    update(sources, extractors, maxDistance = null) {
        if (!this.chart) return;

        // --- A. Aggiornamento Bar Chart ---
        if (this.type === 'bar') {
            const values = Array.isArray(sources) ? sources : [];
            this.chart.data.datasets[0].data = values;
            if (extractors && Array.isArray(extractors)) {
                this.chart.data.labels = extractors;
            }
            this.chart.update();
            return;
        }

        // --- B. Aggiornamento Line Chart ---
        let calculatedMaxX = 0;

        this.chart.data.datasets.forEach((dataset, i) => {
            const source = sources[i] || [];
            const extractor = extractors ? extractors[i] : null;

            if (source.length > 0 && extractor) {
                dataset.data = source.map(p => ({
                    x: (p.distanceKm !== undefined) ? p.distanceKm : (p.totalDistanceMeters || 0) / 1000,
                    y: extractor(p)
                })).filter(pt => pt.y !== null && isFinite(pt.y));
            }
        });

        // Calcolo Max X (per limiti zoom)
        if (maxDistance !== null && maxDistance > 0) {
            calculatedMaxX = maxDistance;
        } else {
            this.chart.data.datasets.forEach(d => {
                if (d.data.length > 0) {
                    const lastPt = d.data[d.data.length - 1];
                    if (lastPt.x > calculatedMaxX) calculatedMaxX = lastPt.x;
                }
            });
        }
        
        // --- C. Gestione Smart Zoom / Auto-Scroll ---
        if (this.chart.options.plugins.zoom && calculatedMaxX > 0) {
            this.lastKnownMaxX = ChartInteractions.handleAutoScroll(
                this.chart, 
                calculatedMaxX, 
                this.lastKnownMaxX
            );
        }
        
        this.chart.update('none');
    }
}