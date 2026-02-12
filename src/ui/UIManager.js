import { ViewHelpers } from './ViewHelpers.js';

export class UIManager {
    
    update(live, stats) {
        if (!live || live.length === 0) return;
        
        const lastPoint = live[live.length - 1];
        
        this._updateStatusLog(lastPoint, live.length);
        this._updateLiveMetrics(lastPoint, stats);
        this._updateSummaryBar(stats);
    }

    _updateStatusLog(lastPoint, count) {
        const timeStr = ViewHelpers.formatTime(lastPoint.dateTime);
        const el = document.getElementById('status-log');
        if (el) el.innerHTML = `<strong>UPDATED:</strong> ${timeStr} &bull; <strong>PTS:</strong> ${count}`;
    }

    _updateLiveMetrics(p, stats) {
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('live-speed', p.speed ? ViewHelpers.formatNumber(p.speed * 3.6, 1) : '-');
        setTxt('live-power', ViewHelpers.formatInt(p.powerWatts));
        setTxt('live-cadence', ViewHelpers.formatInt(p.cadenceCyclesPerMin));
        setTxt('live-hr', ViewHelpers.formatInt(p.heartRateBeatsPerMin));
        
        setTxt('live-gradient', ViewHelpers.formatNumber(stats?.gradient, 1));
        setTxt('live-vam', ViewHelpers.formatInt(stats?.vam));
    }

    _updateSummaryBar(stats) {
        if (!stats) return;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('summary-time', stats.duration);
        setTxt('summary-distance', stats.distance);
        setTxt('summary-elevation', stats.elevationGain ? `+${Math.round(stats.elevationGain)}` : '0');
        
        setTxt('summary-np', ViewHelpers.formatInt(stats.np));
        setTxt('summary-if', stats.if);
        setTxt('summary-tss', ViewHelpers.formatInt(stats.tss));
        setTxt('summary-work', ViewHelpers.formatInt(stats.workKj));

        const weatherEl = document.getElementById('summary-weather');
        if (weatherEl) {
            weatherEl.innerHTML = ViewHelpers.getWeatherHtml(stats.weather);
        }
    }
}