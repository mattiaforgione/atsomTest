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

            // 1. Individual position: Check for properties first, then hardcoded, then calculated
            let labelPoint;
            if (feature.properties.label_lat && feature.properties.label_lng) {
                labelPoint = L.latLng(feature.properties.label_lat, feature.properties.label_lng);
            } else if (STIBM_LABEL_POINTS[zone]) {
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
                iconAnchor: [30, 15] // Centered anchor for better scaling appearance
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

    // Initial visibility and scale check
    updateStibmVisibility(map);
    updateStibmLabelScale(map);

    // Zoom listener for scaling
    map.on('zoomend', () => {
        updateStibmLabelScale(map);
        updateStibmVisibility(map);
    });
}

/**
 * Updates the font size of STIBM labels based on zoom level.
 * @param {L.Map} map 
 */
function updateStibmLabelScale(map) {
    const zoom = map.getZoom();
    // Base size 26px at zoom 13.
    // Scale down by 4px for every zoom level below 13.
    let fontSize = 26;
    if (zoom < 13) {
        fontSize = Math.max(8, 26 - (13 - zoom) * 4);
    } else if (zoom > 13) {
        // Grow slightly if zoomed in more (though usually hidden at zoom > 13)
        fontSize = 26 + (zoom - 13) * 5;
    }
    document.documentElement.style.setProperty('--stibm-label-size', fontSize + 'px');
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
            font-size: var(--stibm-label-size, 26px);
            font-weight: 900;
            color: #11335C;
            white-space: nowrap;
            letter-spacing: -1px;
            transition: font-size 0.2s ease;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Toggles visibility based on zoom level.
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
window.toggleStibmLayer = function (visible) {
    stibmVisible = visible;
    if (window.appMap) {
        updateStibmVisibility(window.appMap);
    }
};
