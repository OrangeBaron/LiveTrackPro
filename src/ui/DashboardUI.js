import { MapComponent } from '../components/MapComponent.js';
import { LayoutBuilder } from './LayoutBuilder.js';
import { ChartManager } from './ChartManager.js';
import { UIManager } from './UIManager.js';

export class DashboardUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.isInitialized = false;
        
        // Sotto-moduli
        this.layoutBuilder = new LayoutBuilder();
        this.chartManager = new ChartManager();
        this.uiManager = new UIManager();
        this.mapComponent = null; 
    }

    /**
     * Entry point: Avvia i vari gestori
     */
    async bootstrap() {
        if (this.isInitialized) return;
        
        // 1. Costruisci il Layout (DOM, CSS, Clean-up)
        await this.layoutBuilder.init();
        
        // 2. Inizializza Componenti Grafici
        this.mapComponent = new MapComponent('map-container');
        this.mapComponent.init();

        this.chartManager.init();
        
        // 3. Sottoscrizione dati
        this.dataManager.subscribe(data => this.refresh(data));
        
        this.isInitialized = true;
        console.log("LiveTrackPro: UI Modules Loaded & Ready.");

        // Se ci sono già dati, forza un refresh
        if (this.dataManager.hasReceivedLive) {
            this.dataManager.notify(); 
        }
    }

    /**
     * Dispatch dei dati ai sotto-moduli
     */
    refresh(data) {
        const { live, course, stats, hrZones, powerZones } = data;

        // Aggiorna metriche testuali
        this.uiManager.update(live, stats);

        // Aggiorna Mappa
        if (this.mapComponent) {
            this.mapComponent.update(live, course);
        }

        // Aggiorna Grafici
        this.chartManager.update(live, course, hrZones, powerZones);
    }
}