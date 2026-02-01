import { DataManager } from './managers/DataManager.js';
import { DashboardUI } from './ui/DashboardUI.js';
import { NetworkInterceptor } from './managers/NetworkInterceptor.js'; // Nuovo import

console.log("LiveTrackPro: Core System initializing...");

// 1. Istanzia i Moduli
const dataManager = new DataManager();
const dashboard = new DashboardUI(dataManager);
const network = new NetworkInterceptor();

// 2. Cablaggio Eventi (Wiring)
// Quando il network riceve dati Live, passali al DataManager
network.onLivePoints = (data) => {
    dataManager.ingestLive(data);
    
    // Se è la prima volta che riceviamo dati validi, avvia la UI
    if (dataManager.hasReceivedLive && !dashboard.isInitialized) {
        dashboard.bootstrap();
    }
};

// Quando il network riceve dati Course, passali al DataManager
network.onCoursePoints = (data) => {
    dataManager.ingestCourse(data);
};

// 3. Avvio Intercettazione
network.init();