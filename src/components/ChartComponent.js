import { CONFIG } from '../config.js';

export class ChartComponent {
    constructor(canvasId, label, color, isDualSeries = false) {
        this.canvasId = canvasId;
        this.label = label;
        this.color = color;
        this.isDualSeries = isDualSeries;
        this.chart = null;
    }

    init() {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        
        const datasets = [];

        // Serie "Prevista" (Background)
        if (this.isDualSeries) {
            datasets.push({
                label: 'Previsto',
                data: [],
                borderColor: CONFIG.colors.chartSecondary,
                backgroundColor: 'rgba(0,0,0,0)',
                borderWidth: 2,
                pointRadius: 0,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                order: 2
            });
        }

        // Serie "Live" (Foreground)
        datasets.push({
            label: this.label, 
            data: [],
            borderColor: this.color,
            backgroundColor: this.color + '33', // Opacity hack
            borderWidth: 2, 
            fill: true,
            pointRadius: 0, 
            tension: 0.2,
            order: 1
        });

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { 
                    legend: { display: this.isDualSeries },
                    tooltip: { mode: 'index', intersect: false } 
                },
                scales: { 
                    x: { 
                        type: 'linear', 
                        grid: { display: false },
                        min: 0
                    }, 
                    y: { 
                        beginAtZero: false, 
                        grid: { color: '#f0f0f0' } 
                    } 
                },
                interaction: { mode: 'nearest', axis: 'x', intersect: false }
            }
        });
    }

    update(livePoints, coursePoints, dataExtractor, courseExtractor) {
        if (!this.chart) return;
        
        const toXY = (points, extractor) => {
            return points.map(p => ({
                x: (p.totalDistanceMeters || 0) / 1000, // Metri -> KM
                y: extractor(p)
            })).filter(pt => pt.y !== null && !isNaN(pt.y));
        };

        // Aggiorna Live (ultimo dataset)
        const liveIndex = this.chart.data.datasets.length - 1;
        this.chart.data.datasets[liveIndex].data = toXY(livePoints, dataExtractor);

        // Aggiorna Course (primo dataset, se esiste)
        if (this.isDualSeries && coursePoints && coursePoints.length > 0) {
            this.chart.data.datasets[0].data = toXY(coursePoints, courseExtractor);
        }

        this.chart.update();
    }
}