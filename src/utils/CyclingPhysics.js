export class CyclingPhysics {

    /**
     * Calcola il nuovo bilanciamento W' (Modello Skiba 2015)
     * Gestisce sia la fase di deplezione che di rigenerazione esponenziale.
     */
    static updateWPrimeBalance(currentBalance, power, dt, cp, wPrimeMax) {
        let newBalance = currentBalance;
        
        if (power > cp) {
            // Deplezione: stiamo consumando la batteria
            newBalance -= (power - cp) * dt;
        } else {
            // Rigenerazione: stiamo ricaricando
            const underP = cp - power;
            // Tau dinamico (costante di tempo variabile in base all'intensità del recupero)
            const tau = 546 * Math.exp(-0.01 * underP) + 316;
            
            const wPrimeExpended = wPrimeMax - currentBalance;
            const newWPrimeExpended = wPrimeExpended * Math.exp(-dt / tau);
            
            newBalance = wPrimeMax - newWPrimeExpended;
        }

        // Clamp tra 0 e Max (non possiamo avere più del 100% o meno di 0)
        return Math.min(Math.max(newBalance, 0), wPrimeMax);
    }

    /**
     * Calcola le metriche di carico aggregato: NP, IF, TSS
     */
    static calculateStressMetrics(rollingPowerSum4, rollingCount, cp, durationSeconds) {
        if (rollingCount === 0) {
            return { np: 0, if: 0, tss: 0 };
        }

        // 1. Normalized Power (Media quartica)
        const np = Math.pow(rollingPowerSum4 / rollingCount, 0.25);
        
        // 2. Intensity Factor
        const intensityFactor = (cp > 0) ? np / cp : 0;
        
        // 3. TSS (Training Stress Score)
        // Formula: (sec * NP * IF) / (FTP * 3600) * 100
        let tss = 0;
        if (cp > 0 && durationSeconds > 0) {
            tss = (durationSeconds * np * intensityFactor) / (cp * 3600) * 100;
        }

        return { np, if: intensityFactor, tss };
    }

    /**
     * Calcola l'efficienza aerobica avanzata (Pw:Hr)
     * Include Shift Temporale (Lag), Filtro Coasting e Media Mobile.
     */
    static calculateEfficiency(points, currentIndex, lagSeconds = 30, windowSeconds = 60) {
        const currentP = points[currentIndex];
        const pTimeMs = new Date(currentP.dateTime).getTime();
        const lagMs = lagSeconds * 1000;
        const windowMs = windowSeconds * 1000;

        // 1. Troviamo la potenza ritardata (Shift Temporale)
        // La frequenza cardiaca è lenta a salire/scendere. Confrontiamo i battiti 
        // attuali con i watt che li hanno generati (es. 30 secondi fa).
        let shiftedPower = null;
        for (let k = currentIndex; k >= 0; k--) {
            const pastTime = new Date(points[k].dateTime).getTime();
            if (pTimeMs - pastTime >= lagMs) {
                shiftedPower = points[k].powerWatts;
                break;
            }
        }

        // 2. Calcolo Efficienza Istantanea e Filtraggio
        // Escludiamo le fasi di discesa (coasting) o Watt troppo bassi che "sporcano" la media
        const hr = currentP.heartRateBeatsPerMin || 0;
        if (shiftedPower !== null && shiftedPower >= 30 && hr > 60) {
            // Salviamo il dato istantaneo pulito come metrica temporanea
            currentP._instEff = shiftedPower / hr;
        } else {
            currentP._instEff = null;
        }

        // 3. Applichiamo la Media Mobile (Smoothing)
        // Aggreghiamo l'efficienza istantanea degli ultimi 'windowSeconds'
        let sumEff = 0;
        let countEff = 0;

        for (let k = currentIndex; k >= 0; k--) {
            const pastP = points[k];
            const pastTime = new Date(pastP.dateTime).getTime();
            
            // Se usciamo dalla finestra temporale impostata (es. ultimi 60 sec), ci fermiamo
            if (pTimeMs - pastTime > windowMs) break;
            
            // Accumuliamo solo i dati che hanno superato il filtro al punto 2
            if (pastP._instEff !== null && pastP._instEff !== undefined) {
                sumEff += pastP._instEff;
                countEff++;
            }
        }

        // 4. Validazione finale
        // Restituiamo il dato solo se abbiamo almeno un paio di campioni validi
        // nella nostra finestra temporale, altrimenti mostriamo un buco nel grafico (corretto).
        if (countEff >= 3) {
            return parseFloat((sumEff / countEff).toFixed(2));
        }
        
        return null;
    }

    /**
     * Analizza lo storico recente (fino a 30s indietro) per calcolare medie e delta
     * Utile per VAM, Gradiente e Potenza smooth.
     */
    static getRollingStats(points, currentIndex) {
        const currentP = points[currentIndex];
        const currentTime = new Date(currentP.dateTime).getTime();
        
        let sumPower = 0;
        let count = 0;
        let startIdx = currentIndex;

        // Loop all'indietro
        for (let j = currentIndex; j >= 0; j--) {
            const pastP = points[j];
            const timeDiff = (currentTime - new Date(pastP.dateTime).getTime()) / 1000;
            
            sumPower += (pastP.powerWatts || 0);
            count++;
            
            // Ci fermiamo se superiamo i 30 secondi
            if (timeDiff >= 30) { 
                startIdx = j; 
                break; 
            }
        }

        const pOld = points[startIdx];
        if (!pOld) {
             return { avgPower30s: 0, altOld: 0, distOld: 0, timeDeltaWindow: 1 };
        }

        return {
            avgPower30s: count > 0 ? sumPower / count : null,
            altOld: pOld.altitude || pOld.elevation || 0,
            distOld: pOld.totalDistanceMeters || 0, 
            timeDeltaWindow: (currentTime - new Date(pOld.dateTime).getTime()) / 1000
        };
    }
}