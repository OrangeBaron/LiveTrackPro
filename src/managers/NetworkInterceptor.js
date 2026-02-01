/**
 * Gestisce l'intercettazione delle chiamate di rete (fetch)
 * per catturare i dati LiveTrack e Course senza fare polling.
 */
export class NetworkInterceptor {
    constructor() {
        // Salva il riferimento originale prima di sovrascriverlo
        this.originalFetch = window.fetch; 
        
        // Stato interno
        this.capturedCsrfToken = null;
        this.historyFetched = false;
        
        // Callbacks (eventi)
        this.onLivePoints = null;   // (data) => void
        this.onCoursePoints = null; // (data) => void
    }

    /**
     * Attiva l'interceptor sovrascrivendo window.fetch
     */
    init() {
        window.fetch = this._handleFetch.bind(this);
        console.log("LiveTrackPro: Network Interceptor activated.");
    }

    /**
     * Gestore centrale delle richieste fetch
     */
    async _handleFetch(...args) {
        // args[0] è l'URL, args[1] sono le opzioni
        
        // 1. SNIFFING DEL CSRF TOKEN
        // Necessario per poter fare chiamate API autenticate (es. storico)
        if (!this.capturedCsrfToken && args[1] && args[1].headers) {
            let token = null;
            if (args[1].headers instanceof Headers) {
                token = args[1].headers.get('livetrack-csrf-token');
            } else {
                // Ricerca case-insensitive
                const keys = Object.keys(args[1].headers);
                const key = keys.find(k => k.toLowerCase() === 'livetrack-csrf-token');
                if (key) token = args[1].headers[key];
            }

            if (token) {
                this.capturedCsrfToken = token;
                console.log("LiveTrackPro: CSRF Token captured.");
                // Appena abbiamo il token, proviamo a scaricare lo storico
                this._forceHistoryFetch(token); 
            }
        }

        // Esegui la richiesta originale
        const responsePromise = this.originalFetch.apply(window, args);
        
        // 2. ANALISI DELLA RISPOSTA (Spying)
        try {
            const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
            
            // --- Gestione Course (Percorso pianificato) ---
            if (url.includes('courses')) {
                responsePromise.then(res => {
                    if (res.ok) {
                        res.clone().json()
                            .then(data => {
                                if (this.onCoursePoints) this.onCoursePoints(data);
                            })
                            .catch(e => console.warn("LiveTrackPro: Course parse error", e));
                    }
                }).catch(() => {});
            }

            // --- Gestione Live Track (Punti attuali) ---
            if (url.includes('track-points/common')) {
                responsePromise.then(res => {
                    if (res.ok) {
                        res.clone().json()
                            .then(data => {
                                if (this.onLivePoints) this.onLivePoints(data);
                            })
                            .catch(e => console.warn("LiveTrackPro: Live points parse error", e));
                    }
                }).catch(() => {});
            }

        } catch (e) {
            console.warn("LiveTrackPro: Interceptor spy error", e);
        }
        
        return responsePromise;
    }

    /**
     * Tenta di scaricare l'intero storico della sessione se non è ancora stato fatto.
     * Utilizza il token CSRF appena catturato.
     */
    async _forceHistoryFetch(tokenCsrf) {
        if (this.historyFetched) return; 
        this.historyFetched = true;

        console.log("🚀 LiveTrackPro: Starting forced history fetch...");

        // Estrazione ID Sessione dall'URL
        const pathParts = window.location.pathname.split('/');
        const sessionIndex = pathParts.indexOf('session');
        
        if (sessionIndex === -1 || pathParts.length <= sessionIndex + 1) {
            console.warn("LiveTrackPro: Session ID not found, skipping history.");
            return;
        }
        const sessionId = pathParts[sessionIndex + 1];

        // Recupero Token URL (se presente)
        const urlParams = new URLSearchParams(window.location.search);
        let tokenUrl = urlParams.get('token');
        if (!tokenUrl) {
            const tokenIndex = pathParts.indexOf('token');
            if (tokenIndex !== -1 && pathParts.length > tokenIndex + 1) {
                tokenUrl = pathParts[tokenIndex + 1];
            }
        }

        // Costruzione URL API
        let apiUrl = `https://livetrack.garmin.com/api/sessions/${sessionId}/track-points/common`;
        if (tokenUrl) apiUrl += `?token=${tokenUrl}`;

        try {
            // Usa fetch originale per evitare loop o interferenze
            const response = await this.originalFetch(apiUrl, {
                method: "GET",
                headers: {
                    "livetrack-csrf-token": tokenCsrf,
                    "accept": "application/json",
                    "priority": "u=1, i"
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`🎉 LiveTrackPro: History fetched (${data.trackPoints?.length || 0} points).`);
                
                // Inietta i dati come se fossero arrivati dal live
                if (this.onLivePoints) this.onLivePoints(data);
            } else {
                console.warn(`LiveTrackPro: Error fetching history: ${response.status}`);
            }
        } catch (e) {
            console.error("LiveTrackPro: History fetch fatal error:", e);
        }
    }
}