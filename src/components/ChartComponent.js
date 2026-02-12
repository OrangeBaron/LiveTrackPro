import { formatDuration } from '../utils/helpers.js';

export class ChartComponent {
    constructor(canvasId, type = 'line', config = []) {
        this.canvasId = canvasId;
        this.type = type; 
        this.datasetsConfig = config;
        this.chart = null;
        
        // Stato per la gestione dello zoom/scroll
        this.lastKnownMaxX = 0; 
    }

    init() {
        if (typeof Chart === 'undefined') return;

        // Registrazione esplicita del plugin
        if (window.ChartZoom && typeof Chart.register === 'function') {
            Chart.register(window.ChartZoom);
        }

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
                        title: (context) => {
                            if (isBar) return context[0].label;
                            const val = context[0].parsed.x;
                            return val.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' km';
                        },
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            
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
                        x: { min: 0, minRange: 0.5 }
                    },
                    pan: { enabled: true, mode: 'x', threshold: 10 },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    }
                }
            },
            scales: { 
                x: { 
                    type: isBar ? 'category' : 'linear',
                    min: isBar ? undefined : 0,
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
                    grid: { color: '#f0f0f0', drawBorder: false },
                    ticks: { color: '#666', font: { size: 10 } }
                },
                y1: { 
                    display: false, 
                    position: 'right', 
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#666', font: { size: 10 } }
                }
            }
        };

        if (isBar) {
            commonOptions.plugins.zoom = false;
        }

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

        if (datasets.some(d => d.yAxisID === 'y1')) {
            commonOptions.scales.y1.display = true;
        }

        this.chart = new Chart(ctx, {
            type: this.type,
            data: { labels: [], datasets: datasets },
            options: commonOptions
        });
    }

    update(sources, extractors, maxDistance = null) {
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
        let calculatedMaxX = 0;

        // 1. Aggiorna i dati
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

        // 2. Calcola Max X
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
        
        // 3. Logica Zoom & Scroll
        if (this.chart.options.plugins.zoom && calculatedMaxX > 0) {
            const zoomOpts = this.chart.options.plugins.zoom;
            zoomOpts.limits.x.max = calculatedMaxX;

            const scale = this.chart.scales.x;
            const currentMin = scale.min;
            const currentMax = scale.max;
            const tolerance = 0.2; 
            const isAtRightEdge = (this.lastKnownMaxX === 0) || (currentMax >= (this.lastKnownMaxX - tolerance));
            const isAtLeftEdge = (currentMin <= tolerance);

            if (isAtRightEdge) {
                if (isAtLeftEdge) {
                    scale.max = calculatedMaxX;
                } else {
                    const delta = calculatedMaxX - this.lastKnownMaxX;
                    if (delta > 0) {
                        scale.min = currentMin + delta;
                        scale.max = calculatedMaxX;
                    }
                }
            }

            this.lastKnownMaxX = calculatedMaxX;
        }
        
        this.chart.update('none');
    }
}