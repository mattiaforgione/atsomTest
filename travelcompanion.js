/**
 * TravelCompanion – myATSOM
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

    // -------------------------------------------------------------------------
    // COSTANTI
    // -------------------------------------------------------------------------
    const TC_STORAGE_KEY = 'tc_active_trip';
    const TC_EXPIRE_MS = 60 * 60 * 1000; // 1 ora
    const COLOR_WALK = '#888ea8';
    const COLOR_DEST = '#2ecc71';

    const osrmCache = new Map(); // Fix 7: Cache per evitare ricalcoli inutili
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
        alight2Alerted: false,
        arrivedAlerted: false,
        resumeBannerTimer: null,
        _tripStartedAt: null,
        boardingWaitStart: null,   // posizione quando si arriva alla fermata (leg1)
        boardingWaitStart2: null,  // posizione quando si arriva alla fermata (leg2 transfer)
    };

    // -------------------------------------------------------------------------
    // UTILITY
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // GPS â€“ cattura posizione attuale (no intercept di watchPosition)
    // -------------------------------------------------------------------------
    function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) { reject(new Error('Geolocation non disponibile')); return; }
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                err => reject(err),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
            );
        });
    }

    async function fetchWithTimeout(url, opts = {}) {
        const { timeout = 8000, retry429 = true } = opts;
        let attempt = 0;
        const maxAttempts = retry429 ? 3 : 1;

        while (attempt < maxAttempts) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), timeout);
            try {
                const r = await fetch(url, { ...opts, signal: controller.signal });
                clearTimeout(tid);
                if (r.status === 429 && retry429 && attempt < maxAttempts - 1) {
                    attempt++;
                    const wait = 1000 * Math.pow(2, attempt); // Exponential backoff
                    await new Promise(res => setTimeout(res, wait));
                    continue;
                }
                return r;
            } catch (e) {
                clearTimeout(tid);
                if (attempt < maxAttempts - 1 && e.name !== 'AbortError') {
                    attempt++;
                    await new Promise(res => setTimeout(res, 500));
                    continue;
                }
                throw e;
            }
        }
    }

    // -------------------------------------------------------------------------
    // ROUTING a piedi â€“ OSRM
    // -------------------------------------------------------------------------
    async function fetchWalkingRoute(fromLat, fromLng, toLat, toLng) {
        const cacheKey = `foot:${fromLat},${fromLng};${toLat},${toLng}`;
        if (osrmCache.has(cacheKey)) return osrmCache.get(cacheKey);

        try {
            const url = `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`;
            const r = await fetchWithTimeout(url);
            if (!r.ok) throw new Error('OSRM ' + r.status);
            const data = await r.json();
            if (data.routes && data.routes[0]) {
                const route = data.routes[0];
                const res = {
                    durationMins: Math.round(route.duration / 60),
                    distanceM: Math.round(route.distance),
                    coords: decodePolyline(route.geometry, 5)
                };
                osrmCache.set(cacheKey, res);
                return res;
            }
        } catch (e) {
            console.warn('OSRM fallback:', e);
        }
        const km = haversineKm(fromLat, fromLng, toLat, toLng);
        const res = { durationMins: Math.max(1, Math.round(km / 5 * 60)), distanceM: Math.round(km * 1000), coords: [[fromLat, fromLng], [toLat, toLng]] };
        osrmCache.set(cacheKey, res);
        return res;
    }

    // Rank candidati per distanza pedonale reale (OSRM /foot/).
    // Usa un approccio seriale con piccolo delay per evitare 429 dall'API demo OSRM.
    async function rankByWalkingDistance(fromLat, fromLng, candidates, topN = 6) {
        const top = candidates.slice(0, topN);
        const results = [];
        for (const s of top) {
            const r = await fetchWalkingRoute(fromLat, fromLng, s.lat, s.lng);
            results.push({ ...s, walkDistM: r.distanceM, walkDurationMins: r.durationMins, walkCoords: r.coords });
            // Piccolo delay per non saturare l'API demo
            await new Promise(res => setTimeout(res, 150));
        }
        return results.sort((a, b) => a.walkDistM - b.walkDistM);
    }

    // Geometria bus su strade reali (OSRM /driving/).
    async function fetchRoadRoute(stopObjects) {
        if (!stopObjects || stopObjects.length < 2) return null;
        const cacheKey = `road:${stopObjects.map(s => s.id).join('-')}`;
        if (osrmCache.has(cacheKey)) return osrmCache.get(cacheKey);

        try {
            const coords = stopObjects.map(s => `${s.lng},${s.lat}`).join(';');
            const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;
            const r = await fetchWithTimeout(url);
            if (!r.ok) throw new Error('OSRM road ' + r.status);
            const data = await r.json();
            if (data.routes && data.routes[0]) {
                const res = decodePolyline(data.routes[0].geometry, 5);
                osrmCache.set(cacheKey, res);
                return res;
            }
        } catch (e) {
            console.warn('OSRM road fallback:', e);
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // NOMINATIM
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // TIPO GIORNO
    // -------------------------------------------------------------------------
    function getTodayDayTypeTC() {
        const today = new Date();
        const day = today.getDay();
        const school = new Date('2026-06-08T00:00:00');
        if (day === 0) return 'festivo';
        if (day === 6) return today >= school ? 'sabato_non_scolastico' : 'sabato_scolastico';
        return today >= school ? 'feriale_non_scolastico' : 'feriale_scolastico';
    }

    // -------------------------------------------------------------------------
    // ROUTING BUS  
    // -------------------------------------------------------------------------
    async function findRoutes(originCoords, destCoords) {
        const stops = stavData.stops;
        const { lat: oLat, lng: oLng } = originCoords;
        const { lat: dLat, lng: dLng } = destCoords;

        // Pre-filtro rapido con haversine, poi ranking per distanza pedonale reale
        const boardHav = stops
            .filter(s => s.lat && s.lng)
            .map(s => ({ ...s, d: haversineKm(oLat, oLng, s.lat, s.lng) }))
            .filter(s => s.d < 3).sort((a, b) => a.d - b.d).slice(0, 20);
        const alightHav = stops
            .filter(s => s.lat && s.lng)
            .map(s => ({ ...s, d: haversineKm(dLat, dLng, s.lat, s.lng) }))
            .filter(s => s.d < 2).sort((a, b) => a.d - b.d).slice(0, 10);

        if (!boardHav.length || !alightHav.length) return [];

        // Rank per distanza pedonale reale (OSRM /foot/)
        const [boardRanked, alightRanked] = await Promise.all([
            rankByWalkingDistance(oLat, oLng, boardHav, 6),
            rankByWalkingDistance(dLat, dLng, alightHav, 4),
        ]);

        const aSet = new Set(alightRanked.map(s => s.id));
        const now = nowMins();
        const solutions = [];
        const todayType = getTodayDayTypeTC();

        for (const line of stavData.lines) {
            const trips = line.dayTypes[todayType] || [];
            for (const trip of trips) {
                const stopIds = trip.stops.map(s => s.stopId);
                for (const board of boardRanked) {
                    const boardIdx = stopIds.indexOf(board.id);
                    if (boardIdx < 0) continue;
                    for (let ai = boardIdx + 1; ai < stopIds.length; ai++) {
                        if (!aSet.has(stopIds[ai])) continue;
                        const alightStop = alightRanked.find(s => s.id === stopIds[ai]);
                        if (!alightStop) continue;
                        const boardTime = timeStrToMins(trip.stops[boardIdx].time);
                        const alightTime = timeStrToMins(trip.stops[ai].time);
                        if (boardTime < now - 5) continue;
                        solutions.push({
                            isTransfer: false,
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

        const best = [];
        for (const s of solutions) {
            if (best.length >= 2) break;
            const isDup = best.some(b => b.line.id === s.line.id && Math.abs(b.boardTime - s.boardTime) < 5);
            if (!isDup) best.push(s);
        }

        return await Promise.all(best.map(async s => {
            // Riusa i coords già calcolati durante il ranking
            const bd = boardRanked.find(b => b.id === s.boardStop.id);
            const ad = alightRanked.find(a => a.id === s.alightStop.id);
            const ws = bd ? { durationMins: bd.walkDurationMins, distanceM: bd.walkDistM, coords: bd.walkCoords }
                : await fetchWalkingRoute(oLat, oLng, s.boardStop.lat, s.boardStop.lng);
            const we = ad ? { durationMins: ad.walkDurationMins, distanceM: ad.walkDistM, coords: ad.walkCoords }
                : await fetchWalkingRoute(s.alightStop.lat, s.alightStop.lng, dLat, dLng);

            // Geometria bus su strade reali (Fix 5)
            const rawTrip = getRawTripByLine(s.line, s.tripId);
            let busRouteCoords = null;
            if (rawTrip) {
                const busStops = rawTrip.stops.slice(s.boardIdx, s.alightIdx + 1)
                    .map(st => stavData.stops.find(fs => fs.id === st.stopId)).filter(Boolean);
                busRouteCoords = await fetchRoadRoute(busStops);
            }

            const departMins = s.boardTime - ws.durationMins;
            const arriveTime = s.alightTime + we.durationMins;
            return {
                ...s,
                walkToStopMins: ws.durationMins,
                walkToStopCoords: ws.coords,
                walkToDestMins: we.durationMins,
                walkToDestCoords: we.coords,
                busRouteCoords,
                departTime: minsToHHMM(Math.max(now, departMins)),
                arriveTime: minsToHHMM(arriveTime),
                totalMins: Math.max(1, arriveTime - now),
            };
        }));
    }

    // Ricerca percorsi con UN trasbordo (1 cambio bus)
    async function findTransferRoutes(originCoords, destCoords) {
        const stops = stavData.stops;
        const { lat: oLat, lng: oLng } = originCoords;
        const { lat: dLat, lng: dLng } = destCoords;
        const now = nowMins();
        const todayType = getTodayDayTypeTC();

        const boardHav = stops.filter(s => s.lat && s.lng)
            .map(s => ({ ...s, d: haversineKm(oLat, oLng, s.lat, s.lng) }))
            .filter(s => s.d < 3).sort((a, b) => a.d - b.d).slice(0, 15);
        const alightHav = stops.filter(s => s.lat && s.lng)
            .map(s => ({ ...s, d: haversineKm(dLat, dLng, s.lat, s.lng) }))
            .filter(s => s.d < 2).sort((a, b) => a.d - b.d).slice(0, 10);
        if (!boardHav.length || !alightHav.length) return [];

        const [boardRanked, alightRanked] = await Promise.all([
            rankByWalkingDistance(oLat, oLng, boardHav, 5),
            rankByWalkingDistance(dLat, dLng, alightHav, 4),
        ]);

        const stopMap = new Map();
        stops.forEach(s => stopMap.set(s.id, s));

        const solutions = [];
        const LIMIT = 10;

        // 1. Trova corse che caricano ai punti di board
        const bTrips = [];
        const bSet = new Set(boardRanked.map(s => s.id));
        for (const line of stavData.lines) {
            (line.dayTypes[todayType] || []).forEach(trip => {
                trip.stops.forEach((st, idx) => {
                    if (bSet.has(st.stopId)) {
                        const bTime = timeStrToMins(st.time);
                        if (bTime >= now - 5 && bTime < now + 180) {
                            const bStop = stopMap.get(st.stopId);
                            bTrips.push({ line, trip, bIdx: idx, bTime, bStop });
                        }
                    }
                });
            });
        }

        // 2. Trova corse che scaricano ai punti di alight
        const aTrips = [];
        const alSet = new Set(alightRanked.map(s => s.id));
        for (const line of stavData.lines) {
            (line.dayTypes[todayType] || []).forEach(trip => {
                trip.stops.forEach((st, idx) => {
                    if (alSet.has(st.stopId) && idx > 0) {
                        const aTime = timeStrToMins(st.time);
                        const aStop = stopMap.get(st.stopId);
                        aTrips.push({ line, trip, aIdx: idx, aTime, aStop });
                    }
                });
            });
        }

        // 3. Incrocia le corse
        outer:
        for (const bt of bTrips) {
            const stops1 = bt.trip.stops;
            for (let ti = bt.bIdx + 1; ti < stops1.length; ti++) {
                const tStopId = stops1[ti].stopId;
                const tTime1 = timeStrToMins(stops1[ti].time);
                
                for (const at of aTrips) {
                    if (at.line.id === bt.line.id) continue;
                    const stopIds2 = at.trip.stops.map(s => s.stopId);
                    const tIdx2 = stopIds2.indexOf(tStopId);
                    if (tIdx2 >= 0 && tIdx2 < at.aIdx) {
                        const tTime2 = timeStrToMins(at.trip.stops[tIdx2].time);
                        if (tTime2 >= tTime1 + 2 && tTime2 <= tTime1 + 45) {
                            solutions.push({
                                isTransfer: true,
                                boardTime: bt.bTime,
                                leg1: { line: bt.line, tripId: bt.trip.tripId, boardStop: bt.bStop, boardIdx: bt.bIdx, alightStop: stopMap.get(tStopId), alightIdx: ti, boardTime: bt.bTime, alightTime: tTime1, stopsCount: ti - bt.bIdx, busMins: tTime1 - bt.bTime },
                                transferStop: stopMap.get(tStopId),
                                leg2: { line: at.line, tripId: at.trip.tripId, boardStop: stopMap.get(tStopId), boardIdx: tIdx2, alightStop: at.aStop, alightIdx: at.aIdx, boardTime: tTime2, alightTime: at.aTime, stopsCount: at.aIdx - tIdx2, busMins: at.aTime - tTime2 },
                            });
                            if (solutions.length >= LIMIT) break outer;
                        }
                    }
                }
            }
        }

        if (!solutions.length) return [];
        solutions.sort((a, b) => a.boardTime - b.boardTime);
        const best = solutions.slice(0, 2);

        return await Promise.all(best.map(async s => {
            const bd = boardRanked.find(b => b.id === s.leg1.boardStop.id);
            const ad = alightRanked.find(a => a.id === s.leg2.alightStop.id);
            const ws = bd ? { durationMins: bd.walkDurationMins, coords: bd.walkCoords } : await fetchWalkingRoute(oLat, oLng, s.leg1.boardStop.lat, s.leg1.boardStop.lng);
            const we = ad ? { durationMins: ad.walkDurationMins, coords: ad.walkCoords } : await fetchWalkingRoute(s.leg2.alightStop.lat, s.leg2.alightStop.lng, dLat, dLng);

            const rawTrip1 = getRawTripByLine(s.leg1.line, s.leg1.tripId);
            const rawTrip2 = getRawTripByLine(s.leg2.line, s.leg2.tripId);
            let busRouteCoords = null, busRouteCoords2 = null;
            if (rawTrip1) {
                const bs = rawTrip1.stops.slice(s.leg1.boardIdx, s.leg1.alightIdx + 1).map(st => stops.find(fs => fs.id === st.stopId)).filter(Boolean);
                busRouteCoords = await fetchRoadRoute(bs);
            }
            if (rawTrip2) {
                const bs = rawTrip2.stops.slice(s.leg2.boardIdx, s.leg2.alightIdx + 1).map(st => stops.find(fs => fs.id === st.stopId)).filter(Boolean);
                busRouteCoords2 = await fetchRoadRoute(bs);
            }

            const waitAtTransferMins = Math.max(0, s.leg2.boardTime - s.leg1.alightTime);
            const arriveTime = s.leg2.alightTime + we.durationMins;
            return {
                ...s,
                walkToStopMins: ws.durationMins,
                walkToStopCoords: ws.coords,
                waitAtTransferMins,
                walkToDestMins: we.durationMins,
                walkToDestCoords: we.coords,
                busRouteCoords,
                busRouteCoords2,
                departTime: minsToHHMM(Math.max(now, s.leg1.boardTime - ws.durationMins)),
                arriveTime: minsToHHMM(arriveTime),
                totalMins: Math.max(1, arriveTime - now),
            };
        }));
    }

    // -------------------------------------------------------------------------
    // RENDER TIMELINE â€“ stile foto (linea verticale con label linea laterale)
    // -------------------------------------------------------------------------
    function renderTimeline(containerId, trip) {
        const c = document.getElementById(containerId);
        if (!c) return;
        if (trip.isTransfer) {
            const lc1 = trip.leg1.line.color || '#e67e22';
            const lc2 = trip.leg2.line.color || '#3498db';
            c.innerHTML = `<div class="tc-tl">
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_WALK}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${state.originLabel}</div><div class="tc-tl-desc">Cammina ${trip.walkToStopMins} min</div></div></div>
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc1}"></div><div class="tc-tl-vline" style="background:${lc1}"><span class="tc-tl-linelabel" style="color:${lc1}">${trip.leg1.line.id}</span></div></div><div class="tc-tl-body"><div class="tc-tl-name">Linea ${trip.leg1.line.id}</div><div class="tc-tl-name tc-tl-name-stop">${trip.leg1.boardStop.name}</div><div class="tc-tl-desc">${trip.leg1.stopsCount} fermate · ${trip.leg1.busMins} min</div></div></div>
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc1}"></div><div class="tc-tl-vline" style="background:${lc2}"><span class="tc-tl-linelabel" style="color:${lc2}">cambio</span></div></div><div class="tc-tl-body"><div class="tc-tl-name">🔄 Cambio bus</div><div class="tc-tl-name tc-tl-name-stop">${trip.transferStop.name}</div><div class="tc-tl-desc">Attendi ${trip.waitAtTransferMins} min · Linea ${trip.leg2.line.id}</div></div></div>
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc2}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"><span class="tc-tl-linelabel" style="color:${lc2}">${trip.leg2.line.id}</span></div></div><div class="tc-tl-body"><div class="tc-tl-name">Linea ${trip.leg2.line.id}</div><div class="tc-tl-name tc-tl-name-stop">${trip.leg2.alightStop.name}</div><div class="tc-tl-desc">${trip.leg2.stopsCount} fermate · ${trip.leg2.busMins} min</div></div></div>
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_WALK}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">Fermata di arrivo</div><div class="tc-tl-name tc-tl-name-stop">${trip.leg2.alightStop.name}</div><div class="tc-tl-desc">Cammina ${trip.walkToDestMins} min</div></div></div>
                <div class="tc-tl-row tc-tl-row-last"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_DEST}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${state.destLabel}</div></div></div>
            </div>`;
        } else {
            const lc = trip.line.color || '#e67e22';
            c.innerHTML = `<div class="tc-tl">
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_WALK}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${state.originLabel}</div><div class="tc-tl-desc">Cammina per ${trip.walkToStopMins} min</div></div></div>
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc}"></div><div class="tc-tl-vline" style="background:${lc}"><span class="tc-tl-linelabel" style="color:${lc}">${trip.line.id}</span></div></div><div class="tc-tl-body"><div class="tc-tl-name">Fermata di partenza</div><div class="tc-tl-name tc-tl-name-stop">${trip.boardStop.name}</div><div class="tc-tl-desc">Scendi dopo ${trip.stopsCount} fermate e ${trip.busMins} minuti</div></div></div>
                <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">Fermata di arrivo</div><div class="tc-tl-name tc-tl-name-stop">${trip.alightStop.name}</div><div class="tc-tl-desc">Cammina per ${trip.walkToDestMins} min</div></div></div>
                <div class="tc-tl-row tc-tl-row-last"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_DEST}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${state.destLabel}</div></div></div>
            </div>`;
        }
    }

    function renderGuidanceTimeline(containerId, trip, currentIdx) {
        const c = document.getElementById(containerId);
        if (!c) return;
        const phase = state.phase;

        // Helper per rendering fermate su bus (on_bus / on_bus2)
        function busStopsHtml(rawTripObj, fromIdx, toIdx, lineColor, alightLabel) {
            let h = '';
            for (let i = fromIdx + 1; i <= toIdx; i++) {
                const rs = rawTripObj.stops[i];
                const sd = stavData.stops.find(fs => fs.id === rs.stopId);
                const nm = sd ? sd.name : rs.stopId;
                const isAl = i === toIdx;
                const isCur = i === currentIdx;
                h += `<div class="tc-tl-row${isAl ? ' tc-tl-row-alight' : ''}${isCur ? ' tc-tl-row-current' : ''}">
                    <div class="tc-tl-left">
                        <div class="tc-tl-node${isCur ? ' tc-tl-node-active' : ''}${!isAl ? ' tc-tl-node-sm' : ''}" style="border-color:${lineColor}"></div>
                        ${!isAl ? `<div class="tc-tl-vline" style="background:${lineColor}"></div>` : ''}
                    </div>
                    <div class="tc-tl-body">
                        <div class="tc-tl-name" style="font-size:${isAl ? '1rem' : '.9rem'}">${isAl ? '&#128721; ' : ''}${nm}</div>
                        <div class="tc-tl-desc">${rs.time}${isAl ? ' &mdash; ' + alightLabel : ''}</div>
                    </div>
                </div>`;
            }
            return h;
        }

        // Determina i colori correnti
        const lc = trip.isTransfer ? (trip.leg1.line.color || '#e67e22') : (trip.line.color || '#e67e22');
        const lc2 = trip.isTransfer ? (trip.leg2.line.color || '#3498db') : lc;

        // Nomi fermata in base al tipo di viaggio
        const boardStopName = trip.isTransfer ? trip.leg1.boardStop.name : trip.boardStop.name;
        const alightStopName = trip.isTransfer ? trip.leg2.alightStop.name : trip.alightStop.name;
        const lineId = trip.isTransfer ? trip.leg1.line.id : trip.line.id;

        let html = '<div class="tc-tl">';

        if (phase === 'walking_to_stop') {
            html += `<div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node tc-tl-node-active" style="border-color:${COLOR_WALK}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${state.originLabel}</div><div class="tc-tl-desc tc-tl-desc-active">Cammina verso ${boardStopName}</div></div></div>
            <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${boardStopName}</div></div></div>`;

        } else if (phase === 'waiting_at_stop') {
            html += `<div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node tc-tl-node-active" style="border-color:${lc}"></div><div class="tc-tl-vline" style="background:${lc}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${boardStopName}</div><div class="tc-tl-desc tc-tl-desc-active">In attesa della linea ${lineId}</div></div></div>
            <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${trip.isTransfer ? trip.transferStop.name : alightStopName}</div></div></div>`;

        } else if (phase === 'on_bus') {
            const activeLine = trip.isTransfer ? trip.leg1 : trip;
            const rawT = getRawTripByLine(activeLine.line, activeLine.tripId);
            html += `<div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc}"></div><div class="tc-tl-vline" style="background:${lc}"><span class="tc-tl-linelabel" style="color:${lc}">${activeLine.line.id}</span></div></div><div class="tc-tl-body"><div class="tc-tl-name">${activeLine.boardStop.name}</div><div class="tc-tl-desc">Fermata di salita</div></div></div>`;
            if (rawT) html += busStopsHtml(rawT, activeLine.boardIdx, activeLine.alightIdx, lc, trip.isTransfer ? 'Scendi per il cambio!' : 'Scendi qui!');

        } else if (phase === 'waiting_at_transfer' && trip.isTransfer) {
            html += `<div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node tc-tl-node-active" style="border-color:${lc2}"></div><div class="tc-tl-vline" style="background:${lc2}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${trip.transferStop.name}</div><div class="tc-tl-desc tc-tl-desc-active">In attesa della linea ${trip.leg2.line.id}</div></div></div>
            <div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc2}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${trip.leg2.alightStop.name}</div></div></div>`;

        } else if (phase === 'on_bus2' && trip.isTransfer) {
            const rawT2 = getRawTripByLine(trip.leg2.line, trip.leg2.tripId);
            html += `<div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${lc2}"></div><div class="tc-tl-vline" style="background:${lc2}"><span class="tc-tl-linelabel" style="color:${lc2}">${trip.leg2.line.id}</span></div></div><div class="tc-tl-body"><div class="tc-tl-name">${trip.transferStop.name}</div><div class="tc-tl-desc">Fermata di trasbordo</div></div></div>`;
            if (rawT2) html += busStopsHtml(rawT2, trip.leg2.boardIdx, trip.leg2.alightIdx, lc2, 'Scendi qui!');

        } else if (phase === 'walking_to_dest') {
            html += `<div class="tc-tl-row"><div class="tc-tl-left"><div class="tc-tl-node tc-tl-node-active" style="border-color:${COLOR_WALK}"></div><div class="tc-tl-vline" style="background:${COLOR_WALK}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${alightStopName}</div><div class="tc-tl-desc tc-tl-desc-active">Cammina verso ${state.destLabel}</div></div></div>
            <div class="tc-tl-row tc-tl-row-last"><div class="tc-tl-left"><div class="tc-tl-node" style="border-color:${COLOR_DEST}"></div></div><div class="tc-tl-body"><div class="tc-tl-name">${state.destLabel}</div></div></div>`;
        }

        html += '</div>';
        c.innerHTML = html;
    }



    function getRawTripByLine(line, tripId) {
        if (!line || !line.dayTypes) return null;
        for (const day in line.dayTypes) {
            const found = line.dayTypes[day].find(t => t.tripId === tripId);
            if (found) return found;
        }
        return null;
    }


    // -------------------------------------------------------------------------
    // MAP HELPERS
    // -------------------------------------------------------------------------
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
        const rawTrip = getRawTripByLine(trip.line, trip.tripId);
        if (!rawTrip) return;
        const lc = trip.line.color || '#e67e22';

        // Fix 5: usa busRouteCoords (geometria su strada) se disponibile,
        // altrimenti fallback a linea d'aria tra le fermate
        let routeCoords = trip.busRouteCoords || null;
        if (!routeCoords || routeCoords.length < 2) {
            routeCoords = rawTrip.stops.slice(trip.boardIdx, trip.alightIdx + 1)
                .map(s => stavData.stops.find(fs => fs.id === s.stopId))
                .filter(Boolean).map(s => [s.lat, s.lng]);
        }
        if (routeCoords.length < 2) return;
        state.tcBusPolyline = L.polyline(routeCoords, { color: lc, weight: 7, opacity: 0.95, lineJoin: 'round' }).addTo(map);

        // Markers circolari solo sulle fermate reali (non su ogni punto della polyline)
        const stopPoints = rawTrip.stops.slice(trip.boardIdx, trip.alightIdx + 1)
            .map(s => stavData.stops.find(fs => fs.id === s.stopId))
            .filter(Boolean).map(s => [s.lat, s.lng]);
        stopPoints.forEach(p => {
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

    // -------------------------------------------------------------------------
    // PANEL NAVIGATION  
    // Usa bottom-sheet: la mappa Ã¨ sempre visibile sopra.
    // In guidance mode il panel usa solo il pannello guidance (ancora bottom-sheet).
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // GUIDANCE ENGINE
    // -------------------------------------------------------------------------
    function startGuidance(trip) {
        state.phase = 'walking_to_stop';
        state.selectedTrip = trip;
        state.alightAlerted = false;
        state.alight2Alerted = false;
        state.arrivedAlerted = false;
        state.lastPositions = [];
        state.boardingWaitStart = null;
        state.boardingWaitStart2 = null;

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

        const boardStopName = trip.isTransfer ? trip.leg1.boardStop.name : trip.boardStop.name;
        const alightStopName= trip.isTransfer ? trip.leg2.alightStop.name: trip.alightStop.name;
        const lineId        = trip.isTransfer ? trip.leg1.line.id        : trip.line.id;
        const boardTime     = trip.isTransfer ? trip.leg1.boardTime      : trip.boardTime;

        switch (state.phase) {
            case 'walking_to_stop':
                if (phaseEl) phaseEl.textContent = 'Prossimo passo:';
                if (instrEl) instrEl.textContent = `Cammina verso ${boardStopName}. Segui il percorso.`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, -1);
                break;
            case 'waiting_at_stop':
                if (phaseEl) phaseEl.textContent = 'Attendi l\'autobus';
                if (instrEl) {
                    instrEl.innerHTML = `<strong>Linea ${lineId}</strong> &mdash; ${minsToHHMM(boardTime)}<br><span style="font-size:.9em;opacity:.8">&rarr; ${alightStopName}</span>`;
                }
                renderGuidanceTimeline('tc-guidance-timeline', trip, -1);
                break;
            case 'on_bus': {
                const leg = trip.isTransfer ? trip.leg1 : trip;
                if (phaseEl) phaseEl.textContent = 'Sei sul bus!';
                if (instrEl) instrEl.textContent = `Linea ${leg.line.id} → scendi a ${leg.alightStop.name}`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, leg.boardIdx);
                const bcLeg1 = trip.busRouteCoords;
                if (bcLeg1 && bcLeg1.length > 1) {
                    clearTCmap();
                    const lc = leg.line.color || '#e67e22';
                    state.tcBusPolyline = L.polyline(bcLeg1, { color: lc, weight: 7, opacity: 0.95, lineJoin: 'round' }).addTo(window.appMap);
                    try { window.appMap.fitBounds(state.tcBusPolyline.getBounds(), { padding: [60, 60] }); } catch(e) {}
                } else {
                    drawBusRoute(trip);
                }
                break;
            }
            case 'waiting_at_transfer':
                if (phaseEl) phaseEl.textContent = 'Attendi il secondo bus';
                if (instrEl) {
                    instrEl.innerHTML = `<strong>Linea ${trip.leg2.line.id}</strong> &mdash; ${minsToHHMM(trip.leg2.boardTime)}<br><span style="font-size:.9em;opacity:.8">&rarr; ${trip.leg2.alightStop.name}</span>`;
                }
                renderGuidanceTimeline('tc-guidance-timeline', trip, -1);
                break;
            case 'on_bus2':
                if (phaseEl) phaseEl.textContent = 'Sei sul bus!';
                if (instrEl) instrEl.textContent = `Linea ${trip.leg2.line.id} → scendi a ${trip.leg2.alightStop.name}`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, trip.leg2.boardIdx);
                if (trip.busRouteCoords2 && trip.busRouteCoords2.length > 1) {
                    clearTCmap();
                    const lc2 = trip.leg2.line.color || '#3498db';
                    state.tcBusPolyline = L.polyline(trip.busRouteCoords2, { color: lc2, weight: 7, opacity: 0.95, lineJoin: 'round' }).addTo(window.appMap);
                    try { window.appMap.fitBounds(state.tcBusPolyline.getBounds(), { padding: [60, 60] }); } catch(e) {}
                }
                break;
            case 'walking_to_dest':
                if (phaseEl) phaseEl.textContent = 'Prossimo passo:';
                if (instrEl) instrEl.textContent = `Cammina per ${trip.walkToDestMins} minuti verso ${state.destLabel}.`;
                renderGuidanceTimeline('tc-guidance-timeline', trip, -1);
                drawWalkRoute(trip.walkToDestCoords, '#27ae60');
                break;
            case 'arrived':
                if (phaseEl) phaseEl.textContent = '🎉 Sei arrivato!';
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

        // Valori board/alight dinamici in base al tipo di viaggio e alla fase
        const boardStop = trip.isTransfer ? trip.leg1.boardStop : trip.boardStop;
        const alightStop1 = trip.isTransfer ? trip.leg1.alightStop : trip.alightStop; // anche transferStop
        const instrEl = document.getElementById('tc-instruction');

        if (state.phase === 'walking_to_stop') {
            const distToStop = haversineKm(lat, lng, boardStop.lat, boardStop.lng) * 1000;
            if (distToStop < 80) {
                // Entra in waiting_at_stop e registra posizione di partenza per misurare movimento
                if (!state.boardingWaitStart) {
                    state.boardingWaitStart = { lat, lng };
                    state.phase = 'waiting_at_stop';
                    updateGuidanceUI();
                    saveToStorage();
                }
            } else {
                state.boardingWaitStart = null;
                if (instrEl) {
                    const paceMin = Math.max(1, Math.round(distToStop / 1000 / 5 * 60));
                    instrEl.textContent = `Cammina circa ${paceMin} min verso ${boardStop.name} (${Math.round(distToStop)} m)`;
                }
            }

        } else if (state.phase === 'waiting_at_stop') {
            // Aspetta che l'utente si muova ≥80m dalla fermata (bus in moto)
            if (state.boardingWaitStart) {
                const movedFromStop = haversineKm(state.boardingWaitStart.lat, state.boardingWaitStart.lng, lat, lng) * 1000;
                if (movedFromStop >= 80) {
                    state.boardingWaitStart = null;
                    state.phase = 'on_bus';
                    updateGuidanceUI();
                    saveToStorage();
                    return;
                }
            }
            // Aggiorna info orario in tempo reale nell'istruzione
            if (instrEl) {
                const leg = trip.isTransfer ? trip.leg1 : trip;
                const nowM = nowMins();
                const waitM = Math.max(0, leg.boardTime - nowM);
                instrEl.innerHTML = `<strong>Linea ${leg.line.id}</strong> &mdash; ${minsToHHMM(leg.boardTime)} (tra ${waitM} min)<br><span style="font-size:.9em;opacity:.8">&rarr; ${leg.alightStop.name}</span>`;
            }

        } else if (state.phase === 'on_bus') {
            const alightStopData = alightStop1;
            const distToAlight = haversineKm(lat, lng, alightStopData.lat, alightStopData.lng) * 1000;
            if (distToAlight < 400 && !state.alightAlerted) {
                state.alightAlerted = true;
                showAlightAlert(alightStopData.name, distToAlight);
            }
            if (distToAlight < 80) {
                if (trip.isTransfer) {
                    // Trasbordo: passa a waiting_at_transfer
                    state.phase = 'waiting_at_transfer';
                    state.boardingWaitStart2 = { lat, lng };
                } else {
                    state.phase = 'walking_to_dest';
                }
                updateGuidanceUI();
                saveToStorage();
                return;
            }
            // Aggiorna fermata corrente nella timeline
            const leg1 = trip.isTransfer ? trip.leg1 : trip;
            const rawT = getRawTripByLine(leg1.line, leg1.tripId);
            if (rawT) {
                let closestIdx = leg1.boardIdx, closestDist = Infinity;
                for (let i = leg1.boardIdx; i <= leg1.alightIdx; i++) {
                    const sd = stavData.stops.find(fs => fs.id === rawT.stops[i].stopId);
                    if (!sd) continue;
                    const d = haversineKm(lat, lng, sd.lat, sd.lng) * 1000;
                    if (d < closestDist) { closestDist = d; closestIdx = i; }
                }
                renderGuidanceTimeline('tc-guidance-timeline', trip, closestIdx);
            }

        } else if (state.phase === 'waiting_at_transfer' && trip.isTransfer) {
            if (state.boardingWaitStart2) {
                const movedFromTransfer = haversineKm(state.boardingWaitStart2.lat, state.boardingWaitStart2.lng, lat, lng) * 1000;
                if (movedFromTransfer >= 80) {
                    state.boardingWaitStart2 = null;
                    state.phase = 'on_bus2';
                    updateGuidanceUI();
                    saveToStorage();
                    return;
                }
            }

        } else if (state.phase === 'on_bus2' && trip.isTransfer) {
            const distToAlight2 = haversineKm(lat, lng, trip.leg2.alightStop.lat, trip.leg2.alightStop.lng) * 1000;
            if (distToAlight2 < 400 && !state.alight2Alerted) {
                state.alight2Alerted = true;
                showAlightAlert(trip.leg2.alightStop.name, distToAlight2);
            }
            if (distToAlight2 < 80) {
                state.phase = 'walking_to_dest';
                updateGuidanceUI();
                saveToStorage();
                return;
            }
            const rawT2 = getRawTripByLine(trip.leg2.line, trip.leg2.tripId);
            if (rawT2) {
                let closestIdx = trip.leg2.boardIdx, closestDist = Infinity;
                for (let i = trip.leg2.boardIdx; i <= trip.leg2.alightIdx; i++) {
                    const sd = stavData.stops.find(fs => fs.id === rawT2.stops[i].stopId);
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
        banner.innerHTML = `<div class="tc-alight-icon">🔔</div><div class="tc-alight-text"><strong>Scendi ora!</strong><br><span>${stopName} è a ${Math.round(distM)} m</span></div><button class="tc-alight-dismiss">&times;</button>`;
        banner.querySelector('.tc-alight-dismiss').addEventListener('click', () => banner.remove());
        document.body.appendChild(banner);
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 15000);
    }

    // -------------------------------------------------------------------------
    // STORAGE
    // -------------------------------------------------------------------------
    function saveToStorage() {
        try {
            if (!state.selectedTrip) {
                localStorage.removeItem(TC_STORAGE_KEY);
                return;
            }
            const trip = state.selectedTrip;
            let snap;
            if (trip.isTransfer) {
                snap = {
                    isTransfer: true,
                    leg1: { lineId: trip.leg1.line.id, tripId: trip.leg1.tripId, boardStopId: trip.leg1.boardStop.id, alightStopId: trip.leg1.alightStop.id, boardIdx: trip.leg1.boardIdx, alightIdx: trip.leg1.alightIdx, stopsCount: trip.leg1.stopsCount, busMins: trip.leg1.busMins, boardTime: trip.leg1.boardTime },
                    leg2: { lineId: trip.leg2.line.id, tripId: trip.leg2.tripId, boardStopId: trip.leg2.boardStop.id, alightStopId: trip.leg2.alightStop.id, boardIdx: trip.leg2.boardIdx, alightIdx: trip.leg2.alightIdx, stopsCount: trip.leg2.stopsCount, busMins: trip.leg2.busMins, boardTime: trip.leg2.boardTime },
                    transferStopId: trip.transferStop.id,
                    waitAtTransferMins: trip.waitAtTransferMins,
                    busRouteCoords: trip.busRouteCoords,
                    busRouteCoords2: trip.busRouteCoords2,
                    walkToStopMins: trip.walkToStopMins, walkToStopCoords: trip.walkToStopCoords,
                    walkToDestMins: trip.walkToDestMins, walkToDestCoords: trip.walkToDestCoords,
                    totalMins: trip.totalMins, departTime: trip.departTime, arriveTime: trip.arriveTime, boardTime: trip.boardTime
                };
            } else {
                snap = {
                    isTransfer: false,
                    lineId: trip.line.id, tripId: trip.tripId,
                    boardStopId: trip.boardStop.id, alightStopId: trip.alightStop.id,
                    boardIdx: trip.boardIdx, alightIdx: trip.alightIdx,
                    walkToStopMins: trip.walkToStopMins, walkToStopCoords: trip.walkToStopCoords,
                    walkToDestMins: trip.walkToDestMins, walkToDestCoords: trip.walkToDestCoords,
                    stopsCount: trip.stopsCount, busMins: trip.busMins,
                    busRouteCoords: trip.busRouteCoords,
                    totalMins: trip.totalMins, departTime: trip.departTime, arriveTime: trip.arriveTime, boardTime: trip.boardTime
                };
            }
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
        if (!snap) return null;
        if (snap.isTransfer) {
            const l1 = stavData.lines.find(l => l.id === snap.leg1.lineId);
            const l2 = stavData.lines.find(l => l.id === snap.leg2.lineId);
            const s1_b = stavData.stops.find(s => s.id === snap.leg1.boardStopId);
            const s1_a = stavData.stops.find(s => s.id === snap.leg1.alightStopId);
            const s2_b = stavData.stops.find(s => s.id === snap.leg2.boardStopId);
            const s2_a = stavData.stops.find(s => s.id === snap.leg2.alightStopId);
            const st = stavData.stops.find(s => s.id === snap.transferStopId);
            if (!l1 || !l2 || !s1_b || !s1_a || !s2_b || !s2_a || !st) return null;
            return {
                isTransfer: true,
                leg1: { line: l1, tripId: snap.leg1.tripId, boardStop: s1_b, alightStop: s1_a, boardIdx: snap.leg1.boardIdx, alightIdx: snap.leg1.alightIdx, stopsCount: snap.leg1.stopsCount, busMins: snap.leg1.busMins, boardTime: snap.leg1.boardTime },
                leg2: { line: l2, tripId: snap.leg2.tripId, boardStop: s2_b, alightStop: s2_a, boardIdx: snap.leg2.boardIdx, alightIdx: snap.leg2.alightIdx, stopsCount: snap.leg2.stopsCount, busMins: snap.leg2.busMins, boardTime: snap.leg2.boardTime },
                transferStop: st,
                waitAtTransferMins: snap.waitAtTransferMins,
                busRouteCoords: snap.busRouteCoords,
                busRouteCoords2: snap.busRouteCoords2,
                walkToStopMins: snap.walkToStopMins, walkToStopCoords: snap.walkToStopCoords,
                walkToDestMins: snap.walkToDestMins, walkToDestCoords: snap.walkToDestCoords,
                totalMins: snap.totalMins, departTime: snap.departTime, arriveTime: snap.arriveTime, boardTime: snap.boardTime
            };
        } else {
            const line = stavData.lines.find(l => l.id === snap.lineId);
            const boardStop = stavData.stops.find(s => s.id === snap.boardStopId);
            const alightStop = stavData.stops.find(s => s.id === snap.alightStopId);
            if (!line || !boardStop || !alightStop) return null;
            return {
                line, tripId: snap.tripId, boardStop, alightStop, boardIdx: snap.boardIdx, alightIdx: snap.alightIdx,
                walkToStopMins: snap.walkToStopMins, walkToStopCoords: snap.walkToStopCoords,
                walkToDestMins: snap.walkToDestMins, walkToDestCoords: snap.walkToDestCoords,
                stopsCount: snap.stopsCount, busMins: snap.busMins,
                busRouteCoords: snap.busRouteCoords,
                totalMins: snap.totalMins, departTime: snap.departTime, arriveTime: snap.arriveTime, boardTime: snap.boardTime
            };
        }
    }

    // -------------------------------------------------------------------------
    // RESUME BANNER
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // OPEN / CLOSE
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // INIT
    // -------------------------------------------------------------------------
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
                osrmCache.clear(); // Pulisce la cache a ogni nuova ricerca manuale
                if (solDiv) solDiv.innerHTML = '<div class="tc-loading">&#128269; Ricerca percorsi in corso...</div>';
                if (metaEl) metaEl.textContent = state.originLabel + " → " + state.destLabel;

                // Fix 7: Esecuzione in parallelo
                const [routes, transferRoutes] = await Promise.all([
                    findRoutes(state.originCoords, state.destCoords).catch(e => { console.error('direct search:', e); return []; }),
                    findTransferRoutes(state.originCoords, state.destCoords).catch(e => { console.warn('transfer search:', e); return []; })
                ]);

                // Combina: prima le dirette, poi i trasbordi (se non già coperti)
                const allRoutes = [...routes, ...transferRoutes].sort((a, b) => a.boardTime - b.boardTime);

                if (searchBtnEl) { searchBtnEl.disabled = false; searchBtnEl.textContent = 'Cerca'; }

                if (!allRoutes.length) {
                    if (solDiv) solDiv.innerHTML = '<div class="tc-no-results">&#128533; Nessun percorso trovato con gli autobus STAV per questa destinazione.</div>';
                    return;
                }

                if (solDiv) {
                    solDiv.innerHTML = '';
                    allRoutes.forEach(trip => {
                        const card = document.createElement('div');
                        card.className = 'tc-route-card';
                        let chipsHtml;
                        if (trip.isTransfer) {
                            const lc1 = trip.leg1.line.color || '#e67e22';
                            const ltc1 = trip.leg1.line.txColor || '#fff';
                            const lc2 = trip.leg2.line.color || '#3498db';
                            const ltc2 = trip.leg2.line.txColor || '#fff';
                            chipsHtml = `<div class="tc-chip tc-chip-walk"><img src="img/Walk.png" alt="walk"> ${trip.walkToStopMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-bus" style="background:${lc1};color:${ltc1}">${trip.leg1.line.id} ${trip.leg1.busMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-bus" style="background:${lc2};color:${ltc2}">${trip.leg2.line.id} ${trip.leg2.busMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-walk"><img src="img/Walk.png" alt="walk"> ${trip.walkToDestMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-dest">&#127937;</div>`;
                        } else {
                            const lc = trip.line.color || '#e67e22';
                            const ltc = trip.line.txColor || '#fff';
                            chipsHtml = `<div class="tc-chip tc-chip-walk"><img src="img/Walk.png" alt="walk"> ${trip.walkToStopMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-bus" style="background:${lc};color:${ltc}">${trip.line.id} ${trip.busMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-walk"><img src="img/Walk.png" alt="walk"> ${trip.walkToDestMins}min</div><div class="tc-chip-arrow">&rarr;</div><div class="tc-chip tc-chip-dest">&#127937;</div>`;
                        }
                        card.innerHTML = `<div class="tc-route-card-top"><div class="tc-route-total"><strong>${trip.totalMins}</strong> <span>min</span></div><div class="tc-route-times">${trip.departTime} &rarr; ${trip.arriveTime}</div></div><div class="tc-route-chips">${chipsHtml}</div>`;
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
