import codecs

with codecs.open("c:/Users/mella/Documents/MyATSOM/app.js", "r", "utf-8") as f:
    text = f.read()

old_dom = """    // Riferimenti Modal
    const stopDetailsSheet = document.getElementById('stop-details');
    const overlay = document.getElementById('modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Riferimenti Contenuti Modal
    const stopNameHeader = document.getElementById('stop-name');
    const navBtn = document.getElementById('nav-btn');
    const routesContainer = document.getElementById('routes-container');

    // Riferimenti Day Chips
    const dayChips = document.querySelectorAll('.day-chip');

    // Riferimenti Highlight Card
    const highlightCard = document.getElementById('next-bus-highlight');
    const highlightBadge = document.querySelector('.highlight-badge');
    const hMins = document.getElementById('highlight-minutes');
    const hLine = document.getElementById('highlight-line-name');
    const hDest = document.getElementById('highlight-dest-name');
    const hExactTime = document.getElementById('highlight-exact-time');"""

new_dom = """    // Riferimenti Modal Sostituiti per in-panel refactoring
    const __dummyEl = document.createElement('div');
    const stopDetailsSheet = __dummyEl;
    const overlay = __dummyEl;
    const closeModalBtn = __dummyEl;
    const stopNameHeader = __dummyEl;
    const navBtn = __dummyEl;
    const routesContainer = __dummyEl;
    const highlightCard = __dummyEl;
    const highlightBadge = __dummyEl;
    const hMins = __dummyEl;
    const hLine = __dummyEl;
    const hDest = __dummyEl;
    const hExactTime = __dummyEl;
    const dayChips = []; // Evita crash su forEach"""

if old_dom in text:
    text = text.replace(old_dom, new_dom)
else:
    print("WARNING: old_dom not found exactly!")

replacements = {
    "function openStopDetails(stop) {": "function _old_openStopDetails(stop) {",
    "function updateModalData() {": "function _old_updateModalData() {",
    "function closeModal() {": "function _old_closeModal() {",
    "function openGenericLineTimeline(lineId, destination) {": "function _old_openGenericLineTimeline(lineId, destination) {",
    "function renderGenericTimeline(variationsMap, activeVariation, line) {": "function _old_renderGenericTimeline(variationsMap, activeVariation, line) {",
    "window.switchGenericTimelineVariation = function": "window._old_switchGenericTimelineVariation = function",
    "window.openTripDetail = function": "window._old_openTripDetail = function",
    "window.closeTripDetail = function": "window._old_closeTripDetail = function"
}

for k, v in replacements.items():
    if k in text:
        text = text.replace(k, v)
    else:
        print(f"WARNING: '{k}' not found!")

