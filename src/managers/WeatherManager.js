import { CONFIG } from '../config.js';

export class WeatherManager {
    constructor(onUpdateCallback) {
        this.apiKey = CONFIG.weatherApiKey;
        this.lastUpdate = 0;
        this.weatherState = null;
        this.onUpdate = onUpdateCallback; // Funzione da chiamare quando il meteo cambia
        this.throttleTime = 15 * 60 * 1000; // 15 minuti
    }

    async update(lat, lon) {
        if (!this.apiKey) return;

        const now = Date.now();
        if (now - this.lastUpdate < this.throttleTime) return;

        try {
            console.log("LiveTrackPro: Fetching weather data...");
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&lang=it`);
            
            if (res.ok) {
                const data = await res.json();
                this.weatherState = {
                    temp: Math.round(data.main.temp),
                    description: data.weather[0].description,
                    icon: data.weather[0].icon,
                    windSpeed: Math.round(data.wind.speed * 3.6),
                    windDeg: data.wind.deg
                };
                this.lastUpdate = now;
                console.log("LiveTrackPro: Weather updated", this.weatherState);
                
                if (this.onUpdate) this.onUpdate(this.weatherState);
            }
        } catch (e) {
            console.warn("LiveTrackPro: Weather fetch failed", e);
        }
    }

    get current() {
        return this.weatherState;
    }
}