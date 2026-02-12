import { CONFIG } from '../config.js';
import { DASHBOARD_TEMPLATE } from './DashboardTemplate.js';

export class LayoutBuilder {
    
    async init() {
        await this._loadResources();
        const meta = this._extractPageMetadata();
        this._cleanOriginalUI();
        this._renderStructure(meta);
        return meta;
    }

    _loadResources() {
        const head = document.head;
        CONFIG.css.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = href;
            head.appendChild(link);
        });

        const scripts = CONFIG.libs.map(src => {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src; s.onload = resolve; s.onerror = reject;
                head.appendChild(s);
            });
        });
        return Promise.all(scripts);
    }

    _extractPageMetadata() {
        try {
            const nameEl = document.querySelector("div[class*='AthleteDetails'] strong") 
                        || document.querySelector("strong[id*=':r']");
            const sessionEl = document.querySelector("div[class*='SessionInfo'] span[title]");
            return {
                name: nameEl ? nameEl.innerText.trim() : 'Live Track Pro',
                info: sessionEl ? sessionEl.getAttribute('title') : 'Analytics'
            };
        } catch (e) {
            return { name: 'Live Track Pro', info: 'Analytics' };
        }
    }

    _cleanOriginalUI() {
        Array.from(document.body.children).forEach(child => {
            if (child.tagName !== 'SCRIPT') child.style.display = 'none';
        });
    }

    _renderStructure(meta) {
        const container = document.createElement('div');
        container.id = 'livetrack-pro-dashboard';
        
        const metricsHtml = this._buildMetricsHtml();
        const summaryHtml = this._buildSummaryHtml();

        let finalHtml = DASHBOARD_TEMPLATE
            .replace('{{ATHLETE_NAME}}', meta.name)
            .replace('{{SESSION_INFO}}', meta.info)
            .replace('{{METRICS_GRID}}', metricsHtml)
            .replace('{{SUMMARY_BAR}}', summaryHtml)
            .replace('{{COLOR_WPRIME}}', CONFIG.colors.wPrime)
            .replace('{{COLOR_EFFICIENCY}}', CONFIG.colors.efficiency);

        container.innerHTML = finalHtml;
        document.body.appendChild(container);
    }

    // --- HTML Generators Helpers ---

    _createMetricBox(id, label, unit, colorClass) {
        return `<div class="ltp-metric-box ${colorClass}">
            <div class="ltp-metric-label">${label}</div>
            <div class="ltp-metric-value-group">
                <span id="live-${id}" class="ltp-value">--</span>
                <span class="ltp-unit">${unit}</span>
            </div>
        </div>`;
    }

    _createSummaryItem(id, label, unit) {
        return `<div class="ltp-summary-item">
            <div class="ltp-summary-label">${label}</div>
            <div>
                <span id="summary-${id}" class="ltp-summary-value">--</span>
                <span class="ltp-summary-unit">${unit}</span>
            </div>
        </div>`;
    }

    _buildMetricsHtml() {
        return [
            this._createMetricBox('speed', 'Speed', 'km/h', 'border-blue'),
            this._createMetricBox('power', 'Power', 'W', 'border-orange'),
            this._createMetricBox('hr', 'Heart Rate', 'bpm', 'border-red'),
            this._createMetricBox('cadence', 'Cadence', 'rpm', 'border-purple'),
            this._createMetricBox('gradient', 'Gradient', '%', 'border-grad'),
            this._createMetricBox('vam', 'V.A.M.', 'm/h', 'border-vam')
        ].join('');
    }

    _buildSummaryHtml() {
        return [
            this._createSummaryItem('time', 'Time', ''),
            this._createSummaryItem('distance', 'Distance', 'km'),
            this._createSummaryItem('elevation', 'Ascent', 'm'),
            this._createSummaryItem('np', 'Norm. Pwr', 'W'),
            this._createSummaryItem('if', 'Intensity', 'IF'),
            this._createSummaryItem('tss', 'TSS', 'pts'),
            this._createSummaryItem('work', 'Work', 'kJ'),
            this._createSummaryItem('weather', 'Live Weather', '')
        ].join('');
    }
}