import { formatDuration } from './helpers.js';

/**
 * Genera la configurazione completa per Chart.js
 * Include assi, tooltip e configurazione Zoom/Pan.
 * * @param {string} type - 'line' o 'bar'
 * @returns {Object} Configurazione completa
 */
export function getChartOptions(type) {
    const isBar = (type === 'bar');

    const zoomConfiguration = {
        limits: {
            x: { min: 0, minRange: 0.5 },
            y: { min: 'original', max: 'original' }
        },
        pan: { 
            enabled: true, 
            mode: 'x', 
            threshold: 10 
        },
        zoom: {
            wheel: { enabled: false }, 
            
            pinch: { enabled: true },
            mode: 'x', 
        }
    };

    return {
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
            zoom: isBar ? false : zoomConfiguration 
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
}