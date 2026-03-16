/**
 * TravelCompanion â€“ myATSOM
 * Modulo autonomo per la pianificazione e la guida dei viaggi con mezzi STAV.
 * Espone window.TravelCompanion = { open, close }
 *
 * Fix v2:
 *  - Usa bottom-sheet (mappa sempre visibile sopra)
 *  - GPS tramite getCurrentPosition al momento della ricerca (no intercept)
 *  - Timeline stile foto (nodi + linea laterale con label linea rotante)
 */
(function () {
    'use strict';

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // COSTANTI
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const TC_STORAGE_KEY = 'tc_active_trip';
    const TC_EXPIRE_MS = 60 * 60 * 1000; // 1 ora
    const COLOR_WALK = '#888ea8';
    const COLOR_DEST = '#2ecc71';

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // STATO INTERNO
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let state = {
        phase: null,
        originCoords: null,
        destCoords: null,
        destLabel: '',
        originLabel: 'La tua posizione',
        selectedTrip: null,
        tcWalkPolyline: null,
        tcBusPolyline: null,
        tcMarkers: [],
        watchId: null,
        lastPositions: [],
        alightAlerted: false,
        arrivedAlerted: false,
        resumeBannerTimer: null,
        _tripStartedAt: null,
    };

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // UTILITY
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Toast non bloccante
    function showToast(msg, duration = 3500) {
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:calc(68vh + 12px);left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.82);color:#fff;padding:10px 18px;border-radius:12px;font-size:0.88rem;z-index:9999;pointer-events:none;max-width:calc(100vw - 40px);text-align:center;transition:opacity 0.3s;';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, duration);
    }

    function minsToHHMM(totalMins) {
        const h = Math.floor(totalMins / 60) % 24;
        const m = totalMins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function timeStrToMins(t) {
        if (!t || !t.includes(':')) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    function nowMins() {
        const n = new Date();
        return n.getHours() * 60 + n.getMinutes();
    }

    function decodePolyline(str, precision = 5) {
        let idx = 0, lat = 0, lng = 0, coords = [];
        const factor = Math.pow(10, precision);
        while (idx < str.length) {
            let b, shift = 0, result = 0;
            do { b = str.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            const dLat = (result & 1) ? ~(result >> 1) : result >> 1;
            shift = result = 0;
            do { b = str.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            const dLng = (result & 1) ? ~(result >> 1) : result >> 1;
            lat += dLat; lng += dLng;
            coords.push([lat / factor, lng / factor]);
        }
        return coords;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GPS â€“ cattura posizione attuale (no intercept di watchPosition)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) { reject(new Error('Geolocation non disponibile')); return; }
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                err => reject(err),
                { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
            );
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ROUTING a piedi â€“ OSRM
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function fetchWalkingRoute(fromLat, fromLng, toLat, toLng) {
        try {
            const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`;
            const r = await fetch(url);
            if (!r.ok) throw new Error('OSRM ' + r.status);
            const data = await r.json();
            if (data.routes && data.routes[0]) {
                const route = data.routes[0];
                return {
                    durationMins: Math.round(route.duration / 60),
                    distanceM: Math.round(route.distance),
                    coords: decodePolyline(route.geometry, 5)
                };
            }
        } catch (e) {
            console.warn('OSRM fallback:', e);
        }
        const km = haversineKm(fromLat, fromLng, toLat, toLng);
        return { durationMins: Math.max(1, Math.round(km / 5 * 60)), distanceM: Math.round(km * 1000), coords: [[fromLat, fromLng], [toLat, toLng]] };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // NOMINATIM
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let _nomDebounce = null;

    async function searchNominatim(query) {
        const params = new URLSearchParams({
            q: query, format: 'json', addressdetails: '1', limit: '5',
            countrycodes: 'it', 'accept-language': 'it',
        });
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': 'myATSOM-app/2.0' } });
            if (!r.ok) return [];
            return await r.json();
        } catch (e) { return []; }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // TIPO GIORNO
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function getTodayDayTypeTC() {
        const today = new Date();
        const day = today.getDay();
        const school = new Date('2026-06-08T00:00:00');
        if (day === 0) return 'festivo';
        if (day === 6) return today >= school ? 'sabato_non_scolastico' : 'sabato_scolastico';
        return today >= school ? 'feriale_non_scolastico' : 'feriale_scolastico';
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ROUTING BUS  
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function findRoutes(originCoords, destCoords) {
        const stops = stavData.stops;
        const { lat: oLat, lng: oLng } = originCoords;
        const { lat: dLat, lng: dLng } = destCoords;

        const boardCandidates = stops
            .filter(s => s.lat && s.lng)
            .map(s => ({ ...s, d: haversineKm(oLat, oLng, s.lat, s.lng) }))
            .filter(s => s.d < 3)
            .sort((a, b) => a.d - b.d)
            .slice(0, 20);

        const alightCandidates = stops
            .filter(s => s.lat && s.lng)
            .map(s => ({ ...s, d: haversineKm(dLat, dLng, s.lat, s.lng) }))
            .filter(s => s.d < 2)
            .sort((a, b) => a.d - b.d)
            .slice(0, 10);

        if (!boardCandidates.length || !alightCandidates.length) return [];

        const aSet = new Set(alightCandidates.map(s => s.id));
        const now = nowMins();
        const solutions = [];
        const todayType = getTodayDayTypeTC();

        for (const line of stavData.lines) {
            const trips = line.dayTypes[todayType] || [];
            for (const trip of trips) {
                const stopIds = trip.stops.map(s => s.stopId);
                for (const board of boardCandidates) {
                    const boardIdx = stopIds.indexOf(board.id);
                    if (boardIdx < 0) continue;
                    for (let ai = boardIdx + 1; ai < stopIds.length; ai++) {
                        if (!aSet.has(stopIds[ai])) continue;
                        const alightStop = alightCandidates.find(s => s.id === stopIds[ai]);
                        if (!alightStop) continue;
                        const boardTime = timeStrToMins(trip.stops[boardIdx].time);
                        const alightTime = timeStrToMins(trip.stops[ai].time);
                        if (boardTime < now - 5) continue;
                        solutions.push({
                            line, tripId: trip.tripId,
                            boardStop: board, alightStop,
                            boardIdx, alightIdx: ai,
                            boardTime, alightTime,
                            stopsCount: ai - boardIdx,
                            busMins: alightTime - boardTime,
                        });
                        break;
                    }
                    break;
                }
            }
        }

        if (!solutions.length) return [];
        solutions.sort((a, b) => a.boardTime - b.boardTime);

        // Prendi le prime 2 soluzioni distinte (linee diverse o partenze distanziate)
        const best = [];
        for (const s of solutions) {
            if (best.length >= 2) break;
            const isDup = best.some(b => b.line.id === s.line.id && Math.abs(b.boardTime - s.boardTime) < 5);
            if (!isDup) best.push(s);
        }

        return await Promise.all(best.map(async s => {
            const [ws, we] = await Promise.all([
                fetchWalkingRoute(oLat, oLng, s.boardStop.lat, s.boardStop.lng),
                fetchWalkingRoute(s.alightStop.lat, s.alightStop.lng, dLat, dLng),
            ]);
            const departMins = s.boardTime - ws.durationMins;
            const arriveTime = s.alightTime + we.durationMins;
            return {
                ...s,
                walkToStopMins: ws.durationMins,
                walkToStopCoords: ws.coords,
                walkToDestMins: we.durationMins,
                walkToDestCoords: we.coords,
                departTime: minsToHHMM(Math.max(now, departMins)),
                arriveTime: minsToHHMM(arriveTime),
                totalMins: Math.max(1, arriveTime - now),
            };
        }));
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // RENDER TIMELINE â€“ stile foto (linea verticale con label linea laterale)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function renderTimeline(containerId, trip) {
        const c = document.getElementById(containerId);
        if (!c) return;
        const lc = trip.line.color || '#e67e22';
        const ltc = trip.line.txColor || '#fff';

        c.innerHTML = `
        <div class="tc-tl">
            <!-- Nodo 1: posizione -->
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node" style="border-color:${COLOR_WALK}"></div>
                    <div class="tc-tl-vline" style="background:${COLOR_WALK}"></div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">${state.originLabel}</div>
                    <div class="tc-tl-desc">Cammina per ${trip.walkToStopMins} min</div>
                </div>
            </div>
            <!-- Nodo 2: fermata di salita -->
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node" style="border-color:${lc}"></div>
                    <div class="tc-tl-vline" style="background:${lc}">
                        <span class="tc-tl-linelabel" style="color:${lc}">${trip.line.id}</span>
                    </div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">Fermata di partenza</div>
                    <div class="tc-tl-name tc-tl-name-stop">${trip.boardStop.name}</div>
                    <div class="tc-tl-desc">Scendi dopo ${trip.stopsCount} fermate e ${trip.busMins} minuti</div>
                </div>
            </div>
            <!-- Nodo 3: fermata di discesa -->
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node" style="border-color:${lc}"></div>
                    <div class="tc-tl-vline" style="background:${COLOR_WALK}"></div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">Fermata di arrivo</div>
                    <div class="tc-tl-name tc-tl-name-stop">${trip.alightStop.name}</div>
                    <div class="tc-tl-desc">Cammina per ${trip.walkToDestMins} min</div>
                </div>
            </div>
            <!-- Nodo 4: destinazione -->
            <div class="tc-tl-row tc-tl-row-last">
                <div class="tc-tl-left">
                    <div class="tc-tl-node" style="border-color:${COLOR_DEST}"></div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">${state.destLabel}</div>
                </div>
            </div>
        </div>`;
    }

    function renderGuidanceTimeline(containerId, trip, currentIdx) {
        const c = document.getElementById(containerId);
        if (!c) return;
        const lc = trip.line.color || '#e67e22';
        const rawTrip = getRawTrip(trip);
        if (!rawTrip) return;

        let html = '<div class="tc-tl">';

        // Walking to stop
        if (state.phase === 'walking_to_stop') {
            html += `
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node tc-tl-node-active" style="border-color:${COLOR_WALK}"></div>
                    <div class="tc-tl-vline" style="background:${COLOR_WALK}"></div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">${state.originLabel}</div>
                    <div class="tc-tl-desc tc-tl-desc-active">Cammina verso ${trip.boardStop.name}</div>
                </div>
            </div>
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node" style="border-color:${lc}"></div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">${trip.boardStop.name}</div>
                </div>
            </div>`;
        } else if (state.phase === 'on_bus') {
            // Bus stops
            html += `
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node" style="border-color:${lc}"></div>
                    <div class="tc-tl-vline" style="background:${lc}">
                        <span class="tc-tl-linelabel" style="color:${lc}">${trip.line.id}</span>
                    </div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">${trip.boardStop.name}</div>
                    <div class="tc-tl-desc">Fermata di salita</div>
                </div>
            </div>`;

            for (let i = trip.boardIdx + 1; i <= trip.alightIdx; i++) {
                const rawStop = rawTrip.stops[i];
                const sd = stavData.stops.find(fs => fs.id === rawStop.stopId);
                const name = sd ? sd.name : rawStop.stopId;
                const isAlight = i === trip.alightIdx;
                const isCurrent = i === currentIdx;
                const nodeColor = isAlight ? lc : (isCurrent ? '#fff' : lc);
                html += `
                <div class="tc-tl-row${isAlight ? ' tc-tl-row-alight' : ''}${isCurrent ? ' tc-tl-row-current' : ''}">
                    <div class="tc-tl-left">
                        <div class="tc-tl-node${isCurrent ? ' tc-tl-node-active' : ''}${!isAlight ? ' tc-tl-node-sm' : ''}" style="border-color:${nodeColor}"></div>
                        ${!isAlight ? `<div class="tc-tl-vline" style="background:${lc}"></div>` : ''}
                    </div>
                    <div class="tc-tl-body">
                        <div class="tc-tl-name" style="font-size:${isAlight ? '1rem' : '.9rem'}">${isAlight ? '&#128721; ' : ''}${name}</div>
                        <div class="tc-tl-desc">${rawStop.time}${isAlight ? ' &mdash; Scendi qui!' : ''}</div>
                    </div>
                </div>`;
            }
        } else if (state.phase === 'walking_to_dest') {
            html += `
            <div class="tc-tl-row">
                <div class="tc-tl-left">
                    <div class="tc-tl-node tc-tl-node-active" style="border-color:${COLOR_WALK}"></div>
                    <div class="tc-tl-vline" style="background:${COLOR_WALK}"></div>
                </div>
                <div class="tc-tl-body">
                    <div class="tc-tl-name">${trip.alightStop.name}</div>
                    <div class="tc-tl-desc tc-tl-desc-active">Cammina verso ${state.destLabel}</div>
                </div>
            </div>
            <div class="tc-tl-row tc-tl-row-last">
                <div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_DEST}"></div></div>
                <div class="tc-tl-body"><div class="tc-tl-name">${state.destLabel}</div></div>
            </div>`;
        }

        html += '</div>';
        c.innerHTML = html;
    }

    function getRawTrip(trip) {
        const line = trip.line;
        for (const day in line.dayTypes) {
            const found = line.dayTypes[day].find(t => t.tripId === trip.tripId);
            if (found) return found;
        }
        return null;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // MAP HELPERS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function clearTCmap() {
        const map = window.appMap;
        if (!map) return;
        if (state.tcWalkPolyline && map.hasLayer(state.tcWalkPolyline)) map.removeLayer(state.tcWalkPolyline);
        if (state.tcBusPolyline && map.hasLayer(state.tcBusPolyline)) map.removeLayer(state.tcBusPolyline);
        state.tcMarkers.forEach(m => { try { map.removeLayer(m); } catch (e) { } });
        state.tcWalkPolyline = null;
        state.tcBusPolyline = null;
        state.tcMarkers = [];
    }

    function drawWalkRoute(coords, color = '#2980b9') {
        clearTCmap();
        const map = window.appMap;
        if (!map || !coords || coords.length < 2) return;
        state.tcWalkPolyline = L.polyline(coords, { color, weight: 5, opacity: 0.85, dashArray: '10 8', lineJoin: 'round' }).addTo(map);
        try { map.fitBounds(state.tcWalkPolyline.getBounds(), { padding: [60, 60] }); } catch (e) { }
    }

    function drawBusRoute(trip) {
        clearTCmap();
        const map = window.appMap;
        if (!map) return;
        const rawTrip = getRawTrip(trip);
        if (!rawTrip) return;
        const lc = trip.line.color || '#e67e22';
        const points = rawTrip.stops.slice(trip.boardIdx, trip.alightIdx + 1)
            .map(s => stavData.stops.find(fs => fs.id === s.stopId))
            .filter(Boolean).map(s => [s.lat, s.lng]);
        if (points.length < 2) return;
        state.tcBusPolyline = L.polyline(points, { color: lc, weight: 7, opacity: 0.95, lineJoin: 'round' }).addTo(map);
        points.forEach(p => {
            const mk = L.circleMarker(p, { radius: 6, color: lc, fillColor: '#fff', fillOpacity: 1, weight: 3 }).addTo(map);
            state.tcMarkers.push(mk);
        });
        try { map.fitBounds(state.tcBusPolyline.getBounds(), { padding: [60, 60] }); } catch (e) { }
    }

    function updateUserDot(lat, lng) {
        const map = window.appMap;
        if (!map) return;
        const existing = state.tcMarkers.find(m => m._isTCUserDot);
        if (existing) { existing.setLatLng([lat, lng]); return; }
        const icon = L.divIcon({
            className: '',
            html: '<div style="width:16px;height:16px;background:#0984e3;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(9,132,227,.7)"></div>',
            iconSize: [16, 16], iconAnchor: [8, 8],
        });
        const mk = L.marker([lat, lng], { icon, zIndexOffset: 2000 }).addTo(map);
        mk._isTCUserDot = true;
        state.tcMarkers.push(mk);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PANEL NAVIGATION  
    // Usa bottom-sheet: la mappa Ã¨ sempre visibile sopra.
    // In guidance mode il panel usa solo il pannello guidance (ancora bottom-sheet).
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function showSheet(open) {
        const panel = document.getElementById('tc-panel');
        if (!panel) return;
        if (open) {
            panel.classList.remove('hidden');
            // piccolo delay per triggerare la transizione CSS
            requestAnimationFrame(() => panel.classList.remove('tc-panel-closed'));
        } else {
            panel.classList.add('tc-panel-closed');
        }
    }

    function showStep(stepId) {
        ['tc-step1', 'tc-step2', 'tc-step3', 'tc-guidance'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== stepId);
        });
        showSheet(true);

        // Se Ã¨ guidance, abbassa il map peek del panel (pannello piÃ¹ piccolo per vedere piÃ¹ mappa)
        const panel = document.getElementById('tc-panel');
        if (panel) {
            panel.classList.toggle('tc-panel-guidance', stepId === 'tc-guidance');
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GUIDANCE ENGINE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function startGuidance(trip) {
        state.phase = 'walking_to_stop';
        state.selectedTrip = trip;
        state.alightAlerted = false;
        state.arrivedAlerted = false;
        state.lastPositions = [];

        showStep('tc-guidance');
        drawWalkRoute(trip.walkToStopCoords, '#2980b9');
        updateGuidanceUI();
        saveToStorage();

        if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
        if ('geolocation' in navigator) {
            state.watchId = navigator.geolocation.watchPosition(
                onPositionUpdate,
                err => console.warn('TC geo:', err),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    }

    function updateGuidanceUI() {
        const trip = state.selectedTrip;
        if (!trip) return;
        const phaseEl = document.getElementById('tc-phase-label');
        const instrEl = document.getElementById('tc-instruction');

        switch (state.phase) {
            case 'walking_to_stop':
                if (phaseEl) phaseEl.textContent = 'Prossimo passo:';
                if (instrEl) instrEl.textContent = `Cammina per ${trip.walkToStopMins} minuti verso ${trip.boardStop.name}. Segui il percorso.`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, -1);
                break;
            case 'on_bus':
                if (phaseEl) phaseEl.textContent = 'Sei sul bus!';
                if (instrEl) instrEl.textContent = `Linea ${trip.line.id} â†’ scendi a ${trip.alightStop.name}`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, trip.boardIdx);
                drawBusRoute(trip);
                break;
            case 'walking_to_dest':
                if (phaseEl) phaseEl.textContent = 'Prossimo passo:';
                if (instrEl) instrEl.textContent = `Cammina per ${trip.walkToDestMins} minuti verso ${state.destLabel}.`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, -1);
                drawWalkRoute(trip.walkToDestCoords, '#27ae60');
                break;
            case 'arrived':
                if (phaseEl) phaseEl.textContent = 'ðŸŽ‰ Sei arrivato!';
                if (instrEl) instrEl.textContent = `Benvenuto a ${state.destLabel}`;
                break;
        }
    }

    function onPositionUpdate(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const trip = state.selectedTrip;
        if (!trip) return;

        updateUserDot(lat, lng);
        state.lastPositions.push({ lat, lng, t: Date.now() });
        if (state.lastPositions.length > 6) state.lastPositions.shift();

        if (state.phase === 'walking_to_stop') {
            const distToStop = haversineKm(lat, lng, trip.boardStop.lat, trip.boardStop.lng) * 1000;
            if (distToStop < 60) {
                state.phase = 'on_bus';
                updateGuidanceUI();
                saveToStorage();
                return;
            }
            const instrEl = document.getElementById('tc-instruction');
            if (instrEl) {
                const paceMin = Math.max(1, Math.round(distToStop / 1000 / 5 * 60));
                instrEl.textContent = `Cammina circa ${paceMin} min verso ${trip.boardStop.name} (${Math.round(distToStop)} m)`;
            }
        } else if (state.phase === 'on_bus') {
            const distToAlight = haversineKm(lat, lng, trip.alightStop.lat, trip.alightStop.lng) * 1000;
            if (distToAlight < 400 && !state.alightAlerted) {
                state.alightAlerted = true;
                showAlightAlert(trip.alightStop.name, distToAlight);
            }
            if (distToAlight < 80) {
                state.phase = 'walking_to_dest';
                updateGuidanceUI();
                saveToStorage();
                return;
            }
            // Aggiorna fermata corrente nella timeline
            const rawTrip = getRawTrip(trip);
            if (rawTrip) {
                let closestIdx = trip.boardIdx, closestDist = Infinity;
                for (let i = trip.boardIdx; i <= trip.alightIdx; i++) {
                    const sd = stavData.stops.find(fs => fs.id === rawTrip.stops[i].stopId);
                    if (!sd) continue;
                    const d = haversineKm(lat, lng, sd.lat, sd.lng) * 1000;
                    if (d < closestDist) { closestDist = d; closestIdx = i; }
                }
                renderGuidanceTimeline('tc-guidance-timeline', trip, closestIdx);
            }
        } else if (state.phase === 'walking_to_dest') {
            const distToDest = haversineKm(lat, lng, state.destCoords.lat, state.destCoords.lng) * 1000;
            if (distToDest < 40 && !state.arrivedAlerted) {
                state.arrivedAlerted = true;
                state.phase = 'arrived';
                updateGuidanceUI();
                clearStorage();
                return;
            }
            const instrEl = document.getElementById('tc-instruction');
            if (instrEl) {
                const paceMin = Math.max(1, Math.round(distToDest / 1000 / 5 * 60));
                instrEl.textContent = `Cammina circa ${paceMin} min verso ${state.destLabel} (${Math.round(distToDest)} m)`;
            }
        }
    }

    function showAlightAlert(stopName, distM) {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
        const banner = document.createElement('div');
        banner.className = 'tc-alight-alert';
        banner.innerHTML = `<div class="tc-alight-icon">ðŸ””</div><div class="tc-alight-text"><strong>Scendi ora!</strong><br><span>${stopName} Ã¨ a ${Math.round(distM)} m</span></div><button class="tc-alight-dismiss">&times;</button>`;
        banner.querySelector('.tc-alight-dismiss').addEventListener('click', () => banner.remove());
        document.body.appendChild(banner);
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 15000);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // STORAGE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function saveToStorage() {
        try {
            const snap = state.selectedTrip ? {
                lineId: state.selectedTrip.line.id, tripId: state.selectedTrip.tripId,
                boardStopId: state.selectedTrip.boardStop.id, alightStopId: state.selectedTrip.alightStop.id,
                boardIdx: state.selectedTrip.boardIdx, alightIdx: state.selectedTrip.alightIdx,
                walkToStopMins: state.selectedTrip.walkToStopMins, walkToStopCoords: state.selectedTrip.walkToStopCoords,
                walkToDestMins: state.selectedTrip.walkToDestMins, walkToDestCoords: state.selectedTrip.walkToDestCoords,
                stopsCount: state.selectedTrip.stopsCount, busMins: state.selectedTrip.busMins,
            } : null;
            if (!state._tripStartedAt) state._tripStartedAt = Date.now();
            localStorage.setItem(TC_STORAGE_KEY, JSON.stringify({
                startedAt: state._tripStartedAt, phase: state.phase,
                originCoords: state.originCoords, originLabel: state.originLabel,
                destCoords: state.destCoords, destLabel: state.destLabel, tripSnapshot: snap,
            }));
        } catch (e) { }
    }

    function clearStorage() { try { localStorage.removeItem(TC_STORAGE_KEY); } catch (e) { } }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(TC_STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.startedAt > TC_EXPIRE_MS) { clearStorage(); return null; }
            return data;
        } catch (e) { return null; }
    }

    function reconstructTripFromSnapshot(snap) {
        const line = stavData.lines.find(l => l.id === snap.lineId);
        if (!line) return null;
        const boardStop = stavData.stops.find(s => s.id === snap.boardStopId);
        const alightStop = stavData.stops.find(s => s.id === snap.alightStopId);
        if (!boardStop || !alightStop) return null;
        return {
            line, tripId: snap.tripId, boardStop, alightStop, boardIdx: snap.boardIdx, alightIdx: snap.alightIdx,
            walkToStopMins: snap.walkToStopMins, walkToStopCoords: snap.walkToStopCoords,
            walkToDestMins: snap.walkToDestMins, walkToDestCoords: snap.walkToDestCoords,
            stopsCount: snap.stopsCount, busMins: snap.busMins
        };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // RESUME BANNER
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function checkResumeBanner() {
        const saved = loadFromStorage();
        if (!saved) return;
        const banner = document.getElementById('tc-resume-banner');
        if (!banner) return;
        banner.classList.remove('hidden');
        const remaining = TC_EXPIRE_MS - (Date.now() - saved.startedAt);
        state.resumeBannerTimer = setTimeout(() => { banner.classList.add('hidden'); clearStorage(); }, Math.max(0, remaining));

        document.getElementById('tc-resume-dismiss').onclick = () => { banner.classList.add('hidden'); clearStorage(); clearTimeout(state.resumeBannerTimer); };
        document.getElementById('tc-resume-continue').onclick = () => { banner.classList.add('hidden'); resumeFromSaved(saved, false); };
        document.getElementById('tc-resume-update').onclick = () => { banner.classList.add('hidden'); resumeFromSaved(saved, true); };
    }

    async function resumeFromSaved(saved, updatePosition) {
        state.originCoords = saved.originCoords; state.originLabel = saved.originLabel;
        state.destCoords = saved.destCoords; state.destLabel = saved.destLabel;
        state._tripStartedAt = saved.startedAt;
        const trip = saved.tripSnapshot ? reconstructTripFromSnapshot(saved.tripSnapshot) : null;
        if (!trip) { openTC(); showStep('tc-step1'); return; }
        state.selectedTrip = trip;
        openTC();

        if (updatePosition && 'geolocation' in navigator) {
            try {
                const { lat, lng } = await getCurrentLocation();
                const dBoard = haversineKm(lat, lng, trip.boardStop.lat, trip.boardStop.lng) * 1000;
                const dAlight = haversineKm(lat, lng, trip.alightStop.lat, trip.alightStop.lng) * 1000;
                const dDest = haversineKm(lat, lng, state.destCoords.lat, state.destCoords.lng) * 1000;
                if (dDest < 100) state.phase = 'arrived';
                else if (dAlight < 200) state.phase = 'walking_to_dest';
                else if (dBoard < 80) state.phase = 'on_bus';
                else state.phase = 'walking_to_stop';
            } catch (e) { state.phase = saved.phase; }
        } else { state.phase = saved.phase; }
        startGuidance(trip);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // OPEN / CLOSE
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function openTC() {
        showStep('tc-step1');
        const originInput = document.getElementById('tc-origin-input');
        if (originInput) originInput.value = 'La tua posizione';
    }

    function closeTC() {
        const panel = document.getElementById('tc-panel');
        if (panel) {
            panel.classList.add('tc-panel-closed');
            setTimeout(() => panel.classList.add('hidden'), 500);
        }
        if (state.phase !== 'walking_to_stop' && state.phase !== 'on_bus' && state.phase !== 'walking_to_dest') {
            if (state.watchId !== null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
            clearTCmap();
        }
    }

    function stopGuidance() {
        if (state.watchId !== null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
        state.phase = null;
        clearTCmap();
        clearStorage();
        closeTC();
    }

    /**
     * Pianifica un viaggio verso una destinazione specifica.
     * @param {Object} coords {lat, lng}
     * @param {string} label Nome della destinazione
     */
    function planTo(coords, label) {
        state.destCoords = coords;
        state.destLabel = label;
        
        // Apri il pannello e aggiorna l'input
        openTC();
        const destInput = document.getElementById('tc-dest-input');
        if (destInput) destInput.value = label;
        
        // Pulizia suggerimenti
        const suggList = document.getElementById('tc-dest-suggestions');
        if (suggList) suggList.classList.add('hidden');

        // Se l'origine non è impostata, proviamo a prenderla (come se avesse cliccato Cerca)
        // Ma per ora lasciamo che l'utente veda il passo 1 con la dest compilata.
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // INIT
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    document.addEventListener('DOMContentLoaded', () => {

        // Close buttons
        ['tc-close-btn', 'tc-close-btn2', 'tc-close-btn3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', closeTC);
        });

        const stopBtn = document.getElementById('tc-stop-btn');
        if (stopBtn) stopBtn.addEventListener('click', stopGuidance);

        // -- Helper: autocomplete per un campo (origine o destinazione) ---
        function setupAutocomplete(inputId, suggId, onSelect) {
            const input = document.getElementById(inputId);
            const suggList = document.getElementById(suggId);
            if (!input || !suggList) return;

            function showGpsShortcut() {
                if (input.value.trim().length > 0) return;
                suggList.innerHTML = '';
                const li = document.createElement('li');
                li.className = 'tc-sugg-item tc-sugg-gps';
                li.innerHTML = '<span style="margin-right:6px">&#128205;</span><strong>La tua posizione</strong>';
                li.addEventListener('mousedown', async function (e) {
                    e.preventDefault();
                    suggList.classList.add('hidden');
                    input.disabled = true;
                    input.value = 'Localizzazione\u2026';
                    try {
                        var coords = await getCurrentLocation();
                        input.value = 'La tua posizione';
                        input.disabled = false;
                        onSelect({ coords: coords, label: 'La tua posizione' });
                    } catch (err) {
                        input.value = '';
                        input.disabled = false;
                        var msg = err.code === 1 ? 'Accesso negato' : err.code === 2 ? 'Posizione non disponibile' : 'Timeout GPS';
                        showToast('\u26a0\ufe0f ' + msg + '. Inserisci un indirizzo manualmente.', 4000);
                    }
                });
                suggList.appendChild(li);
                suggList.classList.remove('hidden');
            }

            input.addEventListener('focus', showGpsShortcut);

            var _deb;
            input.addEventListener('input', function () {
                clearTimeout(_deb);
                var q = input.value.trim();
                if (q.length === 0) { showGpsShortcut(); return; }
                if (q.length < 3) { suggList.classList.add('hidden'); return; }
                onSelect(null); // cancella coords se utente modifica la query
                _deb = setTimeout(async function () {
                    var results = await searchNominatim(q);
                    suggList.innerHTML = '';
                    if (!results.length) { suggList.classList.add('hidden'); return; }
                    results.forEach(function (r) {
                        var li = document.createElement('li');
                        li.className = 'tc-sugg-item';
                        var name = r.display_name.split(',').slice(0, 3).join(', ');
                        li.textContent = name;
                        li.addEventListener('mousedown', function (e) {
                            e.preventDefault();
                            input.value = name;
                            onSelect({ coords: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) }, label: name });
                            suggList.classList.add('hidden');
                        });
                        suggList.appendChild(li);
                    });
                    suggList.classList.remove('hidden');
                }, 400);
            });

            document.addEventListener('click', function (e) {
                if (!input.contains(e.target) && !suggList.contains(e.target)) {
                    suggList.classList.add('hidden');
                }
            });
        }

        // Setup Origine
        setupAutocomplete('tc-origin-input', 'tc-origin-suggestions', function (sel) {
            if (!sel) { state.originCoords = null; state.originLabel = ''; return; }
            state.originCoords = sel.coords;
            state.originLabel = sel.label;
        });

        // Setup Destinazione
        setupAutocomplete('tc-dest-input', 'tc-dest-suggestions', function (sel) {
            if (!sel) { state.destCoords = null; state.destLabel = ''; return; }
            state.destCoords = sel.coords;
            state.destLabel = sel.label;
        });

        // -- Pulsante Cerca ----------------------------------------------
        const searchBtn = document.getElementById('tc-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                // Valida destinazione
                if (!state.destCoords) {
                    const q = document.getElementById('tc-dest-input')?.value.trim();
                    if (!q || q.length < 3) { showToast('\u26a0\ufe0f Inserisci una destinazione valida.', 3000); return; }
                    const r = await searchNominatim(q);
                    if (!r.length) { showToast('\u26a0\ufe0f Destinazione non trovata.', 3000); return; }
                    state.destCoords = { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) };
                    state.destLabel = r[0].display_name.split(',').slice(0, 3).join(', ');
                }

                // Se origine non impostata: prova GPS automatico
                if (!state.originCoords) {
                    const searchBtnEl = document.getElementById('tc-search-btn');
                    const originInput = document.getElementById('tc-origin-input');
                    if (searchBtnEl) { searchBtnEl.disabled = true; searchBtnEl.textContent = 'Localizzazione\u2026'; }
                    if (originInput) { originInput.value = 'Localizzazione\u2026'; originInput.disabled = true; }
                    try {
                        state.originCoords = await getCurrentLocation();
                        state.originLabel = 'La tua posizione';
                        if (originInput) { originInput.value = 'La tua posizione'; originInput.disabled = false; }
                    } catch (e) {
                        if (originInput) { originInput.value = ''; originInput.disabled = false; }
                        if (window.appMap) {
                            const c = window.appMap.getCenter();
                            state.originCoords = { lat: c.lat, lng: c.lng };
                            state.originLabel = 'Area della mappa';
                            const gpsMsg = e.code === 1 ? 'Posizione negata' : e.code === 2 ? 'Posizione non disponibile' : 'Timeout GPS';
                            showToast('\u26a0\ufe0f ' + gpsMsg + ' \u2013 uso il centro della mappa.', 4000);
                        } else {
                            if (searchBtnEl) { searchBtnEl.disabled = false; searchBtnEl.textContent = 'Cerca'; }
                            showToast('\u26a0\ufe0f GPS non disponibile. Seleziona un punto di partenza.', 5000);
                            return;
                        }
                    }
                    if (searchBtnEl) { searchBtnEl.disabled = false; }
                }

                const searchBtnEl = document.getElementById('tc-search-btn');
                if (searchBtnEl) { searchBtnEl.disabled = true; searchBtnEl.textContent = 'Calcolo\u2026'; }

                showStep('tc-step2');
                const solDiv = document.getElementById('tc-solutions-list');
                const metaEl = document.getElementById('tc-route-meta');
                if (solDiv) solDiv.innerHTML = '<div class="tc-loading">&#128269; Ricerca percorsi in corso...</div>';
                if (metaEl) metaEl.textContent = state.originLabel + " → " + state.destLabel;

                const routes = await findRoutes(state.originCoords, state.destCoords);
                if (searchBtnEl) { searchBtnEl.disabled = false; searchBtnEl.textContent = 'Cerca'; }

                if (!routes.length) {
                    if (solDiv) solDiv.innerHTML = '<div class="tc-no-results">&#128533; Nessun percorso trovato con gli autobus STAV per questa destinazione.</div>';
                    return;
                }

                if (solDiv) {
                    solDiv.innerHTML = '';
                    routes.forEach(trip => {
                        const lc = trip.line.color || '#e67e22';
                        const ltc = trip.line.txColor || '#fff';
                        const card = document.createElement('div');
                        card.className = 'tc-route-card';
                        card.innerHTML = `
                        <div class="tc-route-card-top">
                            <div class="tc-route-total"><strong>${trip.totalMins}</strong> <span>min</span></div>
                            <div class="tc-route-times">${trip.departTime} → ${trip.arriveTime}</div>
                        </div>
                        <div class="tc-route-chips">
                            <div class="tc-chip tc-chip-walk"><img src="img/Walk.png" alt="walk"> ${trip.walkToStopMins}min</div>
    <div class="tc-chip-arrow">→</div>
    <div class="tc-chip tc-chip-bus" style="background:${lc};color:${ltc}">${trip.line.id} ${trip.busMins}min</div>
    <div class="tc-chip-arrow">→</div>
    <div class="tc-chip tc-chip-walk"><img src="img/Walk.png" alt="walk"> ${trip.walkToDestMins}min</div>
    <div class="tc-chip-arrow">→</div>
    <div class="tc-chip tc-chip-dest">🏁</div>
                        </div>`;
                        card.addEventListener('click', () => {
                            state.selectedTrip = trip;
                            renderTimeline('tc-summary-timeline', trip);
                            showStep('tc-step3');
                        });
                        solDiv.appendChild(card);
                    });
                }
            });
        }

        // â”€â”€ Partiamo! â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const startBtn = document.getElementById('tc-start-btn');
        if (startBtn) startBtn.addEventListener('click', () => {
            if (!state.selectedTrip) return;
            state._tripStartedAt = Date.now();
            startGuidance(state.selectedTrip);
        });

        // â”€â”€ Indietro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const backBtn = document.getElementById('tc-back-btn');
        if (backBtn) backBtn.addEventListener('click', () => showStep('tc-step2'));

        // â”€â”€ Resume â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        checkResumeBanner();
    });

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PUBLIC API
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    window.TravelCompanion = { 
        open: openTC, 
        close: closeTC, 
        stopGuidance,
        planTo,
        searchNominatim 
    };
})();
