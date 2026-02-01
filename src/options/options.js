// Calcola le zone basandosi semplicemente sulla FC Max inserita
function calculateZones(maxHr) {
    if (!maxHr) return null;
    
    return {
        maxHr: maxHr,
        limits: [
            Math.round(maxHr * 0.60), // Limite Z1
            Math.round(maxHr * 0.70), // Limite Z2
            Math.round(maxHr * 0.80), // Limite Z3
            Math.round(maxHr * 0.90), // Limite Z4
            parseInt(maxHr)           // Limite Z5 (Max)
        ]
    };
}

function updatePreview() {
    const maxHrInput = document.getElementById('maxHr').value;
    const maxHr = parseInt(maxHrInput);
    const zonesEl = document.getElementById('zones-preview');

    if (maxHr && maxHr > 100) {
        const data = calculateZones(maxHr);
        let html = '';
        const labels = ['Z1 (Recupero)', 'Z2 (Endurance)', 'Z3 (Tempo)', 'Z4 (Soglia)', 'Z5 (VO2Max)'];
        
        data.limits.forEach((limit, i) => {
            const pctStart = (i === 0) ? '0' : (50 + i * 10); 
            const pctEnd = 60 + i * 10;
            
            html += `
            <div class="zone-row">
                <span class="zone-label" style="color:${getZoneColor(i)}">Z${i+1}</span>
                <span>${labels[i]}</span>
                <span class="zone-range">
                    <strong>&le; ${limit} bpm</strong>
                </span>
            </div>`;
        });
        zonesEl.innerHTML = html;
    } else {
        zonesEl.innerHTML = '<p class="info-text" style="color:#e74c3c">Inserisci una FC Max valida (es. 185) per vedere le zone.</p>';
    }
}

function getZoneColor(index) {
    const colors = ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'];
    return colors[index];
}

function saveOptions(e) {
    e.preventDefault();
    const maxHr = parseInt(document.getElementById('maxHr').value);
    const cp = parseInt(document.getElementById('cp').value);
    const wPrime = parseInt(document.getElementById('wPrime').value);
    const owmKey = document.getElementById('owmKey').value.trim();

    if (!maxHr || !cp || !wPrime) {
        alert("Per favore compila tutti i campi numerici (FC Max, CP, W').");
        return;
    }

    const zoneData = calculateZones(maxHr);
    
    // Salviamo maxHr e l'array hrZones calcolato
    const settings = {
        maxHr, 
        cp, 
        wPrime, 
        owmKey,
        hrZones: zoneData.limits
    };

    chrome.storage.sync.set(settings, () => {
        const status = document.getElementById('status');
        status.textContent = 'Impostazioni salvate!';
        status.style.opacity = '1';
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => { status.textContent = ''; }, 300);
        }, 2000);
    });
}

function restoreOptions() {
    chrome.storage.sync.get({
        maxHr: 185,
        cp: 250,
        wPrime: 20000,
        owmKey: ''
    }, (items) => {
        document.getElementById('maxHr').value = items.maxHr;
        document.getElementById('cp').value = items.cp;
        document.getElementById('wPrime').value = items.wPrime;
        document.getElementById('owmKey').value = items.owmKey;
        
        updatePreview();
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('options-form').addEventListener('submit', saveOptions);
document.getElementById('maxHr').addEventListener('input', updatePreview);