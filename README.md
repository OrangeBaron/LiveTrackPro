# 🚴‍♂️ Live Track Pro

> **Stato del progetto:** 🚧 *Work in Progress (Alpha)* > **Obiettivo:** Creare la dashboard di telemetria definitiva per il ciclismo.

**Live Track Pro** è un'estensione per browser (Chrome/Edge) progettata per sovrapporsi e sostituire l'interfaccia standard di **Garmin LiveTrack**.

L'obiettivo è trasformare una semplice mappa di tracciamento in una **dashboard professionale di analisi in tempo reale**, offrendo metriche avanzate solitamente disponibili solo post-attività su software come GoldenCheetah o TrainingPeaks.

## ✨ Funzionalità Principali

Attualmente il sistema intercetta i dati grezzi inviati dal dispositivo Garmin e li rielabora per visualizzare:

### 📊 Dashboard Metriche

* **Dati Real-Time:** Velocità, Potenza (W), Cadenza (RPM), Frequenza Cardiaca (BPM).
* **Layout Responsivo:** Visualizzazione a griglia ottimizzata, con modalità a **due colonne** per schermi desktop.

### 🗺️ Mappa e Altimetria

* **Mappa Interattiva:** Tracciamento in tempo reale su base OpenStreetMap.
* **Confronto Traccia:** Visualizzazione simultanea della posizione reale vs. percorso pianificato (Course).
* **Profilo Altimetrico:** Grafico dell'elevazione sincronizzato con la posizione.

### 🧠 Analisi Fisiologica

Calcoli eseguiti in tempo reale nel browser basati sul modello dell'atleta:

* **W' Balance (Anaerobic Work Capacity):** Visualizzazione grafica della "batteria" anaerobica residua (Modello Skiba).
* **Efficiency Factor:** Monitoraggio del rapporto Potenza/Cuore (Decoupling) istantaneo.
* **Time in Zones:** Istogramma dinamico del tempo trascorso nelle 5 zone cardiache.

## 🛠️ Installazione

Poiché il progetto è in via di sviluppo, va installato manualmente:

1. Clona o [scarica](https://github.com/OrangeBaron/LiveTrackPro/archive/refs/heads/main.zip) questo repository.
2. Apri Chrome/Edge e vai su `chrome://extensions`.
3. Attiva la **Modalità sviluppatore** (in alto a destra).
4. Clicca su **Carica estensione non pacchettizzata** e seleziona la cartella del progetto.
5. Apri un link Garmin LiveTrack: la dashboard si caricherà automaticamente.

## ⚙️ Configurazione Atleta

Per far sì che i calcoli avanzati (W' e Zone) siano corretti, **devi inserire i tuoi dati fisiologici**.

Apri il file `src/config.js` e modifica la sezione `athlete`:

```javascript
athlete: {
    cp: 280,          // La tua Critical Power (Watt)
    wPrime: 20000,    // La tua W' (Joule)
    hrZones: [135, 150, 165, 178, 200] // Limiti superiori delle tue Zone HR (Z1-Z5)
}

```

## 🚀 Roadmap

Il progetto è in attiva evoluzione. I prossimi passi includono:

* [ ] Total Work e Total Time
* [ ] Normalized vs Average Power
* [ ] Intensity Factor
* [ ] Pendenza vs VAM
* [ ] Condizioni e previsioni meteo
* [ ] Sistema di avvisi in tempo reale
* [ ] Esportazione e replay delle attività passate

---

*Live Track Pro non è affiliato con Garmin Ltd. Questo è un progetto open-source sviluppato da appassionati per appassionati.*
