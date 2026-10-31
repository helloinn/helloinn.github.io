// Leaflet map with high-accuracy GPS tracking.
// Uses the `leaflet` dependency (bundled by Vite) and CARTO tiles, both already allowed by public/_headers CSP.
// The map is created when the map view opens (index.html dispatches `taxipic:show-map`).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [36.8065, 10.1815]; // Tunis, used until GPS gives a fix
const MAX_ACCEPTED_ACCURACY_M = 100;       // ignore coarse (cell/IP) fixes once a good fix exists
const SMOOTHING = 0.35;                    // 0..1, weight of the newest fix (reduces GPS jitter)

const messages = {
    ar: { locating: 'جاري البحث عن موقعك...', found: 'تم تحديد موقعك! سيارات الأجرة متاحة.', accuracy: 'دقة GPS:', denied: 'تم رفض إذن الموقع. فعّل GPS لتحديد نقطة الالتقاء بدقة.', unavailable: 'الموقع غير متاح. انتقل إلى مكان مفتوح وحاول مرة أخرى.', waiting: 'في انتظار إشارة GPS…', unsupported: 'هذا الجهاز لا يدعم تحديد الموقع.', you: 'أنت هنا' },
    fr: { locating: 'Recherche de votre position...', found: 'Position trouvée ! Taxis disponibles.', accuracy: 'Précision GPS :', denied: 'Autorisation de localisation refusée. Activez le GPS pour une prise en charge précise.', unavailable: 'Position indisponible. Placez-vous dans un endroit dégagé et réessayez.', waiting: 'En attente du signal GPS…', unsupported: 'Cet appareil ne prend pas en charge la localisation.', you: 'Vous êtes ici' },
    en: { locating: 'Locating you...', found: 'Location found! Cabs available.', accuracy: 'GPS accuracy:', denied: 'Location permission denied. Enable GPS for accurate pickup.', unavailable: 'Location unavailable. Move to an open area and try again.', waiting: 'Waiting for a GPS fix…', unsupported: 'This device does not support location.', you: 'You are here' },
};
const t = () => messages[document.documentElement.lang] || messages.en;

const statusEl = document.getElementById('map-status');
const setStatus = (text, color = '#FFCC00') => { if (statusEl) { statusEl.textContent = text; statusEl.style.color = color; } };

const taxiIcon = L.divIcon({ html: '<div class="taxi-marker">🚕</div>', className: '', iconSize: [24, 24], iconAnchor: [12, 12] });

let map = null;
// circleMarker needs no image assets (avoids Leaflet's default icon path issues under Vite/CSP).
const marker = L.circleMarker(DEFAULT_CENTER, { radius: 8, weight: 3, color: '#090a0f', fillColor: '#FFCC00', fillOpacity: 1 });
const accuracyCircle = L.circle(DEFAULT_CENTER, { radius: 0, weight: 1, color: '#FFCC00', fillOpacity: 0.12 });
const nearbyTaxis = L.layerGroup();

function initMap() {
    if (map) return;
    map = L.map('leaflet-map', { zoomControl: false }).setView(DEFAULT_CENTER, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);
    [[36.81, 10.18], [36.80, 10.19], [36.82, 10.17]].forEach((p) => L.marker(p, { icon: taxiIcon }).addTo(map));
    nearbyTaxis.addTo(map);
}

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
    if (!centered) {
        map.flyTo(point, accuracy <= 50 ? 17 : 15);
        marker.bindPopup(t().you).openPopup();
        nearbyTaxis.clearLayers();
        L.marker([best.lat + 0.002, best.lng + 0.002], { icon: taxiIcon }).addTo(nearbyTaxis);
        L.marker([best.lat - 0.003, best.lng + 0.001], { icon: taxiIcon }).addTo(nearbyTaxis);
        centered = true;
    }
    setStatus(`${t().found} ${t().accuracy} ±${Math.round(best.accuracy)} m`, '#4CAF50');
    window.dispatchEvent(new CustomEvent('taxipic:position', { detail: { ...best } }));
}

function onError(err) {
    const text = t();
    const byCode = { 1: text.denied, 2: text.unavailable, 3: text.waiting };
    setStatus(byCode[err.code] || text.unavailable, err.code === 3 ? '#FFCC00' : '#ff4d4d');
}

let watchId = null;
function startTracking() {
    if (!('geolocation' in navigator)) { setStatus(t().unsupported, '#ff4d4d'); return; }
    if (watchId !== null) return;
    setStatus(t().locating);
    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true, // request GPS, not just Wi-Fi/cell
        maximumAge: 0,            // never reuse a cached fix
        timeout: 20000,
    });
}

window.addEventListener('taxipic:show-map', () => {
    initMap();
    setTimeout(() => map.invalidateSize(), 100);
});

document.getElementById('locate-btn').addEventListener('click', () => {
    initMap();
    if (best) {
        map.flyTo([best.lat, best.lng], best.accuracy <= 50 ? 17 : 15);
        setStatus(`${t().found} ${t().accuracy} ±${Math.round(best.accuracy)} m`, '#4CAF50');
    }
    startTracking();
});

export { map };
