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
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: { x: { grid: { display: false } } }
        };

        switch (this.type) {
            case 'bar':
                this._initBarChart(ctx, commonConfig);
                break;
            case 'dual-line':
                this._initDualLineChart(ctx, commonConfig);
                break;
            case 'line':
            default:
                this._initStandardLineChart(ctx, commonConfig);
                break;
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

    _initStandardLineChart(ctx, config) {
        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [
                {
                    label: 'Previsto',
                    data: [],
                    borderColor: CONFIG.colors.chartSecondary || '#ccc',
                    borderWidth: 1, pointRadius: 0, borderDash: [5, 5],
                    fill: false, tension: 0.1
                },
                {
                    label: this.label,
                    data: [],
                    borderColor: this.color,
                    backgroundColor: this.color + '33',
                    borderWidth: 2, pointRadius: 0, 
                    fill: true, tension: 0.2
                }
            ]},
            options: {
                ...config,
                scales: { ...config.scales, x: { type: 'linear', min: 0, grid: { display: false } }, y: { beginAtZero: false }},
                plugins: { legend: { display: false } }
            }
        });
    }

    _initDualLineChart(ctx, config) {
        const { label2, color2, dashed2 } = this.extraOptions;

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [
                {
                    label: this.label, 
                    borderColor: this.color,
                    backgroundColor: this.color + '11',
                    yAxisID: 'y', borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true,
                    data: []
                },
                {
                    label: label2 || 'Secondary', 
                    borderColor: color2 || '#000',
                    borderDash: dashed2 ? [5, 5] : [],
                    yAxisID: 'y1', borderWidth: 2, pointRadius: 0, tension: 0.2, fill: false,
                    data: []
                }
            ]},
            options: {
                ...config,
                plugins: { legend: { display: false } },
                scales: {
                    x: { type: 'linear', min: 0, grid: { display: false } },
                    y: { 
                        type: 'linear', display: true, position: 'left',
                        title: { display: false, text: this.label },
                        grid: { color: '#f0f0f0' }
                    },
                    y1: { 
                        type: 'linear', display: true, position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: false, text: label2 } 
                    }
                }
            }
        });
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

        if (this.type === 'dual-line') {
            this.chart.data.datasets[0].data = mapData(dataMain, extractorMain);
            this.chart.data.datasets[1].data = mapData(dataMain, extractorSecondary);
        } else {
            this.chart.data.datasets[1].data = mapData(dataMain, extractorMain);
            if (dataSecondary && extractorSecondary) {
                this.chart.data.datasets[0].data = mapData(dataSecondary, extractorSecondary);
            }
        }
        
        this.chart.update();
    }
}