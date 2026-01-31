import { DataManager } from './managers/DataManager.js';
import { DashboardUI } from './ui/DashboardUI.js';

console.log("LiveTrackPro: Core System initializing (Modules)...");

const dataManager = new DataManager();
const dashboard = new DashboardUI(dataManager);

// Stato interno per gestire il fetch forzato
let capturedCsrfToken = null;
let historyFetched = false;

// --- FUNZIONE DI RECUPERO STORICO ---
async function forceHistoryFetch(tokenCsrf) {
    if (historyFetched) return; // Eseguiamo una volta sola
    historyFetched = true;

    console.log("🚀 LiveTrackPro: Avvio recupero storico forzato...");

    // 1. Estrazione Parametri URL
    const pathParts = window.location.pathname.split('/');
    const sessionIndex = pathParts.indexOf('session');
    
    if (sessionIndex === -1 || pathParts.length <= sessionIndex + 1) {
        console.warn("LiveTrackPro: Session ID non trovato, skip storico.");
        return;
    }
    const sessionId = pathParts[sessionIndex + 1];

    const urlParams = new URLSearchParams(window.location.search);
    let tokenUrl = urlParams.get('token');
    if (!tokenUrl) {
        const tokenIndex = pathParts.indexOf('token');
        if (tokenIndex !== -1 && pathParts.length > tokenIndex + 1) {
            tokenUrl = pathParts[tokenIndex + 1];
        }
    }

    // 2. Costruzione URL API
    let apiUrl = `https://livetrack.garmin.com/api/sessions/${sessionId}/track-points/common`;
    if (tokenUrl) apiUrl += `?token=${tokenUrl}`;

    try {
        // Usiamo originalFetch per evitare di triggerare nuovamente il nostro interceptor
        const response = await window.originalFetch(apiUrl, {
            method: "GET",
            headers: {
                "livetrack-csrf-token": tokenCsrf,
                "accept": "application/json",
                "priority": "u=1, i"
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`🎉 LiveTrackPro: Storico scaricato (${data.trackPoints?.length || 0} punti). Inserimento...`);
            
            // Inietta i dati nel gestore esistente
            dataManager.ingestLive(data);
            
            // Se la dashboard non è attiva, attivala ora
            if (!dashboard.isInitialized) {
                dashboard.bootstrap();
            }
        } else {
            console.warn(`LiveTrackPro: Errore API Storico: ${response.status}`);
        }
    } catch (e) {
        console.error("LiveTrackPro: Errore fetch storico:", e);
    }
}

// --- INTERCEPTOR FETCH ---
// Salviamo il riferimento originale globale
window.originalFetch = window.fetch;

window.fetch = function(...args) {
    // args[0] è l'URL, args[1] sono le opzioni (headers, method, etc.)
    
    // 1. SNIFFING DEL CSRF TOKEN (Analisi della Richiesta)
    if (!capturedCsrfToken && args[1] && args[1].headers) {
        // Gli headers possono essere un oggetto semplice o un oggetto Headers
        let token = null;
        if (args[1].headers instanceof Headers) {
            token = args[1].headers.get('livetrack-csrf-token');
        } else {
            // Cerca case-insensitive nell'oggetto
            const keys = Object.keys(args[1].headers);
            const key = keys.find(k => k.toLowerCase() === 'livetrack-csrf-token');
            if (key) token = args[1].headers[key];
        }

        if (token) {
            capturedCsrfToken = token;
            console.log("LiveTrackPro: CSRF Token catturato:", token);
            // Appena abbiamo il token, lanciamo il fetch dello storico
            forceHistoryFetch(token); 
        }
    }

    const responsePromise = window.originalFetch.apply(this, args);
    
    // 2. ANALISI DELLA RISPOSTA
    try {
        const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
        
        // --- Gestione Course ---
        if (url.includes('courses')) {
            responsePromise.then(res => {
                if (res.ok) {
                    res.clone().json()
                        .then(data => {
                            dataManager.ingestCourse(data);
                        })
                        .catch(e => console.warn("LiveTrackPro: Course parse error", e));
                }
            }).catch(() => {});
        }

        // --- Gestione Live Track ---
        if (url.includes('track-points/common')) {
            responsePromise.then(res => {
                if (res.ok) {
                    res.clone().json()
                        .then(data => {
                            dataManager.ingestLive(data);
                            
                            if (dataManager.hasReceivedLive && !dashboard.isInitialized) {
                                dashboard.bootstrap();
                            }
                        })
                        .catch(e => console.warn("LiveTrackPro: Live points parse error", e));
                }
            }).catch(() => {});
        }

    } catch (e) {
        console.warn("LiveTrackPro: Interceptor error", e);
    }
    
    return responsePromise;
};