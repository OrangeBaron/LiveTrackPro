// Funzione per calcolare le zone e la FC Max
function calculateZones(age, gender) {
    if (!age) return null;
    
    // Formula standard
    const maxHr = (gender === 'female' ? 226 : 220) - age;

    // Calcolo Zone
    return {
        maxHr: maxHr,
        limits: [
            Math.round(maxHr * 0.60),
            Math.round(maxHr * 0.70),
            Math.round(maxHr * 0.80),
            Math.round(maxHr * 0.90),
            maxHr
        ]
    };
}

// Aggiorna la UI con i calcoli in tempo reale
function updatePreview() {
    const age = parseInt(document.getElementById('age').value);
    const gender = document.getElementById('gender').value;

    const data = calculateZones(age, gender);
    const previewEl = document.getElementById('calc-max-hr');
    const zonesEl = document.getElementById('zones-preview');

    if (data) {
        previewEl.textContent = data.maxHr;
        
        // Genera la tabellina
        let html = '';
        const labels = ['Z1 (Recupero)', 'Z2 (Endurance)', 'Z3 (Tempo)', 'Z4 (Soglia)', 'Z5 (VO2Max)'];
        const prevLimits = [0, ...data.limits]; // Per mostrare i range

        data.limits.forEach((limit, i) => {
            // Percentuale inizio-fine
            const pctStart = (i === 0) ? '50' : (50 + i * 10);
            const pctEnd = 60 + i * 10;
            
            html += `
            <div class="zone-row">
                <span class="zone-label" style="color:${getZoneColor(i)}">Z${i+1}</span>
                <span>${labels[i]}</span>
                <span class="zone-range">
                    <small>${pctStart}%-${pctEnd}%</small> 
                    <strong>&le; ${limit} bpm</strong>
                </span>
            </div>`;
        });
        zonesEl.innerHTML = html;
    } else {
        previewEl.textContent = '--';
        zonesEl.innerHTML = '<p>Inserisci l\'età per vedere le zone.</p>';
    }
}

function getZoneColor(index) {
    const colors = ['#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'];
    return colors[index];
}

// Salva le opzioni
function saveOptions(e) {
    e.preventDefault();
    
    const age = parseInt(document.getElementById('age').value);
    const gender = document.getElementById('gender').value;
    const cp = parseInt(document.getElementById('cp').value);
    const wPrime = parseInt(document.getElementById('wPrime').value);

    if (!age || !cp || !wPrime) {
        alert("Per favore compila tutti i campi numerici.");
        return;
    }

    const calcData = calculateZones(age, gender);

    const settings = {
        age,
        gender,
        cp,
        wPrime,
        hrZones: calcData.limits // Salviamo l'array calcolato
    };

    chrome.storage.sync.set(settings, () => {
        const status = document.getElementById('status');
        
        // Mostra messaggio
        status.textContent = 'Impostazioni salvate!';
        status.style.opacity = '1';

        // Nascondi dopo 2 secondi
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => { status.textContent = ''; }, 300);
        }, 2000);
    });
}

// Ripristina le opzioni all'apertura
function restoreOptions() {
    chrome.storage.sync.get({
        age: 30,
        gender: 'male',
        cp: 250,
        wPrime: 20000
    }, (items) => {
        document.getElementById('age').value = items.age;
        document.getElementById('gender').value = items.gender;
        document.getElementById('cp').value = items.cp;
        document.getElementById('wPrime').value = items.wPrime;
        updatePreview();
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('options-form').addEventListener('submit', saveOptions);
document.getElementById('age').addEventListener('input', updatePreview);
document.getElementById('gender').addEventListener('change', updatePreview);