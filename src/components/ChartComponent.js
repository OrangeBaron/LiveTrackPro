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
        const { label2, color2, dashed2, useSecondaryAxis } = this.extraOptions;
        
        const enableY1 = useSecondaryAxis !== undefined ? useSecondaryAxis : (this.type === 'dual-line');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: [],
                datasets: [
                    {
                        label: this.label,
                        data: [],
                        borderColor: this.color,
                        backgroundColor: this.color + '33',
                        yAxisID: 'y',
                        borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true
                    },
                    {
                        label: label2 || 'Previsto',
                        data: [],
                        borderColor: color2 || CONFIG.colors.chartSecondary || '#ccc',
                        backgroundColor: (color2 || '#ccc') + '11',
                        borderDash: dashed2 ? [5, 5] : [],
                        yAxisID: enableY1 ? 'y1' : 'y', 
                        borderWidth: 2, pointRadius: 0, tension: 0.2, 
                        fill: !dashed2 
                    }
                ]
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
                        type: 'linear', display: true, position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: false, text: label2 },
                        display: enableY1 
                    }
                }
            }
        });
    }

    /**
     * Aggiorna dinamicamente la configurazione del dataset secondario.
     */
    updateSecondaryConfig(label, color, dashed, useSecondaryAxis = true) {
        if (!this.chart || this.type === 'bar') return;

        const dataset = this.chart.data.datasets[1];
        const scaleY1 = this.chart.options.scales.y1;

        // 1. Aggiorna stile visivo
        dataset.label = label;
        dataset.borderColor = color;
        dataset.borderDash = dashed ? [5, 5] : [];
        dataset.fill = !dashed; 

        // 2. Aggiorna assegnazione Asse
        const targetAxis = useSecondaryAxis ? 'y1' : 'y';
        
        // Applica le modifiche solo se necessario
        let needsUpdate = false;
        
        if (dataset.yAxisID !== targetAxis) {
            dataset.yAxisID = targetAxis;
            needsUpdate = true;
        }
        
        if (scaleY1 && scaleY1.display !== useSecondaryAxis) {
            scaleY1.display = useSecondaryAxis;
            needsUpdate = true;
        }

        // Aggiorna titolo asse secondario se visibile
        if (useSecondaryAxis && scaleY1 && scaleY1.title) {
             scaleY1.title.text = label;
        }

        this.chart.update('none'); // Aggiorna senza animazione
    }

    update(dataMain, dataSecondary, extractorMain, extractorSecondary) {
        if (!this.chart) return;

        if (this.type === 'bar') {
            const minutes = (Array.isArray(dataMain) ? dataMain : []).map(s => (s / 60).toFixed(1));
            this.chart.data.datasets[0].data = minutes;
            this.chart.update();
            return;
        }

        const mapData = (points, extractor) => {
            if (!points || !extractor) return [];
            return points.map(p => ({
                x: (p.distanceKm !== undefined) ? p.distanceKm : (p.totalDistanceMeters || 0) / 1000,
                y: extractor(p)
            })).filter(pt => pt.y !== null && isFinite(pt.y));
        };

        // Aggiorna Dataset Principale
        this.chart.data.datasets[0].data = mapData(dataMain, extractorMain);

        // Aggiorna Dataset Secondario
        const sourceSecondary = dataSecondary || dataMain;
        this.chart.data.datasets[1].data = mapData(sourceSecondary, extractorSecondary);
        
        this.chart.update('none');
    }
}