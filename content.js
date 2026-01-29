// Questo script viene eseguito appena inizia il caricamento della pagina
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
    this.remove(); // Rimuove il tag script dopo l'esecuzione per pulizia
};
(document.head || document.documentElement).appendChild(script);
console.log("LiveTrackPro: Script iniettato con successo.");