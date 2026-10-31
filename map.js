// Leaflet map with high-accuracy GPS tracking.
// Uses the `leaflet` dependency (bundled by Vite) and CARTO tiles, both already allowed by public/_headers CSP.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [36.8065, 10.1815]; // Tunis, used until GPS gives a fix
const MAX_ACCEPTED_ACCURACY_M = 100;       // ignore coarse (cell/IP) fixes once a good fix exists
const SMOOTHING = 0.35;                    // 0..1, weight of the newest fix (reduces GPS jitter)

const statusEl = document.getElementById('gps-status');
const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

const map = L.map('map', { zoomControl: true }).setView(DEFAULT_CENTER, 14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);

// circleMarker needs no image assets (avoids Leaflet's default icon path issues under Vite/CSP).
const marker = L.circleMarker(DEFAULT_CENTER, { radius: 8, weight: 3, color: '#fff', fillColor: '#1a73e8', fillOpacity: 1 });
const accuracyCircle = L.circle(DEFAULT_CENTER, { radius: 0, weight: 1, color: '#1a73e8', fillOpacity: 0.12 });

let best = null;      // smoothed position
let centered = false;

function onPosition({ coords, timestamp }) {
    const { latitude, longitude, accuracy } = coords;
    // Drop coarse readings once we already hold a precise one.
    if (best && accuracy > MAX_ACCEPTED_ACCURACY_M && accuracy > best.accuracy) return;

    if (!best || accuracy < best.accuracy / 2) {
        best = { lat: latitude, lng: longitude, accuracy, timestamp }; // big accuracy jump: take it directly
    } else {
        const w = Math.min(1, SMOOTHING * (best.accuracy / Math.max(accuracy, 1)));
        best = {
            lat: best.lat + (latitude - best.lat) * w,
            lng: best.lng + (longitude - best.lng) * w,
            accuracy: Math.min(accuracy, best.accuracy * 1.1),
            timestamp,
        };
    }

    const point = [best.lat, best.lng];
    marker.setLatLng(point).addTo(map);
    accuracyCircle.setLatLng(point).setRadius(best.accuracy).addTo(map);
    if (!centered) { map.setView(point, accuracy <= 50 ? 17 : 15); centered = true; }
    setStatus(`GPS accuracy: ±${Math.round(best.accuracy)} m`);
    window.dispatchEvent(new CustomEvent('taxipic:position', { detail: { ...best } }));
}

function onError(err) {
    const messages = {
        1: 'Location permission denied. Enable GPS for accurate pickup.',
        2: 'Location unavailable. Move to an open area and try again.',
        3: 'Waiting for a GPS fix…',
    };
    setStatus(messages[err.code] || 'Unable to read location.');
}

if ('geolocation' in navigator) {
    setStatus('Locating…');
    navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true, // request GPS, not just Wi-Fi/cell
        maximumAge: 0,            // never reuse a cached fix
        timeout: 20000,
    });
} else {
    setStatus('This device does not support location.');
}

export { map };