# Insert new code right before final });
new_code = """
    // --- NUOVA GESTIONE IN-PANEL VIEWS ---
    const mainListsWrapper = document.getElementById('main-lists-wrapper');
    const internalViewWrapper = document.getElementById('internal-view-wrapper');

    window.closeInternalView = function() {
        if(currentInterval) clearInterval(currentInterval);
        if(nextBusInterval) { clearInterval(nextBusInterval); nextBusInterval=null; }
        activeStop = null;
        if (internalViewWrapper) internalViewWrapper.innerHTML = '';
        if (internalViewWrapper) internalViewWrapper.classList.add('hidden');
        if (mainListsWrapper) mainListsWrapper.classList.remove('hidden');
        
        const mainPanel = document.getElementById('main-panel');
        if (mainPanel) mainPanel.scrollTop = 0;
        if(typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
    };

    function closeModal() { window.closeInternalView(); }
    window.closeModal = closeModal;

    function openStopDetails(stop) {
        activeStop = stop;
        if(currentInterval) clearInterval(currentInterval);
        if(nextBusInterval) { clearInterval(nextBusInterval); nextBusInterval=null; }
        
        if (mainListsWrapper) mainListsWrapper.classList.add('hidden');
        if (internalViewWrapper) internalViewWrapper.classList.remove('hidden');
        
        let html = `
            <div class="internal-header">
                <button class="internal-back-btn" onclick="window.closeInternalView()">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <div class="internal-title">${stop.name}</div>
            </div>
            <div id="inpanel-next-bus"></div>
            <div id="inpanel-lines-list"></div>
        `;
        internalViewWrapper.innerHTML = html;
        internalViewWrapper.scrollTop = 0;

        function renderStopData() {
            if (!activeStop || activeStop.id !== stop.id) return;
            const now = new Date();
            const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
            selectedDayType = getTodayDayType();
            
            let absoluteNextTrip = null;
            const routesMap = {};

            stavData.lines.forEach(line => {
                const dayTrips = line.dayTypes[selectedDayType] || [];
                dayTrips.forEach(trip => {
                    const stopEntries = trip.stops.filter(s => s.stopId === activeStop.id);
                    stopEntries.forEach(stopEntry => {
                        const key = line.id + '::' + trip.destination;
                        if (!routesMap[key]) {
                            routesMap[key] = { line: line, destination: trip.destination, trips: [] };
                        }
                        routesMap[key].trips.push({ time: stopEntry.time, fullTrip: trip, variation: stopEntry.variation });
                    });
                });
            });

            const routes = Object.values(routesMap);
            const linesContainer = document.getElementById('inpanel-lines-list');
            const nextBusContainer = document.getElementById('inpanel-next-bus');
            
            if (!linesContainer || !nextBusContainer) return;
            linesContainer.innerHTML = '';

            if (routes.length === 0) {
                linesContainer.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted); font-size: 0.95rem;">Nessuna linea prevista oggi.</p>';
            }

            routes.forEach(route => {
                route.trips.sort((a, b) => a.time.localeCompare(b.time));
                
                for (let i = 0; i < route.trips.length; i++) {
                    const t = route.trips[i];
                    const [timeH, timeM] = t.time.split(':').map(Number);
                    let timeTotalMinutes = timeH * 60 + timeM;
                    // Midnight wrap
                    if (timeTotalMinutes < 240 && currentTotalMinutes >= 18*60) timeTotalMinutes += 24*60;
                    
                    if (timeTotalMinutes >= currentTotalMinutes) {
                        const diffMinutes = timeTotalMinutes - currentTotalMinutes;
                        if (!absoluteNextTrip || diffMinutes < absoluteNextTrip.diff) {
                            absoluteNextTrip = { line: route.line, dest: route.destination, timeStr: t.time, diff: diffMinutes };
                        }
                        break;
                    }
                }

                const lineCard = document.createElement('div');
                lineCard.className = 'line-detail-card';
                lineCard.onclick = () => window.openTripDetail(route.line.id, route.destination, stop.id);
                lineCard.style.cssText = 'background:var(--bg-deep); border-radius:17px; padding:12px 16px; margin-bottom:12px; display:flex; align-items:center; cursor:pointer; box-shadow:0 4px 12px rgba(17,51,92,0.2); transition:transform 0.2s ease, opacity 0.2s ease;';
                
                lineCard.innerHTML = `
                    <div class="route-line" style="background:${route.line.color}; padding:6px 12px; border-radius:12px; font-weight:800; color:${route.line.txColor || '#fff'}; font-size:0.95rem; box-shadow:0 2px 6px rgba(0,0,0,0.2);">${route.line.name}</div>
                    <div class="line-detail-dest" style="flex:1; margin-left:16px; font-weight:600; font-size: 0.95rem; color: #f8f9fa;">Direzione: <span style="opacity:0.8; font-weight:500;">${route.destination}</span></div>
                    <svg viewBox="0 0 24 24" fill="none" class="chevron-right" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; color: var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
                `;
                linesContainer.appendChild(lineCard);
            });

            if (absoluteNextTrip) {
                const liveDiff = absoluteNextTrip.diff;
                const isUrgent = liveDiff <= 5;
                nextBusContainer.innerHTML = `
                <div class="highlight-card" style="margin-bottom: 24px; display:block;">
                    <div class="highlight-badge ${isUrgent ? 'urgent' : ''}">${isUrgent ? 'In Arrivo' : 'Prossimo Bus'}</div>
                    <div class="highlight-main">
                        <div class="highlight-time-left">
                            <span class="huge-text" style="color: ${isUrgent ? '#ff4757' : 'var(--text-white)'}">${liveDiff === 0 ? 'Ora' : liveDiff}</span>
                            <span class="small-text">${liveDiff === 0 ? '' : 'min'}</span>
                        </div>
                        <div class="highlight-info">
                            <div class="highlight-line">${absoluteNextTrip.line.name}</div>
                            <div class="highlight-dest">dir. ${absoluteNextTrip.dest}</div>
                        </div>
                    </div>
                </div>
                `;
            } else {
                nextBusContainer.innerHTML = '';
            }
        }

        renderStopData();
        currentInterval = setInterval(renderStopData, 60000);

        if (map && stop.lat && stop.lng) {
            map.flyTo([stop.lat - 0.005, stop.lng], 16, { animate: true });
        }
    }
    window.openStopDetails = openStopDetails;

    window.openTripDetail = function(lineId, destination, activeStopId) {
        if(currentInterval) clearInterval(currentInterval);
        if(nextBusInterval) { clearInterval(nextBusInterval); nextBusInterval=null; }
        
        const line = stavData.lines.find(l => l.id === lineId);
        if (!line) return;
        
        const sourceStop = stavData.stops.find(s => s.id === activeStopId) || activeStop;
        if (!sourceStop) return;

        const dayTrips = line.dayTypes[getTodayDayType()] || [];
        const validTrips = dayTrips.filter(t => t.destination === destination);
        
        let mainVariationTrip = validTrips.length > 0 ? validTrips[0] : null;
        validTrips.forEach(t => {
            if (t.stops.length > mainVariationTrip.stops.length) {
                mainVariationTrip = t;
            }
        });

        if (internalViewWrapper) internalViewWrapper.scrollTop = 0;
        
        let headerHtml = `
            <div class="internal-header">
                <button class="internal-back-btn" onclick="openStopDetails(stavData.stops.find(s=>s.id === '${activeStopId}'))">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <div class="internal-title">${sourceStop.name}</div>
            </div>
            
            <div class="line-detail-header" style="background:var(--bg-deep); border-radius:17px; padding:16px; margin-bottom:16px; display:flex; align-items:center; box-shadow:0 4px 12px rgba(17,51,92,0.2);">
                <div class="route-line" style="background:${line.color}; padding:6px 12px; border-radius:12px; font-weight:800; color:${line.txColor || '#fff'}; font-size:1rem; box-shadow:0 2px 6px rgba(0,0,0,0.2); margin-right: 14px;">${line.name}</div>
                <div style="flex:1; font-weight:600; color:white; font-size:0.95rem; line-height:1.2;">Direzione:<br><span style="opacity:0.8; font-weight:500;">${destination}</span></div>
            </div>
            
            <div class="orari-box" style="background:var(--bg-deep); border-radius:17px; padding:16px; margin-bottom:16px; box-shadow:0 4px 12px rgba(17,51,92,0.2);">
                <div style="font-weight:700; font-size:1.05rem; color:var(--text-white); margin-bottom:16px;">Orari di passaggio in questa fermata</div>
                <div class="times-grid" style="display:flex; flex-wrap:wrap; gap:10px;">
        `;
        
        if (validTrips.length === 0) {
            headerHtml += `<div style="color:var(--text-muted); font-size:0.9rem;">Nessuna corsa prevista.</div>`;
        } else {
            const now = new Date();
            const currentTotalMinutes = now.getHours()*60 + now.getMinutes();
            
            const stopTimes = [];
            validTrips.forEach(t => {
                const stopEntry = t.stops.find(s => s.stopId === activeStopId);
                if(stopEntry) {
                    stopTimes.push({ time: stopEntry.time, variation: stopEntry.variation, tripId: t.tripId });
                }
            });
            
            stopTimes.sort((a,b)=> a.time.localeCompare(b.time));
            
            let nextIndexFound = false;
            stopTimes.forEach(st => {
                const [h, m] = st.time.split(':').map(Number);
                let tm = h*60+m;
                if (tm < 240 && currentTotalMinutes >= 18*60) tm += 24*60;
                
                let cls = 'future';
                if(tm < currentTotalMinutes) cls = 'past';
                else if(!nextIndexFound && tm >= currentTotalMinutes) { cls = 'next'; nextIndexFound = true; }
                
                headerHtml += `<div class="time-badge ${cls}" style="flex: 1 1 calc(25% - 10px); min-width: 60px; justify-content:center; margin:0;"><span>${st.time}</span>${st.variation ? `<span class="time-variation" style="margin-left:4px;">${st.variation}</span>` : ''}</div>`;
            });
        }
        headerHtml += `</div></div>`;

        if (mainVariationTrip && mainVariationTrip.stops.length > 0) {
            headerHtml += `
            <div class="timeline-box" style="background:var(--bg-deep); border-radius:17px; padding:16px; box-shadow:0 4px 12px rgba(17,51,92,0.2); margin-bottom: 2rem;">
                <div style="font-weight:700; font-size:1.05rem; color:white; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                    Fermate e percorso
                    <button class="back-btn" onclick="window.showTripOnMap('${mainVariationTrip.tripId}', '${line.id}')" style="background:var(--accent-color); color:white; border:none; border-radius:8px; padding:6px 12px; font-size:0.8rem; font-weight:700; box-shadow:0 4px 10px rgba(0,0,0,0.2);">Mappa</button>
                </div>
                <div class="timeline-scroll" style="position:relative; margin-top:0.5rem; margin-bottom: 1rem;">
            `;
            
            mainVariationTrip.stops.forEach((s, idx) => {
                const isMatch = (s.stopId === activeStopId);
                const sInfo = stavData.stops.find(fs => fs.id === s.stopId);
                const sName = sInfo ? sInfo.name : 'Fermata';
                const isLast = idx === mainVariationTrip.stops.length - 1;
                
                headerHtml += `
                    <div class="timeline-row ${isMatch ? 'next' : ''}" style="${isMatch ? 'background-color:rgba(255,235,59,0.15); border-radius:8px; display:flex; align-items:stretch;' : 'display:flex; align-items:stretch;'} cursor:pointer; min-height:50px; padding: 0 8px; margin-bottom:0px;" onclick="window.openStopFromTimeline('${s.stopId}')">
                        <div class="timeline-graphic" style="position:relative; width:40px; display:flex; flex-direction:column; align-items:center;">
                            <div class="timeline-node" style="width:14px; height:14px; border-radius:50%; border:3px solid ${line.color}; background:${isMatch ? line.color : 'white'}; position:absolute; top:18px; z-index:2; ${isMatch ? 'transform:scale(1.2); box-shadow:0 0 0 3px rgba('+hexToRgb(line.color)+',0.3);' : ''}"></div>
                            ${!isLast ? `<div class="timeline-line" style="width:4px; height:100%; background:${line.color}; position:absolute; top:25px; bottom:-25px; z-index:1;"></div>` : ''}
                        </div>
                        <div class="timeline-content" style="flex:1; padding:16px 0; border-bottom: ${!isLast ? '1px dashed var(--border-color)' : 'none'}; display:flex; align-items:center;">
                            <div class="stop-name" style="font-size:0.95rem; line-height:1.3; ${isMatch ? 'font-weight:700; color:#ffeb3b;' : 'color:var(--text-white);'}">${sName}</div>
                        </div>
                    </div>
                `;
            });
            headerHtml += `</div></div>`;
        }

        internalViewWrapper.innerHTML = headerHtml;
    }

    // Helper:
    function hexToRgb(hex) {
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return r+", "+g+", "+b;
    }
"""

if "window.closeInternalView = function" not in text:
    if "});" in text:
        last_index = text.rfind("});")
        text = text[:last_index] + new_code + "\n" + text[last_index:]
    else:
        print("WARNING: }); not found. Appending to end.")
        text += new_code

with codecs.open("c:/Users/mella/Documents/MyATSOM/app.js", "w", "utf-8") as f:
    f.write(text)

print("SUCCESS")
