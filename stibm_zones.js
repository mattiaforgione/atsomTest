/**
 * STIBM Tariff Zones Overlay for Leaflet
 */

let stibmLayer = null;
let stibmVisible = true; // Flag for manual toggle

/**
 * Initializes the STIBM zones layer using pre-loaded GeoJSON data.
 * @param {L.Map} map - The Leaflet map instance.
 */
function initStibmZones(map) {
    if (stibmLayer) return;

    // Check if data is available (loaded via script tag)
    // Try window.stibmGeojsonData first, then fallback to global stibmGeojsonData
    const data = window.stibmGeojsonData || (typeof stibmGeojsonData !== 'undefined' ? stibmGeojsonData : null);

    if (!data) {
        console.warn('STIBM zones data not found. Check if ZoneSTIBM_data.js is loaded correctly.');
        return;
    }

    console.log('Initializing STIBM zones...', data.features.length, 'features found.');

    stibmLayer = L.layerGroup();

    const STIBM_LABEL_POINTS = {
        'Mi1': [45.461, 9.188],
        'Mi3': [45.525, 9.040],
        'Mi4': [45.495, 8.985],
        'Mi5': [45.480, 8.940],
        'Mi6': [45.485, 8.895],
        'Mi7': [45.465, 8.845]
    };

    // Zone Polygons and Labels
    L.geoJSON(data, {
        style: function (feature) {
            return {
                fillColor: feature.properties.color || '#cccccc',
                fillOpacity: 0.35,
                color: '#666666',
                weight: 1,
                interactive: true // Enabled for info screen
            };
        },
        onEachFeature: function (feature, layer) {
            const zone = feature.properties.name || '';

            // Check for hardcoded label position, fallback to calculated
            let labelPoint;
            if (STIBM_LABEL_POINTS[zone]) {
                labelPoint = L.latLng(STIBM_LABEL_POINTS[zone]);
            } else {
                const bounds = layer.getBounds();
                const west = bounds.getWest();
                const east = bounds.getEast();
                const labelLng = west + (east - west) * 0.15;
                const centerLat = bounds.getCenter().lat;
                labelPoint = L.latLng(centerLat, labelLng);
            }

            const labelIcon = L.divIcon({
                className: 'stibm-zone-label',
                html: `<span>${zone}</span>`,
                iconSize: [60, 30],
                iconAnchor: [-20, 1]
            });

            L.marker(labelPoint, { icon: labelIcon, interactive: false, zIndexOffset: -100 }).addTo(stibmLayer);

            // --- Info Modal Logic ---
            let mouseDownLatLng = null;

            layer.on('mousedown', (e) => {
                mouseDownLatLng = e.latlng;
            });

            layer.on('click', (e) => {
                if (!mouseDownLatLng) return;
                
                // Sensitivity: Calculate distance between press and release
                const moveDistance = e.latlng.distanceTo(mouseDownLatLng);
                
                // If moved more than 20 meters, it's likely a drag or zoom start
                if (moveDistance > 20) return;

                const zoneName = feature.properties.name || '';
                if (typeof window.openStibmInfo === 'function') {
                    window.openStibmInfo(zoneName);
                }
                
                // Reset
                mouseDownLatLng = null;
            });
        }
    }).addTo(stibmLayer);

    // CSS injection for labels
    injectStibmStyles();

    // Initial visibility check
    updateStibmVisibility(map);
}

/**
 * Helper to calculate a simple centroid of a coordinate array.
 */
function calculateCentroid(coords) {
    let latSum = 0, lngSum = 0;
    coords.forEach(c => { lngSum += c[0]; latSum += c[1]; });
    return [latSum / coords.length, lngSum / coords.length];
}

/**
 * Injects required CSS for zone labels.
 */
function injectStibmStyles() {
    if (document.getElementById('stibm-style')) return;
    const style = document.createElement('style');
    style.id = 'stibm-style';
    style.innerHTML = `
        .stibm-zone-label {
            background: none;
            border: none;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .stibm-zone-label span {
            font-size: 26px;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.3);
            text-shadow: 1px 1px 0px rgba(255, 255, 255, 0.4);
            white-space: nowrap;
            letter-spacing: -1px;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Toggles visibility based on zoom level (visible only if zoom <= 11).
 * @param {L.Map} map - The Leaflet map instance.
 */
function updateStibmVisibility(map) {
    if (!stibmLayer) return;
    const zoom = map.getZoom();
    
    // Show only if manual toggle is ON and zoom is <= 13
    if (stibmVisible && zoom <= 13) {
        if (!map.hasLayer(stibmLayer)) {
            map.addLayer(stibmLayer);
        }
    } else {
        if (map.hasLayer(stibmLayer)) {
            map.removeLayer(stibmLayer);
        }
    }
}

/**
 * Manually toggle STIBM layer visibility.
 * @param {boolean} visible 
 */
window.toggleStibmLayer = function(visible) {
    stibmVisible = visible;
    if (window.appMap) {
        updateStibmVisibility(window.appMap);
    }
};
