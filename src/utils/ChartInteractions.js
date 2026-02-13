/**
 * Gestisce le interazioni avanzate (Trackpad/Mouse) e le logiche di Auto-Scroll.
 */
export const ChartInteractions = {
    
    // --- 1. Gestione Eventi Input (Wheel/Pan/Zoom) ---
    attach(chart) {
        if (!chart || !chart.canvas) return;

        const canvas = chart.canvas;

        // Cleanup listener precedenti
        if (chart._interactionWheelHandler) {
            canvas.removeEventListener('wheel', chart._interactionWheelHandler);
        }

        const wheelHandler = (e) => {
            // Blocca lo scroll nativo della pagina
            e.preventDefault();

            const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

            // Pan (Movimento Orizzontale)
            if (isHorizontal && e.deltaX !== 0) {
                chart.pan({ x: -e.deltaX }, undefined, 'default');
            }
            
            // Zoom (Movimento Verticale)
            else if (!isHorizontal && e.deltaY !== 0) {
                const strength = 0.001; 
                const zoomFactor = 1 + (e.deltaY * -strength);
                chart.zoom(zoomFactor);
            }
        };

        // Attach nuovo listener
        chart._interactionWheelHandler = wheelHandler;
        canvas.addEventListener('wheel', wheelHandler, { passive: false });
    },

    // --- 2. Gestione Auto-Scroll e Smart Zoom ---
    handleAutoScroll(chart, currentMaxX, lastKnownMaxX) {
        const zoomOpts = chart.options.plugins.zoom;
        const scale = chart.scales.x;
        
        // Aggiorna limite assoluto scorrimento
        zoomOpts.limits.x.max = currentMaxX;

        // CASO 1: Primo caricamento
        if (lastKnownMaxX === 0) {
            scale.min = 0;
            scale.max = currentMaxX;
        } 
        // CASO 2: Aggiornamenti successivi (Logica a 3 stati)
        else {
            const currentMin = scale.min;
            const currentVisMax = scale.max;
            const tolerance = 0.1; // 100 metri tolleranza
            
            // Check posizionamento vista
            const isAtStart = (currentMin <= tolerance);
            const isAtEnd = (currentVisMax >= (lastKnownMaxX - tolerance));

            if (isAtStart && isAtEnd) {
                // STATO: FULL OVERVIEW (Allarga tutto)
                scale.min = 0;
                scale.max = currentMaxX;
            } 
            else if (!isAtStart && isAtEnd) {
                // STATO: FOLLOW MODE (Sposta finestra a destra)
                const windowSize = currentVisMax - currentMin;
                scale.max = currentMaxX;
                scale.min = currentMaxX - windowSize;
            }
            // STATO: HISTORY MODE (Nessuna azione, mantiene la vista corrente)
        }

        // Sincronizza options
        chart.options.scales.x.min = scale.min;
        chart.options.scales.x.max = scale.max;

        return currentMaxX;
    }
};