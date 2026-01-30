import { CONFIG } from '../config.js';

export class ChartComponent {
    /**
     * @param {string} canvasId - ID del canvas HTML
     * @param {string} label - Etichetta principale del dataset
     * @param {string} color - Colore principale
     * @param {string} type - Tipo di grafico: 'line', 'bar', 'dual-line'
     */
    constructor(canvasId, label, color, type = 'line') {
        this.canvasId = canvasId;
        this.label = label;
        this.color = color;
        this.type = type;
        this.chart = null;
    }

    init() {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        
        // Opzioni comuni per tutti i grafici
        const commonOptions = {
            responsive: true, 
            maintainAspectRatio: false, 
            animation: false,
            scales: { 
                x: { grid: { display: false } }, 
                y: { grid: { color: '#f0f0f0' }, beginAtZero: true } 
            },
            plugins: {
                tooltip: { mode: 'index', intersect: false }
            }
        };

        if (this.type === 'bar') {
            // --- ISTOGRAMMA (Zone HR) ---
            this.chart = new Chart(ctx, {
                type: 'bar',
                data: { 
                    labels: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'],
                    datasets: [{
                        label: this.label,
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: [
                            '#3498db', // Z1 - Blu
                            '#2ecc71', // Z2 - Verde
                            '#f1c40f', // Z3 - Giallo
                            '#e67e22', // Z4 - Arancio
                            '#e74c3c'  // Z5 - Rosso
                        ],
                        borderRadius: 4
                    }]
                },
                options: {
                    ...commonOptions,
                    plugins: { legend: { display: false } }
                }
            });
        } else {
            // --- LINE CHART STANDARD (Elevation, Speed) ---
            // Creiamo sempre due dataset: uno per la traccia prevista (background) e uno per la live
            this.chart = new Chart(ctx, {
                type: 'line',
                data: { datasets: [
                    // Dataset 0: Course (Previsto - Background)
                    {
                        label: 'Previsto',
                        data: [],
                        borderColor: CONFIG.colors.chartSecondary || '#ccc',
                        borderWidth: 1,
                        pointRadius: 0,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.1,
                        order: 2
                    },
                    // Dataset 1: Live (Attuale - Foreground)
                    {
                        label: this.label,
                        data: [],
                        borderColor: this.color,
                        backgroundColor: this.color + '33', // Opacità 20%
                        borderWidth: 2, 
                        pointRadius: 0, 
                        fill: true, 
                        tension: 0.2,
                        order: 1
                    }
                ]},
                options: {
                    ...commonOptions,
                    scales: { 
                        ...commonOptions.scales, 
                        x: { type: 'linear', min: 0, grid: { display: false } } 
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    plugins: { 
                        legend: { display: false }
                    }
                }
            });
        }
    }

    // --- METODO SPECIALE PER GRAFICO AVANZATO (W' + Efficiency) ---
    initDualLine(label1, color1, label2, color2) {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById(this.canvasId).getContext('2d');
        this.type = 'dual-line';

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [
                {
                    label: label1, 
                    data: [], 
                    borderColor: color1,
                    backgroundColor: color1 + '11', // Molto leggero
                    yAxisID: 'y', 
                    borderWidth: 2, 
                    pointRadius: 0, 
                    tension: 0.2,
                    fill: true
                },
                {
                    label: label2, 
                    data: [], 
                    borderColor: color2,
                    borderDash: [5, 5], 
                    yAxisID: 'y1', 
                    borderWidth: 2, 
                    pointRadius: 0, 
                    tension: 0.2,
                    fill: false
                }
            ]},
            options: {
                responsive: true, 
                maintainAspectRatio: false, 
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true } },
                scales: {
                    x: { 
                        type: 'linear', 
                        min: 0,
                        grid: { display: false }
                    },
                    y: { 
                        type: 'linear', 
                        display: true, 
                        position: 'left', 
                        title: { display: true, text: label1 },
                        grid: { color: '#f0f0f0' }
                    },
                    y1: { 
                        type: 'linear', 
                        display: true, 
                        position: 'right', 
                        grid: { drawOnChartArea: false }, 
                        title: { display: true, text: label2 } 
                    }
                }
            }
        });
    }

    update(data1, data2OrExtractor, extractor1, extractor2) {
        if (!this.chart) return;

        if (this.type === 'bar') {
            // data1: array di secondi per zona
            // Convertiamo in minuti per leggibilità
            const minutes = data1.map(s => (s / 60).toFixed(1));
            this.chart.data.datasets[0].data = minutes;
        } 
        else if (this.type === 'dual-line') {
            // data1: array livePoints completo
            // Dataset 0: W' Balance
            this.chart.data.datasets[0].data = data1.map(p => ({ 
                x: p.distanceKm, 
                y: p.wPrimeBal 
            }));
            
            // Dataset 1: Efficiency
            // Filtriamo valori nulli o infiniti
            this.chart.data.datasets[1].data = data1.map(p => ({ 
                x: p.distanceKm, 
                y: p.efficiency 
            })).filter(pt => pt.y !== null && isFinite(pt.y));
        }
        else {
            // --- STANDARD LINE CHART ---
            
            const toXY = (points, extractor) => points.map(p => ({
                x: (p.totalDistanceMeters || 0) / 1000,
                y: extractor(p)
            })).filter(pt => pt.y !== null && !isNaN(pt.y));

            // Aggiorna Live Track (Dataset 1)
            this.chart.data.datasets[1].data = toXY(data1, extractor1);

            // Aggiorna Course Track (Dataset 0) se disponibile
            // data2OrExtractor: array coursePoints
            // extractor2: funzione estrattore per course
            if (Array.isArray(data2OrExtractor) && data2OrExtractor.length > 0) {
                 this.chart.data.datasets[0].data = toXY(data2OrExtractor, extractor2);
            }
        }
        
        this.chart.update();
    }
}