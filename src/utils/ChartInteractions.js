/**
 * Gestisce le interazioni avanzate (Trackpad/Mouse).
 * Separa Pan (orizzontale) e Zoom (verticale).
 */
export const ChartInteractions = {
    
    attach(chart) {
        if (!chart || !chart.canvas) return;

        const canvas = chart.canvas;

        // 1. Cleanup listener precedenti
        if (chart._interactionWheelHandler) {
            canvas.removeEventListener('wheel', chart._interactionWheelHandler);
        }

        const wheelHandler = (e) => {
            // Blocca lo scroll nativo della pagina
            e.preventDefault();

            const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

            // 2. Gestione PAN (Movimento Orizzontale)
            if (isHorizontal && e.deltaX !== 0) {
                chart.pan({ x: -e.deltaX }, undefined, 'default');
            }
            
            // 3. Gestione ZOOM (Movimento Verticale)
            else if (!isHorizontal && e.deltaY !== 0) {
                const strength = 0.001; 
                const zoomFactor = 1 + (e.deltaY * -strength);
                chart.zoom(zoomFactor);
            }
        };

        // 4. Attach nuovo listener
        chart._interactionWheelHandler = wheelHandler;
        canvas.addEventListener('wheel', wheelHandler, { passive: false });
    }
};