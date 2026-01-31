// Recupera le impostazioni dallo storage di Chrome
chrome.storage.sync.get({
    cp: 280,
    wPrime: 20000,
    hrZones: [135, 150, 165, 178, 200],
    owmKey: ''
}, (items) => {
    
    // 1. Inietta le configurazioni in un elemento DOM sicuro
    const dataScript = document.createElement('script');
    dataScript.id = 'ltp-user-settings';
    dataScript.type = 'application/json';
    dataScript.textContent = JSON.stringify(items);
    (document.head || document.documentElement).appendChild(dataScript);

    // 2. Inietta il modulo principale
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/main.js'); 
    script.type = 'module';
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    
    console.log("LiveTrackPro: Settings injected (JSON Mode) & Module loader started.");
});