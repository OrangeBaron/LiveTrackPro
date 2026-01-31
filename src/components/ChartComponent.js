import { CONFIG } from '../config.js';

export class ChartComponent {
    constructor(canvasId, label, color, type = 'line', options = {}) {
        this.canvasId = canvasId;
        this.label = label;
        this.color = color;
        this.type = type;
        this.chart = null;
        // Opzioni extra per dual-line (es. label asse destro, colori)
        this.extraOptions = options; 
    }

    init() {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        
        // Configurazione Base condivisa
        const commonConfig = {
            responsive: true, 
            maintainAspectRatio: false, 
            animation: false,
            interaction: { mode: 'index', intersect: false },
            scales: { x: { grid: { display: false } } }
        };

        // SWITCH centrale per tipo di grafico
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

    // --- Sotto-metodi di inizializzazione (Privati per convenzione) ---

    _initBarChart(ctx, config) {
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
                datasets: [{
                    label: this.label,
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'],
                    borderRadius: 4
                }]
            },
            options: { ...config, plugins: { legend: { display: false } } }
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
                scales: { ...config.scales, x: { type: 'linear', min: 0, grid: { display: false } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    _initDualLineChart(ctx, config) {
        // Recupera opzioni specifiche passate nel costruttore
        const { label2, color2, dashed2 } = this.extraOptions;

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [
                {
                    label: this.label, // Asse SX
                    borderColor: this.color,
                    backgroundColor: this.color + '11',
                    yAxisID: 'y', borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true,
                    data: []
                },
                {
                    label: label2 || 'Secondary', // Asse DX
                    borderColor: color2 || '#000',
                    borderDash: dashed2 ? [5, 5] : [],
                    yAxisID: 'y1', borderWidth: 2, pointRadius: 0, tension: 0.2, fill: false,
                    data: []
                }
            ]},
            options: {
                ...config,
                plugins: { legend: { display: true } },
                scales: {
                    x: { type: 'linear', min: 0, grid: { display: false } },
                    y: { 
                        type: 'linear', display: true, position: 'left', 
                        title: { display: true, text: this.label },
                        grid: { color: '#f0f0f0' }
                    },
                    y1: { 
                        type: 'linear', display: true, position: 'right', 
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: label2 } 
                    }
                }
            }
        });
    }

    // --- Metodo Update Unificato ---
    update(dataMain, dataSecondary, extractorMain, extractorSecondary) {
        if (!this.chart) return;

        if (this.type === 'bar') {
            // dataMain qui è l'array delle zone (secondi)
            const minutes = (Array.isArray(dataMain) ? dataMain : []).map(s => (s / 60).toFixed(1));
            this.chart.data.datasets[0].data = minutes;
            this.chart.update();
            return;
        }

        // Helper per mappare i punti {x, y}
        const mapData = (points, extractor) => {
            if (!points || !extractor) return [];
            return points.map(p => ({
                x: (p.distanceKm !== undefined) ? p.distanceKm : (p.totalDistanceMeters || 0) / 1000,
                y: extractor(p)
            })).filter(pt => pt.y !== null && isFinite(pt.y));
        };

        // Aggiornamento Dataset
        if (this.type === 'dual-line') {
            // Dual Line: Dataset 0 (Main), Dataset 1 (Secondary) - Entrambi basati su dataMain (livePoints)
            this.chart.data.datasets[0].data = mapData(dataMain, extractorMain);
            this.chart.data.datasets[1].data = mapData(dataMain, extractorSecondary);
        } else {
            // Standard Line: Dataset 1 (Main/Live), Dataset 0 (Secondary/Course)
            this.chart.data.datasets[1].data = mapData(dataMain, extractorMain);
            // Il course ha spesso una struttura diversa, gestiamola se serve, 
            // ma usando lo stesso helper se i nomi delle prop coincidono o tramite extractor.
            if (dataSecondary && extractorSecondary) {
                this.chart.data.datasets[0].data = mapData(dataSecondary, extractorSecondary);
            }
        }
        
        this.chart.update();
    }
}