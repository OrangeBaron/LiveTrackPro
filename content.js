const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/main.js'); 
script.type = 'module';
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);
console.log("LiveTrackPro: Module loader injected.");