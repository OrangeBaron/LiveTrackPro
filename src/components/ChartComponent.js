import { formatDuration } from '../utils/helpers.js'; // <--- 1. NUOVO IMPORT

export class ChartComponent {
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

        // --- Configurazione Opzioni Generali ---
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (isBar) {
                                label += formatDuration(context.parsed.y * 1000);
                            } else {
                                label += context.parsed.y.toLocaleString('it-IT', { 
                                    maximumFractionDigits: 2 
                                });
                            }
                            return label;
                        }
                    }
                },
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original', minRange: 0.5 }
                    },
                    pan: { enabled: true, mode: 'x' },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    }
                }
            },
            // --- Configurazione Assi e Griglia ---
            scales: { 
                x: { 
                    grid: { 
                        display: !isBar,      
                        color: '#f0f0f0',     
                        drawBorder: false   
                    },
                    ticks: {
                        display: true,
                        color: '#666',
                        font: { size: 10 },
                        maxTicksLimit: 10
                    }
                },
                y: {
                    display: !isBar, 
                    position: 'left', 
                    beginAtZero: isBar,
                    grid: { 
                        color: '#f0f0f0',
                        drawBorder: false 
                    },
                    ticks: {
                        color: '#666',
                        font: { size: 10 },
                    }
                },
                y1: { 
                    display: false, 
                    position: 'right', 
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#666',
                        font: { size: 10 }
                    }
                }
            }
        };

        // Disabilita zoom su grafici a barre
        if (isBar) {
            commonOptions.plugins.zoom = false;
        }

        // --- Preparazione Datasets ---
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

        // Configurazione Assi Dinamica
        if (datasets.some(d => d.yAxisID === 'y1')) {
            commonOptions.scales.y1.display = true;
        }
        commonOptions.scales.x.type = isBar ? 'category' : 'linear';
        commonOptions.scales.x.min = isBar ? undefined : 0;

        // --- Istanza Chart.js ---
        this.chart = new Chart(ctx, {
            type: this.type,
            data: { labels: [], datasets: datasets },
            options: commonOptions
        });
    }

    update(sources, extractors) {
        if (!this.chart) return;

        // --- Aggiornamento Bar Chart ---
        if (this.type === 'bar') {
            const values = Array.isArray(sources) ? sources : [];
            this.chart.data.datasets[0].data = values;
            
            if (extractors && Array.isArray(extractors)) {
                this.chart.data.labels = extractors;
            }
            this.chart.update();
            return;
        }

        // --- Aggiornamento Line Chart ---
        this.chart.data.datasets.forEach((dataset, i) => {
            const source = sources[i] || [];
            const extractor = extractors ? extractors[i] : null;

            if (source.length > 0 && extractor) {
                dataset.data = source.map(p => ({
                    x: (p.distanceKm !== undefined) ? p.distanceKm : (p.totalDistanceMeters || 0) / 1000,
                    y: extractor(p)
                })).filter(pt => pt.y !== null && isFinite(pt.y));
                
                this.chart.resetZoom = false; 
            }
        });
        
        this.chart.update('none');
    }
}