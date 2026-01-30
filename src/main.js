import { DataManager } from './managers/DataManager.js';
import { DashboardUI } from './ui/DashboardUI.js';

console.log("LiveTrackPro: Core System initializing (Modules)...");

const dataManager = new DataManager();
const dashboard = new DashboardUI(dataManager);

const originalFetch = window.fetch;
window.fetch = function(...args) {
    const responsePromise = originalFetch.apply(this, args);
    
    try {
        const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
        
        // Gestione Course
        if (url.includes('courses')) {
            responsePromise.then(res => {
                if (res.ok) {
                    res.clone().json()
                        .then(data => {
                            dataManager.ingestCourse(data);
                            if (dataManager.hasReceivedCourses && dataManager.hasReceivedLive && !dashboard.isInitialized) {
                                dashboard.bootstrap();
                            }
                        })
                        .catch(e => console.warn("LiveTrackPro: Course parse error", e));
                }
            }).catch(() => {});
        }

        // Gestione Live Track
        if (url.includes('track-points/common')) {
            responsePromise.then(res => {
                if (res.ok) {
                    res.clone().json()
                        .then(data => {
                            dataManager.ingestLive(data);
                            if (dataManager.hasReceivedCourses && dataManager.hasReceivedLive && !dashboard.isInitialized) {
                                dashboard.bootstrap();
                            }
                        })
                        .catch(e => console.warn("LiveTrackPro: Live points parse error", e));
                }
            }).catch(() => {});
        }

    } catch (e) {
        console.warn("LiveTrackPro: Interceptor error", e);
    }
    
    return responsePromise;
};