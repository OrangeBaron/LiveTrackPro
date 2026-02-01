# 🚴‍♂️ Live Track Pro

> **Dashboard di telemetria avanzata per ciclismo**

**Live Track Pro** è un'estensione per browser progettata per sovrapporsi e potenziare l'interfaccia standard di **Garmin LiveTrack**.

Trasforma la semplice mappa di tracciamento in una vera e propria **plancia di analisi in tempo reale** (stile ammiraglia), offrendo metriche professionali come TSS, Potenza Normalizzata, VAM, W' Balance e dati Meteo, solitamente disponibili solo post-attività.

## ✨ Funzionalità

Il sistema intercetta i dati grezzi dal dispositivo Garmin ed esegue calcoli complessi direttamente nel browser per visualizzare:

### ⚡️ Power & Energy Analytics

* **Metriche di Carico:** Calcolo in tempo reale di **NP** (Normalized Power), **IF** (Intensity Factor) **TSS** (Training Stress Score) e **Total Work** (kJ).
* **W' Balance:** Modello matematico (Skiba) della "batteria" anaerobica residua (Joule).
* **Efficienza:** Monitoraggio istantaneo del rapporto Potenza/Cuore (Decoupling).
* **Zone Distribution:** Doppio istogramma dinamico per analizzare il tempo trascorso nelle **7 Zone di Potenza** (Coggan) e nelle **5 Zone Cardiache** (Friel).

### 🏔️ Climbing Profile

* **VAM & Pendenza:** Grafico dedicato che incrocia la Velocità Ascensionale Media (m/h) con la pendenza attuale (%).
* **Dislivello:** Tracciamento del dislivello positivo accumulato (Elevation Gain) e profilo altimetrico completo.

### 🌤️ Ambiente & Contesto

* **Live Weather:** Integrazione con **OpenWeatherMap** per visualizzare temperatura, condizioni atmosferiche, direzione e intensità del vento sul punto esatto dell'atleta.
* **Mappa & Percorso:** Tracciamento su base OpenStreetMap con confronto visivo tra posizione reale e traccia pianificata (Course).
* **Race Timer:** Tempo totale trascorso dall'inizio dell'attività.

### 📊 Dashboard UI

* **Layout Responsivo:** Interfaccia a griglia ottimizzata, con "Summary Bar" per i totali e grafici dettagliati.
* **Cockpit View:** I dati critici (Watt, VAM, Pendenza, Vento) sono sempre in primo piano.

## 🛠️ Installazione

1. Clona o [scarica](https://github.com/OrangeBaron/LiveTrackPro/archive/refs/heads/main.zip) questo repository.
2. Apri Chrome/Edge e vai su `chrome://extensions`.
3. Attiva la **Modalità sviluppatore** (in alto a destra).
4. Clicca su **Carica estensione non pacchettizzata** e seleziona la cartella del progetto.

## ⚙️ Configurazione

Per garantire la precisione dei calcoli fisiologici (W', Zone, IF) e attivare il meteo, è necessario configurare l'estensione:

1. Clicca sull'icona dell'estensione **Live Track Pro** nella barra del browser.
2. Inserisci i tuoi parametri:
   * **Dati Atleta:** FC Max, CP (Critical Power), W' (Anaerobic Capacity).
   * **API Key:** Inserisci la tua chiave gratuita di [OpenWeatherMap](https://openweathermap.org/) per i dati meteo.
3. Clicca su **Salva**.

Una volta configurato, apri un qualsiasi link Garmin LiveTrack: la dashboard si caricherà automaticamente.

## 🚀 Roadmap

Funzionalità pianificate per i prossimi rilasci:

* [ ] Sistema di esportazione dati (.fit/.gpx)
* [ ] Modalità Replay per analisi post-gara
* [ ] Avvisi visivi personalizzabili (es. "Eat Now", "W' Low")

---

*Live Track Pro non è affiliato con Garmin Ltd. Questo è un progetto open-source sviluppato da appassionati per appassionati.*
