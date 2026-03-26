document.addEventListener('DOMContentLoaded', () => {
    // --- MAPPA (LEAFLET) ---
    let map;
    let markers = [];
    let poiMarker = null; // Segnaposto temporaneo per POI/Indirizzi

    // Icon mapping - accessible globally within DOMContentLoaded
    // Icon mappings for Map (pin version)
    const STOP_ICONS = {
        'STAV': 'icons/BusStopSTAV.svg',
        'ATM': 'icons/BusStopATM.svg',
        'AGV': 'icons/BusStopAGV.svg',
        'M': 'icons/MetroStop.svg',
        'S': 'icons/SLinesStop.svg',
        'T': 'icons/TicketSelling.svg',
        'default': 'icons/GeneralBusStop.svg'
    };

    const LIST_ICONS = {
        'STAV': 'icons/IconaSTAV.svg',
        'ATM': 'icons/IconaATM.svg',
        'AGV': 'icons/IconaAGV.svg',
        'M': 'icons/Group 193.svg',
        'S': 'icons/Group 195.svg',
        'T': 'icons/Group 194.svg',
        'default': 'icons/Bus.svg'
    };

    function getOperatorDisplayName(op) {
        if (op === 'M') return 'Metro';
        if (op === 'S') return 'Linee Suburbane';
        return op || 'STAV';
    }

    function getStopIcon(stop) {
        const iconPath = STOP_ICONS[stop.operatore] || STOP_ICONS['default'];
        return L.divIcon({
            className: 'custom-map-marker-raw',
            html: `<img src="${iconPath}" style="width:36px; height:40px; display:block;">`,
            iconSize: [36, 40],
            iconAnchor: [18, 40]
        });
    }

    // Pre-calculate lines passing through each stop efficiently
    const stopsById = new Map();
    stavData.stops.forEach(stop => {
        stop.passingLines = [];
        stopsById.set(stop.id, stop);
    });

    stavData.lines.forEach(line => {
        const uniqueStopsInLine = new Set();
        for (let dayVariant in line.dayTypes) {
            const variantTrips = line.dayTypes[dayVariant];
            if (variantTrips) {
                variantTrips.forEach(trip => {
                    trip.stops.forEach(st => uniqueStopsInLine.add(st.stopId));
                });
            }
        }
        uniqueStopsInLine.forEach(stopId => {
            const stop = stopsById.get(stopId);
            if (stop) {
                stop.passingLines.push({
                    id: line.id,
                    color: line.color,
                    txColor: line.txColor
                });
            }
        });
    });

    // Unify all stops — accessible by renderLists and other functions
    const allStops = [
        ...(typeof stavData !== 'undefined' ? stavData.stops : []),
        ...(typeof metroTreniStops !== 'undefined' ? metroTreniStops : []),
        ...(typeof rivenditeBiglietti !== 'undefined' ? rivenditeBiglietti : [])
    ];

    if (document.getElementById('map')) {
        map = L.map('map', { zoomControl: false }).setView([45.41, 8.95], 11);
        window.appMap = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Inizializza zone tariffarie STIBM
        if (typeof initStibmZones === 'function') {
            initStibmZones(map);
        }

        allStops.forEach(stop => {
            if (stop.lat && stop.lng) {
                const marker = L.marker([stop.lat, stop.lng], { icon: getStopIcon(stop) }).addTo(map);
                marker.on('click', () => {
                    openStopDetails(stop);
                });
                markers.push({ stop, marker });
            }
        });

        // Event listeners to update markers and list on map changes
        map.on('moveend', () => {
            updateMarkersVisibility();
            if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
            if (!activeStop || activeStop.id === "user_location_stop") {
                renderLists(searchInput.value ? searchInput.value.toLowerCase().trim() : "");
            }
        });

        map.on('zoomend', () => {
            if (typeof updateStibmVisibility === 'function') {
                updateStibmVisibility(map);
            }
            updateMarkersVisibility();
            if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
            if (!activeStop || activeStop.id === "user_location_stop") {
                renderLists(searchInput.value ? searchInput.value.toLowerCase().trim() : "");
            }
        });

        // Helper function for empty state button
        window.centerMapOnAllStops = function () {
            if (window.appMap && typeof stavData !== 'undefined' && stavData.stops) {
                const validStops = stavData.stops.filter(s => s.lat && s.lng);
                if (validStops.length > 0) {
                    const bounds = L.latLngBounds(validStops.map(s => [s.lat, s.lng]));
                    window.appMap.fitBounds(bounds, { padding: [40, 40] });
                }
            }
        };
    }

    // Riferimenti DOM
    const searchInput = document.getElementById('stop-searchInput');
    const searchResults = document.getElementById('search-results');
    const btnOpenSearch = document.getElementById('btn-open-search');
    const btnLocation = document.getElementById('btn-location');
    const btnFilter = document.getElementById('btn-filter');
    const searchPremiumContainer = document.getElementById('premium-search-container');
    const rightActionGroup = document.getElementById('action-group-right');
    const mainListsWrapper = document.getElementById('main-lists-wrapper');
    const internalViewWrapper = document.getElementById('internal-view-wrapper');
    const nearbySection = document.getElementById('nearby-section');
    const nearbyResults = document.getElementById('nearby-results');
    const otherServicesResults = document.getElementById('other-services-results');

    const floatingResults = document.getElementById('floating-results-container');
    const floatingList = document.getElementById('floating-results-list');

    const blurOverlay = document.getElementById('map-blur-overlay');

    // SEARCH TOGGLE & BLUR (IMM 1, 2, 4)
    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            map.getContainer().classList.add('map-blurred');
            if (blurOverlay) blurOverlay.classList.remove('hidden');
            if (searchInput.value.trim() !== "") {
                floatingResults.classList.remove('hidden');
            }
        });

        searchInput.addEventListener('blur', () => {
            // Piccolo timeout per permettere il click sui risultati
            setTimeout(() => {
                // Se il focus non è sul overlay o sui risultati, chiudi tutto
                if (document.activeElement !== searchInput) {
                    map.getContainer().classList.remove('map-blurred');
                    if (blurOverlay) blurOverlay.classList.add('hidden');
                    floatingResults.classList.add('hidden');
                }
            }, 300);
        });
    }

    if (blurOverlay) {
        blurOverlay.addEventListener('click', () => {
            searchInput.blur();
            map.getContainer().classList.remove('map-blurred');
            blurOverlay.classList.add('hidden');
            floatingResults.classList.add('hidden');
        });
    }

    if (btnOpenSearch && searchPremiumContainer && rightActionGroup) {
        btnOpenSearch.addEventListener('click', () => {
            searchPremiumContainer.classList.remove('collapsed');
            rightActionGroup.classList.add('hidden-group');
            setTimeout(() => searchInput.focus(), 50);
        });
    }

    // LOCATION BUTTON
    if (btnLocation) {
        btnLocation.addEventListener('click', () => {
            if (userLocation && window.appMap) {
                window.appMap.flyTo([userLocation.lat, userLocation.lng], 16, { animate: true });
            } else if ("geolocation" in navigator) {
                alert("Attesa geolocalizzazione o permessi mancanti. Riprova tra poco.");
            } else {
                alert("Geolocalizzazione non supportata o disabilitata.");
            }
        });
    }

    // --- FILTER SYSTEM ---
    const mapFilters = {
        showStibm: true,
        showMetro: true,
        showSurface: true,
        showTrain: true,
        selectedLines: new Set()
    };

    const filterSection = document.getElementById('filter-section');
    const chkStibm = document.getElementById('chk-stibm');
    const chkMetro = document.getElementById('chk-metro');
    const chkSurface = document.getElementById('chk-surface');
    const chkTrain = document.getElementById('chk-train');
    const btnBackFilters = document.getElementById('btn-back-filters');

    // Toggle Filter Section
    if (btnFilter && filterSection && mainListsWrapper) {
        btnFilter.addEventListener('click', () => {
            mainListsWrapper.classList.add('hidden');
            filterSection.classList.remove('hidden');
            if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();

            // Assicurati che il pannello sia alzato per mostrare i filtri
            if (mainPanel && !mainPanel.classList.contains('expanded')) {
                mainPanel.classList.add('expanded');
            }
        });
    }

    if (btnBackFilters && filterSection && mainListsWrapper) {
        btnBackFilters.addEventListener('click', () => {
            filterSection.classList.add('hidden');
            mainListsWrapper.classList.remove('hidden');
            if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
        });
    }

    const refreshAll = () => {
        updateMarkersVisibility();
        renderLists(searchInput.value ? searchInput.value.toLowerCase().trim() : "");
    };

    if (chkStibm) {
        chkStibm.addEventListener('change', (e) => {
            mapFilters.showStibm = e.target.checked;
            if (typeof toggleStibmLayer === 'function') {
                toggleStibmLayer(mapFilters.showStibm);
            }
        });
    }

    if (chkMetro) chkMetro.addEventListener('change', (e) => { mapFilters.showMetro = e.target.checked; refreshAll(); });
    if (chkSurface) chkSurface.addEventListener('change', (e) => { mapFilters.showSurface = e.target.checked; refreshAll(); });
    if (chkTrain) chkTrain.addEventListener('change', (e) => { mapFilters.showTrain = e.target.checked; refreshAll(); });

    // NAV BAR: ACTIVE TAB + SLIDING INDICATOR + MENU OVERLAY
    const btnMenu = document.getElementById('btn-menu');
    const tabMappa = document.getElementById('tab-mappa');
    const tabViaggio = document.getElementById('tab-viaggio');
    const infoSection = document.getElementById('info-section'); // Keep ref for compat
    const menuOverlay = document.getElementById('menu-overlay');
    const navIndicator = document.getElementById('nav-active-indicator');
    const nav = document.getElementById('bottom-tab-nav');

    const mainSearchBar = document.getElementById('main-search-bar');

    function setActiveTab(activeBtn) {
        // Update active class
        [tabViaggio, tabMappa, btnMenu].forEach(btn => btn && btn.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');

        // Move sliding indicator
        if (navIndicator && nav && activeBtn) {
            const navRect = nav.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            const indicatorLeft = (btnRect.left - navRect.left) + (btnRect.width / 2) - 16;
            navIndicator.style.left = indicatorLeft + 'px';
        }

        const isMenuTab = activeBtn === btnMenu;

        // Show/hide menu overlay
        if (menuOverlay) {
            if (isMenuTab) {
                menuOverlay.classList.remove('hidden');
            } else {
                menuOverlay.classList.add('hidden');
            }
        }

        // Hide top search bar on menu tab, show it otherwise
        if (mainSearchBar) {
            mainSearchBar.style.transition = 'opacity 0.2s';
            mainSearchBar.style.opacity = isMenuTab ? '0' : '1';
            mainSearchBar.style.pointerEvents = isMenuTab ? 'none' : '';
        }

        // White background on wave banner only when menu is open
        const waveBanner = document.querySelector('.top-wave-banner');
        if (waveBanner) {
            waveBanner.classList.toggle('menu-open', isMenuTab);
        }

        // Hide old info-section if it exists
        if (infoSection) infoSection.classList.add('hidden');
    }

    // Wire up buttons
    if (tabMappa) {
        tabMappa.addEventListener('click', () => {
            setActiveTab(tabMappa);
            renderLists(searchInput && searchInput.value ? searchInput.value.toLowerCase().trim() : '');
        });
    }
    if (tabViaggio) {
        tabViaggio.addEventListener('click', () => {
            setActiveTab(tabViaggio);
            if (window.TravelCompanion && window.TravelCompanion.open) window.TravelCompanion.open();
        });
    }
    if (btnMenu) {
        btnMenu.addEventListener('click', () => {
            const isMenuOpen = !menuOverlay.classList.contains('hidden');
            if (isMenuOpen) {
                setActiveTab(tabMappa);
            } else {
                setActiveTab(btnMenu);
            }
        });
    }

    // Initial indicator position (on mappa)
    requestAnimationFrame(() => {
        if (tabMappa) setActiveTab(tabMappa);
    });

    // Riferimenti Modal
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
    const hExactTime = document.getElementById('highlight-exact-time');

    // Date Settings
    const SCHOOL_END_DATE_2026 = new Date('2026-06-08T00:00:00');

    // Splash Screen logic
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        setTimeout(() => {
            splashScreen.classList.add('hidden');
        }, 800); // 800ms mostra un po' il logo, poi sfuma
    }

    // Festività con Servizio SOSPESO (Mese 0-indicizzato, quindi 0=Gen, 4=Mag, 7=Ago, 11=Dic)
    const suspendedDates = [
        { month: 0, date: 1 },   // 1 Gennaio - Capodanno
        { month: 4, date: 1 },   // 1 Maggio - Festa dei Lavoratori
        { month: 7, date: 15 },  // 15 Agosto - Ferragosto
        { month: 11, date: 25 }  // 25 Dicembre - Natale
    ];

    // Festività Nazionali Regolari (trattate come Domenica/Festivo)
    const nationalHolidays = [
        { month: 3, date: 25 },  // 25 Aprile - Liberazione
        { month: 5, date: 2 }    // 2 Giugno - Festa Repubblica
    ];

    // Controlla se una data (oggi) matcha un array di giorni specifici
    function isDateInArray(testDate, dateArray) {
        const m = testDate.getMonth();
        const d = testDate.getDate();
        return dateArray.some(holiday => holiday.month === m && holiday.date === d);
    }

    // Calcola il tipo di giorno odierno REALE
    function getTodayDayType() {
        const today = new Date();
        const dayIndex = today.getDay(); // 0 = Domenica, 6 = Sabato

        // 1) Controllo Festività Nazionale (Trattato come Domenica)
        if (isDateInArray(today, nationalHolidays) || dayIndex === 0) {
            return 'festivo';
        }

        // 2) Controllo Sabato (Scolastico vs Non Scolastico)
        if (dayIndex === 6) {
            return (today >= SCHOOL_END_DATE_2026) ? 'sabato_non_scolastico' : 'sabato_scolastico';
        }

        // 3) Feriale: Controllo Scolastico vs Non Scolastico (dall'8 Giugno 2026 in poi)
        if (today >= SCHOOL_END_DATE_2026) {
            return 'feriale_non_scolastico';
        }

        return 'feriale_scolastico';
    }

    // Controlla e mostra il banner se il servizio è sospeso totalmente oggi
    function checkSuspendedService() {
        const today = new Date();
        const banner = document.getElementById('suspended-banner');

        if (isDateInArray(today, suspendedDates)) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    }

    // Esegui controllo al caricamento
    checkSuspendedService();

    let currentInterval = null;
    let activeStop = null;
    let nextBusInterval = null;

    // Stato: Giorno Selezionato (Inizializzato a Oggi)
    let selectedDayType = getTodayDayType();

    // 1. Inizializza i chips in base al giorno odierno
    dayChips.forEach(chip => {
        if (chip.dataset.day === selectedDayType) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }

        // Click Listener sul Chip
        chip.addEventListener('click', () => {
            dayChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedDayType = chip.dataset.day;
            updateModalData(); // Ricarica coi nuovi dati
        });
    });

    // 2. Logica di  e geolocalizzazione
    const allStopsTitle = document.getElementById('all-stops-title');

    let userLocation = null;

    // Distanza di Haversine (restituisce km)
    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
        const R = 6371; // Raggio della terra in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Avvia il tracciamento in tempo reale della posizione dell'utente
    if ("geolocation" in navigator) {
        let userMarker = null;

        navigator.geolocation.watchPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Opzionale: se usiamo la geolocalizzazione mostriamo o aggiorniamo un marker blu dell'utente
                if (map) {
                    if (!userMarker) {
                        const userIcon = L.divIcon({
                            className: 'custom-map-marker user-marker',
                            html: `<div class="marker-pin" style="background:#0984e3; border-color:#fff;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg></div>`,
                            iconSize: [36, 36],
                            iconAnchor: [18, 36]
                        });
                        userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

                        userMarker.on('click', async () => {
                            let addressString = "Indirizzo in fase di recupero...";

                            // Fake Stop per mostrare l'UI della posizione utente
                            const userStop = {
                                id: "user_location_stop",
                                name: "La tua posizione",
                                lat: userLocation.lat, // snapshotte the current moment
                                lng: userLocation.lng, // snapshotte the current moment
                                routes: [], // Niente rotte, quindi nessun orario
                                isUserLocation: true // custom flag let's pass it anyway
                            };

                            // Mostriamo provvisoriamente il popup
                            highlightCard.classList.add('hidden');
                            openStopDetails(userStop);

                            try {
                                // Reverse geocoding via OpenStreetMap Nominatim
                                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json&addressdetails=1`);
                                const data = await response.json();

                                if (data && data.address) {
                                    const a = data.address;
                                    const street = a.road || a.pedestrian || a.isolated_dwelling || "";
                                    const houseNumber = a.house_number ? ` ${a.house_number}` : "";
                                    const city = a.city || a.town || a.village || a.municipality || "";
                                    const postcode = a.postcode || "";
                                    const province = a.county || a.state || "";

                                    addressString = `${street}${houseNumber}, ${city}, ${postcode}, ${province}`;
                                    // Pulisce stringa da virgole iniziali/finali vuote se mancano dati
                                    addressString = addressString.replace(/^[\s,]+/, '').replace(/[\s,]+$/, '').trim();
                                } else {
                                    addressString = "Impossibile recuperare l'indirizzo";
                                }
                            } catch (e) {
                                addressString = "Errore durante il recupero indirizzo";
                                console.error(e);
                            }

                            // Modifichiamo l'UI al volo se è aperto
                            if (activeStop && activeStop.id === "user_location_stop") {
                                // Cambiamo il subtitle o un box per mostrare l'indirizzo
                                const subtitleEl = document.querySelector('.subtitle');
                                if (subtitleEl) {
                                    subtitleEl.innerHTML = `<div style="font-size: 0.95rem; font-weight: normal; margin-top:-10px; margin-bottom: 20px; line-height: 1.4;">${addressString}</div>`;
                                }
                                // Nascondi i selettori giorno dato che non ci sono mezzi
                                const chipsContainer = document.querySelector('.day-chips-container');
                                if (chipsContainer) chipsContainer.style.display = 'none';
                            }
                        });
                    } else {
                        // Se il marker esiste già, aggiorniamo solo la sua posizione
                        userMarker.setLatLng([userLocation.lat, userLocation.lng]);
                    }
                }

                // Ricalcola e renderizza con le distanze
                // Solo se l'utente non sta guardando una fermata specifica oppure sta guardando se stesso
                if (!activeStop || activeStop.id === "user_location_stop") {
                    renderLists(searchInput.value ? searchInput.value.toLowerCase().trim() : "");
                }
            },
            (error) => {
                console.warn("Geolocalizzazione rifiutata o non disponibile", error);
                if (!userLocation) {
                    renderLists(searchInput.value ? searchInput.value.toLowerCase().trim() : ""); // Renderizza normalmente se non avevamo ancora lo user
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    let searchDebounce = null;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (query.length > 0) {
            floatingResults.classList.remove('hidden');
            renderFloatingResults(query);
        } else {
            floatingResults.classList.add('hidden');
        }

        // Se query > 3, cerchiamo anche su Nominatim
        clearTimeout(searchDebounce);
        if (query.length >= 3 && window.TravelCompanion && window.TravelCompanion.searchNominatim) {
            searchDebounce = setTimeout(async () => {
                const results = await window.TravelCompanion.searchNominatim(query);
                if (results && results.length > 0) {
                    renderFloatingPoiResults(results);
                }
            }, 500);
        }
    });

    function renderFloatingResults(query) {
        floatingList.innerHTML = '';

        // 1. Linee
        const filteredLines = stavData.lines.filter(l =>
            l.id.toLowerCase().includes(query) ||
            (l.description && l.description.toLowerCase().includes(query))
        );

        filteredLines.forEach(line => {
            const card = document.createElement('div');
            card.className = 'search-card-premium';
            const iconPath = LIST_ICONS[line.operatore] || LIST_ICONS['default'];
            card.innerHTML = `
                <div class="search-card-icon-box line-circle" style="background: rgba(255,255,255,0.05);">
                    <img src="${iconPath}" style="width:20px; height:20px;">
                </div>
                <div class="search-card-info">
                    <div class="card-main-text">Linea ${line.id}</div>
                    <div class="card-sub-text">${line.description || 'Autolinea d\'area'}</div>
                </div>
            `;
            card.onclick = () => {
                // Trova la prima destinazione valida per questa linea
                const firstTrip = Object.values(line.dayTypes)[0]?.[0];
                if (firstTrip) {
                    window.openTripDetail(line.id, firstTrip.destination);
                }
            };
            floatingList.appendChild(card);
        });

        // 2. Fermate
        const allStops = [
            ...(typeof stavData !== 'undefined' ? stavData.stops : []),
            ...(typeof metroTreniStops !== 'undefined' ? metroTreniStops : []),
            ...(typeof rivenditeBiglietti !== 'undefined' ? rivenditeBiglietti : [])
        ];

        const filteredStops = allStops.filter(s =>
            s.name.toLowerCase().includes(query)
        ).slice(0, 10);

        filteredStops.forEach(stop => {
            const card = document.createElement('div');
            card.className = 'search-card-premium';
            const iconPath = LIST_ICONS[stop.operatore] || LIST_ICONS['default'];
            card.innerHTML = `
                <div class="search-card-icon-box" style="background: rgba(255,255,255,0.05);">
                    <img src="${iconPath}" style="width:20px; height:20px;">
                </div>
                <div class="search-card-info">
                    <div class="card-main-text">${stop.name}</div>
                    <div class="card-sub-text">Fermata &bull; ${getOperatorDisplayName(stop.operatore)}</div>
                </div>
            `;
            card.onclick = () => openStopDetails(stop);
            floatingList.appendChild(card);
        });
    }

    function renderFloatingPoiResults(results) {
        // Aggiunge i risultati di Nominatim alla lista floating esistente
        results.forEach(poi => {
            const name = poi.display_name.split(',')[0];
            const sub = poi.display_name.split(',').slice(1, 3).join(', ');

            const card = document.createElement('div');
            card.className = 'search-card-premium';
            card.innerHTML = `
                <div class="search-card-icon-box">
                    <img src="icons/Map_Pin.svg" style="width:20px; height:20px; filter:brightness(0) invert(1);">
                </div>
                <div class="search-card-info">
                    <div class="card-main-text">${name}</div>
                    <div class="card-sub-text">${sub}</div>
                </div>
            `;
            card.onclick = () => {
                openPoiOnMap({
                    lat: parseFloat(poi.lat),
                    lng: parseFloat(poi.lon),
                    label: name,
                    fullAddress: poi.display_name
                });
            };
            floatingList.appendChild(card);
        });
    }

    window.openPoiOnMap = function (poi) {
        if (!map) return;

        // Chiudi UI ricerca se aperta
        const searchInput = document.getElementById('stop-searchInput');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.blur();
        }

        const latlng = [poi.lat, poi.lng];
        map.flyTo(latlng, 16, { animate: true });

        // Rimuovi vecchio marker POI
        if (poiMarker) map.removeLayer(poiMarker);

        const poiIcon = L.divIcon({
            className: 'custom-map-marker poi-premium-marker',
            html: `
                <div class="marker-pin red-version">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="10" r="3"></circle>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    </svg>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });

        poiMarker = L.marker(latlng, { icon: poiIcon, zIndexOffset: 1500 }).addTo(map);
        window.renderAddressPanel(poi.label || poi.fullAddress || "Punto selezionato", latlng);
    };

    window.renderAddressPanel = function (address, latlng) {
        // Nascondi sezioni standard
        if (mainListsWrapper) mainListsWrapper.style.display = 'none';
        if (internalViewWrapper) {
            internalViewWrapper.classList.remove('hidden');
            internalViewWrapper.innerHTML = `
                <div class="address-panel-view">
                    <div class="address-main-row">
                        <button class="address-close-btn" onclick="window.closeAddressPanel()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div class="address-info-box">
                            <svg class="address-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <div class="address-text">${address}</div>
                        </div>
                    </div>
                    <button class="portami-qui-btn" onclick="window.startNavigationTo(${latlng[0]}, ${latlng[1]}, '${address.replace(/'/g, "\\'")}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                        Portami qui
                    </button>
                </div>
            `;
        }

        // Espandi il pannello se non lo è già
        const mainPanel = document.getElementById('main-panel');
        if (mainPanel && !mainPanel.classList.contains('expanded')) {
            isExpanded = true;
            mainPanel.classList.add('expanded');
        }
    }

    window.closeAddressPanel = function () {
        if (poiMarker) map.removeLayer(poiMarker);
        if (internalViewWrapper) {
            internalViewWrapper.classList.add('hidden');
            internalViewWrapper.innerHTML = '';
        }
        if (mainListsWrapper) mainListsWrapper.style.display = 'flex';

        isExpanded = false;
        const mainPanel = document.getElementById('main-panel');
        if (mainPanel) mainPanel.classList.remove('expanded');
    }

    window.startNavigationTo = function (lat, lng, label) {
        if (window.TravelCompanion && window.TravelCompanion.planRoute) {
            window.TravelCompanion.open();
            // Inyectamos destino en TC (presumibilmente tramite un metodo esistente o impostando input)
            const destInput = document.getElementById('tc-dest-input');
            if (destInput) {
                destInput.value = label || "Punto sulla mappa";
                // Esegui trigger planning se possibile o lascia che l'utente clicchi "Cerca"
            }
        }
    }

    // LISTENER LONG-PRESS MAPPA PER INDIRIZZI (IMM 3)
    let pressTimer;
    if (map) {
        const startPress = (e) => {
            // Se si clicca sulla mappa mentre la ricerca è aperta, l'overlay cattura il click.
            // Se arriviamo qui, l'overlay è nascosto.

            if (pressTimer) clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                const latlng = [e.latlng.lat, e.latlng.lng];
                handleMapSelection(latlng);
            }, 600); // 600ms per il long-press
        };

        const cancelPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
        };

        map.on('mousedown', startPress);
        map.on('touchstart', startPress);
        map.on('mouseup', cancelPress);
        map.on('touchend', cancelPress);
        map.on('mousemove', cancelPress);
        map.on('touchmove', cancelPress);
        map.on('dragstart', cancelPress);
        map.on('zoomstart', cancelPress);
    }

    async function handleMapSelection(latlng) {
        // Mostra info caricamento
        window.renderAddressPanel("Recupero indirizzo...", latlng);

        // Aggiungi marker temporaneo
        if (poiMarker) map.removeLayer(poiMarker);
        const poiIcon = L.divIcon({
            className: 'custom-map-marker poi-premium-marker',
            html: `<div class="marker-pin red-version"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"></circle><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });
        poiMarker = L.marker(latlng, { icon: poiIcon, zIndexOffset: 1500 }).addTo(map);

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng[0]}&lon=${latlng[1]}&format=json&addressdetails=1`);
            const data = await response.json();
            let addressString = "Indirizzo non trovato";
            if (data && data.display_name) {
                const parts = data.display_name.split(',');
                addressString = parts.slice(0, 3).join(',');
            }
            window.renderAddressPanel(addressString, latlng);
        } catch (err) {
            window.renderAddressPanel("Errore recupero indirizzo", latlng);
        }
    }

    window.planToPoi = function (lat, lng, label) {
        window.startNavigationTo(lat, lng, label);
    };

    window.updateMapStatePill = function () {
        const statePill = document.getElementById('map-state-pill');
        const mainPanel = document.getElementById('main-panel');
        const searchOpen = document.getElementById('info-section') && !document.getElementById('info-section').classList.contains('hidden');

        if (!statePill) return;

        const isExpanded = mainPanel && mainPanel.classList.contains('expanded');
        const mapZoom = map ? map.getZoom() : 0;
        const MIN_ZOOM = 14;

        if (searchOpen) {
            statePill.classList.add('hidden');
            return;
        }

        statePill.classList.remove('hidden');

        // Check if out of zone: zoom is high but no markers are in view
        let visibleMarkersCount = 0;
        if (map && mapZoom >= MIN_ZOOM) {
            const bounds = map.getBounds();
            markers.forEach(m => {
                if (bounds.contains(m.marker.getLatLng())) visibleMarkersCount++;
            });
        }

        if (map && mapZoom >= MIN_ZOOM && visibleMarkersCount === 0) {
            statePill.classList.add('ooz-look');
            statePill.innerHTML = `
                <div class="ooz-status">
                    <img src="icons/Wavy_Warning.svg" style="width:32px; height:32px; filter: brightness(0) invert(1);">
                    <span>Sei andato fuori zona!</span>
                </div>
                <div class="ooz-action" onclick="if(window.centerMapOnAllStops) window.centerMapOnAllStops()">
                    Portami a Milano
                </div>
            `;
        } else {
            statePill.classList.remove('ooz-look');
            if (map && mapZoom < MIN_ZOOM) {
                statePill.innerHTML = `
                    <img id="map-state-icon" src="icons/Wavy_Warning.svg">
                    <div id="map-state-text">Aumenta lo zoom per visualizzare le fermate e i servizi!</div>
                `;
            } else if (!isExpanded) {
                statePill.innerHTML = `
                    <img id="map-state-icon" src="icons/Wavy_Warning.svg">
                    <div id="map-state-text">Trascina verso l'alto il pannello per visualizzare le fermate vicino a te!</div>
                `;
            } else {
                statePill.innerHTML = `
                    <img id="map-state-icon" src="icons/Wavy_Help.svg">
                    <div id="map-state-text">Quelle visibili sono le fermate ed i servizi visibili sulla mappa.</div>
                `;
            }
        }
    };

    function updateMarkersVisibility() {
        if (!map) return;
        const mapZoom = map.getZoom();
        const MIN_ZOOM = 14;

        markers.forEach(m => {
            const stop = m.stop;
            let categoryVisible = true;
            if (stop.operatore === 'M' && !mapFilters.showMetro) categoryVisible = false;
            if (['STAV', 'ATM', 'AGV'].includes(stop.operatore) && !mapFilters.showSurface) categoryVisible = false;
            if (stop.operatore === 'S' && !mapFilters.showTrain) categoryVisible = false;

            const isZoomVisible = mapZoom >= MIN_ZOOM;

            if (categoryVisible && isZoomVisible) {
                if (!map.hasLayer(m.marker)) map.addLayer(m.marker);
            } else {
                if (map.hasLayer(m.marker)) map.removeLayer(m.marker);
            }
        });
    }


    function renderLists(query = '') {
        // Se il menu info è aperto, non renderizzare le liste normali
        if (infoSection && !infoSection.classList.contains('hidden')) return;

        searchResults.innerHTML = '';
        nearbyResults.innerHTML = '';
        if (otherServicesResults) otherServicesResults.innerHTML = '';

        // Puliamo anche i POI se query è vuota
        const poiSection = document.getElementById('poi-section');
        if (poiSection && query.length === 0) {
            poiSection.remove();
        } else if (poiSection && query.length < 3) {
            const poiList = document.getElementById('poi-results');
            if (poiList) poiList.innerHTML = '';
        }

        let filteredStops = allStops.filter(stop => {
            // Filter by transport category
            if (stop.operatore === 'M' && !mapFilters.showMetro) return false;
            if (['STAV', 'ATM', 'AGV'].includes(stop.operatore) && !mapFilters.showSurface) return false;
            if (stop.operatore === 'S' && !mapFilters.showTrain) return false;

            return true;
        });

        // Se c'è la geolocalizzazione, calcola distanze
        if (userLocation) {
            filteredStops.forEach(stop => {
                stop.distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
            });
        } else {
            filteredStops.forEach(stop => stop.distance = Infinity);
        }

        const mapZoom = map ? map.getZoom() : 0;
        const MIN_ZOOM = 14;

        // Gestione visibilità marker sulla mappa
        updateMarkersVisibility();

        // Separate transport from service (resellers)
        const transportStops = filteredStops.filter(s => s.operatore !== 'T');
        const serviceStops = filteredStops.filter(s => s.operatore === 'T');

        // === RICERCA ATTIVA ==============================
        if (query.length > 0) {
            nearbySection.classList.add('hidden');

            let searchLines = [];
            let searchStops = [];
            let searchServices = [];

            // 1. Cerca nelle Linee (es. Z553)
            stavData.lines.forEach(line => {
                if (line.id.toLowerCase().includes(query) || line.name.toLowerCase().includes(query)) {
                    const destinations = new Set();
                    for (let day in line.dayTypes) {
                        line.dayTypes[day].forEach(trip => destinations.add(trip.destination));
                    }
                    destinations.forEach(dest => {
                        searchLines.push({
                            type: 'line',
                            lineId: line.id,
                            lineName: line.name,
                            color: line.color,
                            txColor: line.txColor,
                            destination: dest
                        });
                    });
                }
            });

            // 2. Cerca nelle Fermate (Trasporto)
            const matchedTransport = transportStops.filter(stop => stop.name.toLowerCase().includes(query));
            if (userLocation) matchedTransport.sort((a, b) => a.distance - b.distance);
            matchedTransport.forEach(stop => searchStops.push({ type: 'stop', ...stop }));

            // 3. Cerca nei Servizi (Rivendite)
            const matchedServices = serviceStops.filter(stop => stop.name.toLowerCase().includes(query));
            if (userLocation) matchedServices.sort((a, b) => a.distance - b.distance);
            matchedServices.forEach(stop => searchServices.push({ type: 'stop', ...stop }));

            if (searchLines.length === 0 && searchStops.length === 0 && searchServices.length === 0) {
                searchResults.innerHTML = '<div style="text-align:center; padding: 2rem 1rem; color:var(--text-muted);">Nessuna fermata o linea trovata per questa ricerca.</div>';
                return;
            }

            // Render Results
            if (searchLines.length > 0 || searchStops.length > 0) {
                appendStopsToList([...searchLines, ...searchStops], searchResults);
            }
            if (searchServices.length > 0 && otherServicesResults) {
                appendStopsToList(searchServices, otherServicesResults);
            }
            return;
        }

        // === NESSUNA RICERCA ==============================
        nearbySection.classList.add('hidden'); // Logic is elsewhere for nearby, here we handle 'All'
        if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();

        // Se lo zoom è troppo basso
        if (map && mapZoom < MIN_ZOOM) {
            searchResults.innerHTML = '';
            return;
        }

        if (map) {
            const bounds = map.getBounds();
            // Filtra solo le visibili nel current bound per transport e services
            const visibleTransport = transportStops.filter(s => s.lat && s.lng && bounds.contains([s.lat, s.lng]));
            const visibleServices = serviceStops.filter(s => s.lat && s.lng && bounds.contains([s.lat, s.lng]));

            if (visibleTransport.length === 0 && visibleServices.length === 0) {
                searchResults.innerHTML = `
                    <div class="out-of-zone-card stagger-in">
                        <div class="ooz-status">
                            <img src="icons/Wavy_Warning.svg">
                            <span>Sei andato fuori zona!</span>
                        </div>
                        <div class="ooz-action" onclick="if(window.centerMapOnAllStops) window.centerMapOnAllStops()">
                            Portami a Milano
                        </div>
                    </div>
                `;
                return;
            }

            visibleTransport.sort((a, b) => a.name.localeCompare(b.name));
            visibleServices.sort((a, b) => a.name.localeCompare(b.name));

            appendStopsToList(visibleTransport, searchResults);

            if (otherServicesResults) {
                if (visibleServices.length > 0) {
                    appendStopsToList(visibleServices, otherServicesResults);
                } else {
                    otherServicesResults.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.9rem;">Nessuna rivendita in questa zona.</div>';
                }
            }
        }
    }

    function appendStopsToList(itemsArray, listElement, showDistance = false) {
        itemsArray.forEach(item => {
            const li = document.createElement('li');

            if (item.type === 'line') {
                li.className = 'line-result-card stagger-in';
                li.addEventListener('click', () => openGenericLineTimeline(item.lineId, item.destination));

                li.innerHTML = `
                    <div class="line-result-header">
                        <div class="ticket-line-chip" style="background-color: ${item.color}; color: ${item.txColor}; font-size: 1rem; padding: 4px 10px;">
                            ${item.lineId}
                        </div>
                        <div class="line-result-dest">
                            <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Direzione</span>
                            <span style="font-weight: 600;">${item.destination}</span>
                        </div>
                        <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                `;
            } else {
                // E' una fermata (compatibilità con type='stop' o oggetti stop normali)
                const stop = item.type === 'stop' ? item : { ...item };
                li.className = 'stop-ticket-card stagger-in';
                li.addEventListener('click', () => openStopDetails(stop));

                let distanceHtml = '';
                if (showDistance && stop.distance !== Infinity) {
                    let distStr = stop.distance < 1 ? Math.round(stop.distance * 1000) + ' m' : stop.distance.toFixed(1) + ' km';
                    distanceHtml = `<div class="stop-ticket-distance">${distStr}</div>`;
                }

                let linesHtml = '';
                if (stop.passingLines && stop.passingLines.length > 0) {
                    const uniqueLines = Array.from(new Map(stop.passingLines.map(l => [l.id, l])).values());
                    linesHtml = uniqueLines.map(l =>
                        `<div class="line-pill" style="background-color: ${l.color}; color: ${l.txColor};">${l.id}</div>`
                    ).join('');
                } else {
                    linesHtml = '<div style="font-size:0.8rem; color:var(--text-muted); padding:2px 0;">Nessuna linea</div>';
                }

                let nextBusHtml = '';
                // Calcolo semplice del prossimo bus per la stop-card
                if (typeof getTodayDayType === 'function' && typeof stavData !== 'undefined') {
                    const todayType = getTodayDayType();
                    const now = new Date();
                    const currentMins = now.getHours() * 60 + now.getMinutes();
                    let absoluteNext = null;

                    stavData.lines.forEach(line => {
                        const dayTrips = line.dayTypes[todayType] || [];
                        dayTrips.forEach(trip => {
                            const stopEntries = trip.stops.filter(s => s.stopId === stop.id);
                            stopEntries.forEach(entry => {
                                const [h, m] = entry.time.split(':').map(Number);
                                let tMins = h * 60 + m;
                                if (tMins < 240 && currentMins >= 18 * 60) tMins += 24 * 60; // oltre mezzanotte
                                const diff = tMins - currentMins;
                                if (diff >= 0 && diff <= 120) {
                                    if (!absoluteNext || diff < absoluteNext.diff) {
                                        absoluteNext = { line: line.id, dest: trip.destination, time: entry.time, diff: diff };
                                    }
                                }
                            });
                        });
                    });

                    if (absoluteNext) {
                        nextBusHtml = `
                            <div class="upcoming-bus-block">
                                <div class="time-box">
                                    <span class="big-num">${absoluteNext.diff === 0 ? 'Ora' : absoluteNext.diff}</span>
                                    <span class="small-txt">minuti</span>
                                </div>
                                <div class="upcoming-info">
                                    <span class="prossimo">Prossimo arrivo:</span>
                                    <span class="dest">Linea ${absoluteNext.line}<br>Dest: ${absoluteNext.dest}</span>
                                    <span class="ora">Ora: ${absoluteNext.time}</span>
                                </div>
                                <svg class="chevron-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                        `;
                    }
                }

                const iconPath = LIST_ICONS[stop.operatore] || LIST_ICONS['default'];
                li.innerHTML = `
                    <div class="stop-card-header" style="${nextBusHtml ? '' : 'display: flex; justify-content: space-between; align-items: center; width: 100%;'}">
                        <div class="stop-card-icon-box" style="margin-right: 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 8px; width: 44px; height: 44px; flex-shrink: 0;">
                            <img src="${iconPath}" style="width:32px; height:32px;">
                        </div>
                        <div style="${nextBusHtml ? '' : 'flex: 1;'}">
                            <div class="stop-card-title">${stop.name}</div>
                            <div class="line-pills-row">${linesHtml}</div>
                            ${distanceHtml}
                        </div>
                        ${!nextBusHtml ? '<svg class="chevron-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' : ''}
                    </div>
                    ${nextBusHtml}
                `;
            }
            listElement.appendChild(li);
        });
    }

    // Navigazione Rapida dalla Timeline a una Fermata
    window.openStopFromTimeline = function (stopId) {
        const stop = stavData.stops.find(s => s.id === stopId);
        if (stop) {
            closeModal(); // Chiude eventuale timeline e dettagli correnti

            setTimeout(() => {
                openStopDetails(stop);
                // Centra la mappa sulla nuova fermata con zoom 16
                if (window.appMap && stop.lat && stop.lng) {
                    window.appMap.flyTo([stop.lat - 0.005, stop.lng], 16, { animate: true });
                }
            }, 300); // Attende la fine dell'animazione di chiusura
        }
    };

    // Apertura Timeline Generica per una Linea
    function _old_openGenericLineTimeline(lineId, destination) {
        const line = stavData.lines.find(l => l.id === lineId);
        if (!line) return;

        // Trova tutte le variazioni per questa destinazione
        const variationsMap = new Map(); // pathName -> trip con più fermate per quel pathName

        for (let day in line.dayTypes) {
            line.dayTypes[day].forEach(trip => {
                if (trip.destination === destination) {
                    // Trova il nome del path. Assumiamo che la prima fermata con 'variation' definisca il path, 
                    // oppure default "Principale"
                    let pathName = "Principale";
                    const firstVariationStop = trip.stops.find(s => s.variation);
                    if (firstVariationStop) {
                        pathName = firstVariationStop.variation;
                    }

                    const existingTrip = variationsMap.get(pathName);
                    if (!existingTrip || trip.stops.length > existingTrip.stops.length) {
                        variationsMap.set(pathName, trip);
                    }
                }
            });
        }

        if (variationsMap.size === 0) return;

        // Seleziona la prima variante (o "Principale" se esiste)
        let activeVariation = variationsMap.has("Principale") ? "Principale" : Array.from(variationsMap.keys())[0];
        let bestTrip = variationsMap.get(activeVariation);

        // Riutilizziamo la bottom sheet, ma nascondiamo routesContainer e mostriamo in-sheet-timeline
        activeStop = null; // Nessuna fermata attiva in questo stato
        stopNameHeader.textContent = `${lineId} - Verso ${destination}`;

        const chipsContainer = document.querySelector('.day-chips-container');
        if (chipsContainer) chipsContainer.style.display = 'none';

        const subtitleEl = document.querySelector('.subtitle');
        if (subtitleEl) subtitleEl.textContent = 'Percorso della linea';

        if (navBtn) {
            navBtn.onclick = () => {
                window.showTripOnMap(bestTrip.tripId, lineId);
            };
        }

        overlay.classList.remove('hidden');
        stopDetailsSheet.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        routesContainer.style.display = 'none';

        // Ripuliamo eventuali timeline esistenti
        const existingTimeline = stopDetailsSheet.querySelector('.in-sheet-timeline');
        if (existingTimeline) {
            existingTimeline.remove();
        }

        renderGenericTimeline(variationsMap, activeVariation, line);
    }

    window._old_switchGenericTimelineVariation = function (pathName, lineId) {
        // Ripeschiamo la linea e la mappa delle variazioni attualmente renderizzate
        // Questo richiede di ricostruire o ripassare variationsMap, che per semplicità chiameremo ricreando openGenericLineTimeline
        // Ma per non ricalcolare rifacciamo il calcolo
        const line = stavData.lines.find(l => l.id === lineId);
        if (!line) return;

        let dest = stopNameHeader.textContent.split(' - Verso ')[1];
        if (!dest) return;

        const variationsMap = new Map();
        for (let day in line.dayTypes) {
            line.dayTypes[day].forEach(trip => {
                if (trip.destination === dest) {
                    let pName = "Principale";
                    const fvStop = trip.stops.find(s => s.variation);
                    if (fvStop) pName = fvStop.variation;

                    const exTrip = variationsMap.get(pName);
                    if (!exTrip || trip.stops.length > exTrip.stops.length) {
                        variationsMap.set(pName, trip);
                    }
                }
            });
        }

        renderGenericTimeline(variationsMap, pathName, line);
    };

    function _old_renderGenericTimeline(variationsMap, activeVariation, line) {
        let timelineEl = stopDetailsSheet.querySelector('.in-sheet-timeline');
        if (timelineEl) {
            timelineEl.remove();
        }

        const trip = variationsMap.get(activeVariation);
        if (!trip) return;

        timelineEl = document.createElement('div');
        timelineEl.className = 'in-sheet-timeline slide-in-right-premium';
        stopDetailsSheet.querySelector('.sheet-content').appendChild(timelineEl);

        timelineEl.style.display = 'flex';
        timelineEl.style.flexDirection = 'column';
        timelineEl.style.flex = '1';
        timelineEl.style.overflowY = 'hidden';

        void timelineEl.offsetWidth;
        timelineEl.classList.add('slide-in-right');

        let tabsHtml = '';
        if (variationsMap.size > 1) {
            tabsHtml = `<div class="variations-tabs-container">`;
            for (let [pName, pTrip] of variationsMap.entries()) {
                const isActive = pName === activeVariation ? 'active' : '';
                tabsHtml += `
                    <button class="variation-tab ${isActive}" onclick="window.switchGenericTimelineVariation('${pName}', '${line.id}')">
                        ${pName}
                    </button>
                `;
            }
            tabsHtml += `</div>`;
        }

        let html = `
            <div class="timeline-header" style="position: sticky; top: 0; background: var(--bg-deep); z-index: 10; padding: 1rem 0; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                    <button class="back-btn" onclick="window.closeTripDetail()" style="padding: 0.5rem; background: var(--bg-card); border-radius: 50%; border: none; color: white; cursor: pointer;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div class="header-text" style="flex: 1;">
                        <h2 style="font-size:1.2rem; font-weight:800; margin:0;">Linea ${line.name}</h2>
                        <p style="opacity:0.6; margin:0; font-size:0.85rem;">Dir. ${trip.destination}</p>
                    </div>
                    <button onclick="window.showTripOnMap('${trip.tripId}', '${line.id}')" style="padding: 0.5rem 0.8rem; background: ${line.color}; border: none; cursor: pointer; border-radius: 8px; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>
                        Mappa
                    </button>
                </div>
                ${tabsHtml}
            </div>
            <div class="timeline-scroll" style="flex: 1; overflow-y: auto; padding: 1rem 0 3rem 0; position: relative;">
        `;

        trip.stops.forEach((s, idx) => {
            const stopInfo = stavData.stops.find(fs => fs.id === s.stopId);
            const stopName = stopInfo ? stopInfo.name : 'Fermata';

            html += `
                <div id="generic-timeline-row-${s.stopId}" class="timeline-row stagger-in" style="cursor: pointer; transition: background-color 1s ease-out;" onclick="window.openStopFromTimeline('${s.stopId}')">
                    <div class="timeline-graphic">
                        <div class="timeline-line" style="background:${line.color}"></div>
                        <div class="timeline-node" style="border-color:${line.color};"></div>
                    </div>
                    <div class="timeline-content" style="padding-top: 10px; padding-bottom: 10px;">
                        <div class="stop-name">${stopName}</div>
                    </div>
                    ${idx < trip.stops.length - 1 ? `
                    <div class="timeline-chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                    ` : ''}
                </div>
            `;
        });

        html += `</div>`;
        timelineEl.innerHTML = html;
    }

    // 3. Aprire i dettagli della fermata (BOTTOM SHEET MODAL)
    function _old_openStopDetails(stop) {
        activeStop = stop;
        stopNameHeader.textContent = stop.name;

        // Quando apro, resetto il chip a "Oggi", a meno che non si voglia mantenere la selezione
        selectedDayType = getTodayDayType();
        dayChips.forEach(c => {
            c.classList.toggle('active', c.dataset.day === selectedDayType);
        });

        const chipsContainer = document.querySelector('.day-chips-container');
        if (chipsContainer) chipsContainer.style.display = 'flex'; // Reset display se era nascosto dal marker utente

        // Reset subtitle se era stato sporcato dall'indirizzo utente
        const subtitleEl = document.querySelector('.subtitle');
        if (subtitleEl) subtitleEl.textContent = 'Tutte le corse da questa fermata';

        overlay.classList.remove('hidden');
        stopDetailsSheet.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        if (map && stop.lat && stop.lng) {
            // Sposta la mappa centrata leggermente più in alto per via del bottom sheet
            map.flyTo([stop.lat - 0.005, stop.lng], 15, { animate: true });
        }

        updateModalData();

        // 3.5. Impostazione Link Navigatore (Richiesta Sistema Operativo)
        if (navBtn) {
            navBtn.onclick = () => {
                if (!stop.lat || !stop.lng) {
                    alert('Coordinate mancanti per questa fermata.');
                    return;
                }
                // Rileva se il dispositivo è mobile
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                if (isMobile) {
                    // Il protocollo 'geo:' fa si che il sistema operativo mobile chieda 
                    // all'utente quale app di mappe vuole usare.
                    const url = `geo:${stop.lat},${stop.lng}?q = ${stop.lat},${stop.lng} `;
                    window.location.href = url;
                } else {
                    // Su PC, apri direttamente Google Maps in una nuova scheda
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
                    window.open(url, '_blank');
                }
            };
        }

        if (currentInterval) clearInterval(currentInterval);
        currentInterval = setInterval(updateModalData, 60000);
    }

    // 4. Chiudere il Modal
    function _old_closeModal() {
        if (currentInterval) clearInterval(currentInterval);
        activeStop = null;

        overlay.classList.add('hidden');
        stopDetailsSheet.classList.add('hidden');
        document.body.style.overflow = '';

        // Reset della vista interna orari (se era aperta la timeline corsa)
        const timelineEl = stopDetailsSheet.querySelector('.in-sheet-timeline');
        if (timelineEl) {
            timelineEl.style.display = 'none';
            timelineEl.classList.remove('slide-in-right', 'slide-out-right');
        }
        if (routesContainer) {
            routesContainer.style.display = 'block';
            routesContainer.classList.remove('fade-in-left', 'fade-out-left');
        }
    }

    // closeModalBtn.addEventListener('click', closeModal);
    // overlay.addEventListener('click', closeModal);

    const sheetHandle = null;
    let startY = 0;
    if (sheetHandle) {
        sheetHandle.addEventListener('touchstart', (e) => startY = e.touches[0].clientY);
        sheetHandle.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            if (endY - startY > 30) closeModal();
        });
    }

    // 5. Logica Core: Calcolo Tempi e Renderizzazione Linee

    // Mappa fissa delle variazioni -> simboli greci
    const VARIATION_SYMBOLS = {
        "Via Rosate": "δ",
        "Via Rosate Via Einstein": "β",
        "Via Einstein": "ε",
        "Via Monzoro": "μ",
        "Via Assiano Via Bestazzo": "α",
        "Via MI - Via Lombardi/Amsa": "λ",
        "Via Monzoro e MI - Via Lombardi/Amsa": "φ",
        "Via Assiano": "η",
        "Via Monzoro Via Einstein Via Bestazzo": "ζ",
        "Via Einstein Via Bestazzo Via Monzoro Via MI - Via Lombardi/Amsa": "ω",
        "Via Einstein Via Bestazzo": "θ",
        "Via Monzoro ": "μ" // Spazio extra trovato in data.js
    };

    function _old_updateModalData() {
        if (!activeStop) return;

        routesContainer.innerHTML = '';
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        const isToday = (selectedDayType === getTodayDayType());

        let absoluteNextTrip = null;

        // Raggruppa i trip passanti per linea e destinazione
        const routesMap = {};

        stavData.lines.forEach(line => {
            const dayTrips = line.dayTypes[selectedDayType] || [];
            dayTrips.forEach(trip => {
                const stopEntries = trip.stops.filter(s => s.stopId === activeStop.id);
                stopEntries.forEach(stopEntry => {
                    const key = `${line.id}::${trip.destination}`;
                    if (!routesMap[key]) {
                        routesMap[key] = {
                            line: line,
                            destination: trip.destination,
                            trips: [],
                            legend: {}
                        };
                    }
                    routesMap[key].trips.push({
                        tripId: trip.tripId,
                        time: stopEntry.time,
                        variation: stopEntry.variation,
                        fullTrip: trip
                    });
                    if (line.legend) {
                        Object.assign(routesMap[key].legend, line.legend);
                    } else if (trip.legend) {
                        // Supporto retrocompatibile se qualche trip ha ancora la propria legenda
                        Object.assign(routesMap[key].legend, trip.legend);
                    }
                });
            });
        });

        const routes = Object.values(routesMap);

        if (routes.length === 0) {
            routesContainer.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted); font-size: 0.95rem;">Nessuna corsa prevista per questo giorno.</p>';
        }

        routes.forEach(route => {
            route.trips.sort((a, b) => a.time.localeCompare(b.time));

            const routeEl = document.createElement('div');
            routeEl.className = 'route-card';

            // INTRODUZIONE ACCORDION - Header cliccabile
            const headerHTML = `
                <div class="route-header" style="border-left: 4px solid ${route.line.color}">
                    <span class="route-line" style="background:${route.line.color}">${route.line.name}</span>
                    <span class="route-dest" style="flex:1; margin-left:10px;">${route.destination}</span>
                    <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            `;

            let timesHTML = '<div class="accordion-content"><div class="times-grid">';

            let nextTripIndex = -1;
            const routeVariations = new Set();
            const hasCustomLegend = Object.keys(route.legend).length > 0;
            const currentLegend = hasCustomLegend ? route.legend : VARIATION_SYMBOLS;

            // Calcola il prossimo bus SOLO se stiamo guardando il giorno odierno
            if (isToday) {
                for (let i = 0; i < route.trips.length; i++) {
                    const t = route.trips[i];
                    const [timeH, timeM] = t.time.split(':').map(Number);
                    const timeTotalMinutes = timeH * 60 + timeM;

                    if (timeTotalMinutes >= currentTotalMinutes) {
                        nextTripIndex = i;
                        const diffMinutes = timeTotalMinutes - currentTotalMinutes;
                        if (!absoluteNextTrip || diffMinutes < absoluteNextTrip.diff) {
                            absoluteNextTrip = {
                                line: route.line.name,
                                dest: t.variation ? `${route.destination} (${t.variation})` : route.destination,
                                timeStr: t.time,
                                diff: diffMinutes
                            };
                        }
                        break;
                    }
                }
            }

            route.trips.forEach((t, index) => {
                const timeStr = t.time;
                const variationStr = t.variation;

                // Se la stringa matchia una chiave del dictionary mostriamo il custom
                // Se non matcha, generiamo noi una lettera sequenziale A, B, C temporanea.
                let symbol = null;
                if (variationStr) {
                    if (currentLegend[variationStr]) {
                        symbol = currentLegend[variationStr];
                    } else if (!hasCustomLegend) {
                        // Fallback per vecchie stringhe corte non mappate e autogenerazione
                        symbol = currentLegend[variationStr] || "?";
                    } else {
                        // La linea ha una mappa, ma questa variations manca: diamo noi un id per fallback?
                        // Attualmente data.js non ha tutte le map compilate.
                        let keys = Object.keys(currentLegend);
                        let idx = keys.indexOf(variationStr);
                        if (idx === -1) {
                            keys.push(variationStr);
                            currentLegend[variationStr] = String.fromCharCode(65 + keys.length - 1);
                        }
                        symbol = currentLegend[variationStr];
                    }
                }

                if (variationStr) routeVariations.add(variationStr);

                let badgeClass = 'future';
                if (isToday) {
                    if (index < nextTripIndex || (nextTripIndex === -1 && index >= 0)) {
                        badgeClass = 'past';
                    } else if (index === nextTripIndex) {
                        badgeClass = 'next';
                    }
                }

                timesHTML += `<div class="time-badge ${badgeClass}" onclick="event.stopPropagation(); window.openTripDetail('${t.tripId}', '${route.line.id}', '${activeStop.id}')" title="Clicca per mappa percorso">
                    <span>${timeStr}</span>
                    ${symbol ? `<span class="time-variation">${symbol}</span>` : ''}
                </div>`;
            });

            timesHTML += '</div>'; // Chiude times-grid

            // Aggiunta Legenda se ci sono variazioni
            if (routeVariations.size > 0) {
                timesHTML += '<div class="times-legend">';
                routeVariations.forEach(v => {
                    const sym = currentLegend[v] || "?";
                    timesHTML += `
                        <div class="legend-item">
                            <span class="legend-symbol">${sym}</span>
                            <span>${v}</span>
                        </div>
                    `;
                });
                timesHTML += '</div>';
            }

            timesHTML += '</div>'; // Chiude accordion-content
            routeEl.innerHTML = headerHTML + timesHTML;

            // Accordion Interactivity
            const routeHeader = routeEl.querySelector('.route-header');
            routeHeader.addEventListener('click', () => {
                const isOpen = routeEl.classList.contains('accordion-open');
                if (isOpen) {
                    routeEl.classList.remove('accordion-open');
                } else {
                    routeEl.classList.add('accordion-open');
                }
            });

            routesContainer.appendChild(routeEl);
        });

        // 5.5 Aggiungi connessioni alla fine della lista (nella bottom sheet principale della fermata)
        if (activeStop && activeStop.connections && activeStop.connections.length > 0) {
            const separator = document.createElement('div');
            separator.className = 'popup-separator';
            separator.style.margin = '16px 0 12px 0';

            const connectionsTitle = document.createElement('div');
            connectionsTitle.style.fontSize = '0.9rem';
            connectionsTitle.style.color = 'var(--text-white)';
            connectionsTitle.style.marginBottom = '12px';
            connectionsTitle.textContent = 'Altre corrispondenze:';

            const connectionsWrapper = document.createElement('div');
            connectionsWrapper.className = 'popup-connections-container';
            connectionsWrapper.style.padding = '0 0px 16px 0px';

            activeStop.connections.forEach(conn => {
                const connDiv = document.createElement('div');
                connDiv.className = 'popup-connection-pill';
                connDiv.innerHTML = `
                    <div class="popup-connection-icon-wrapper" style="background-color: ${conn.color};">
                        <img src="${conn.icon}" class="popup-connection-icon" alt="${conn.name} icon">
                    </div>
                    <span>${conn.name}</span>
                `;
                connectionsWrapper.appendChild(connDiv);
            });

            routesContainer.appendChild(separator);
            routesContainer.appendChild(connectionsTitle);
            routesContainer.appendChild(connectionsWrapper);
        }

        // 6. Aggiornamento Highlight Card (Prossimo Bus)
        if (nextBusInterval) {
            clearInterval(nextBusInterval);
            nextBusInterval = null;
        }

        const updateHighlightCard = () => {
            if (!activeStop || activeStop.isUserLocation || !isToday || !absoluteNextTrip) {
                highlightCard.classList.add('hidden');
                return;
            }

            const now = new Date();
            const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
            // Ricordiamo che absoluteNextTrip.diff era calcolato off-static `currentTotalMinutes` al lancio.
            // Ricalcoliamolo con il passing time effettivo (timeToMinsMap(absoluteNextTrip.time))
            const timeToMinsMap = t => {
                let [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            let tripMins = timeToMinsMap(absoluteNextTrip.timeStr);
            // Gestione corse oltre la mezzanotte
            if (tripMins < 240 && currentTotalMinutes >= 18 * 60) {
                tripMins += 24 * 60;
            }
            const liveDiff = tripMins - currentTotalMinutes;

            if (liveDiff > 120 || liveDiff < 0) {
                highlightCard.classList.add('hidden');
            } else {
                highlightCard.classList.remove('hidden');
                hMins.textContent = liveDiff === 0 ? "Ora" : liveDiff;
                hLine.textContent = `Linea ${absoluteNextTrip.line}`;
                hDest.textContent = `dir. ${absoluteNextTrip.dest}`;
                hExactTime.textContent = absoluteNextTrip.timeStr;

                if (liveDiff <= 5) {
                    hMins.style.color = '#ff4757';
                    highlightBadge.textContent = "In Arrivo";
                    highlightBadge.classList.add('urgent');
                } else {
                    hMins.style.color = 'var(--text-white)';
                    highlightBadge.textContent = "Prossimo Bus";
                    highlightBadge.classList.remove('urgent');
                }
            }
        };

        if (isToday && absoluteNextTrip && (!activeStop.isUserLocation)) {
            updateHighlightCard();
            // Aggiorna ogni minuto
            nextBusInterval = setInterval(updateHighlightCard, 60000);
        } else {
            highlightCard.classList.add('hidden');
        }

        if (activeStop && activeStop.isUserLocation) {
            highlightCard.classList.add('hidden');
        }
    }

    // --- TIMELINE IN-SHEET ---
    window._old_openTripDetail = function (tripId, lineId, highlightStopId = null) {
        const line = stavData.lines.find(l => l.id === lineId);
        if (!line) return;

        let trip = null;
        Object.values(line.dayTypes).forEach(trips => {
            const found = trips.find(t => t.tripId === tripId);
            if (found) trip = found;
        });
        if (!trip) return;

        // Anima uscita della lista corse
        routesContainer.classList.remove('fade-in-left');
        routesContainer.classList.add('fade-out-left-premium');

        setTimeout(() => {
            routesContainer.style.display = 'none';
            routesContainer.classList.remove('fade-out-left-premium');

            // Cerca se esiste già un div timeline, altrimenti crealo
            let timelineEl = stopDetailsSheet.querySelector('.in-sheet-timeline');
            if (timelineEl) {
                // Elimina per rimpiazzarlo se esiste già
                timelineEl.remove();
            }

            timelineEl = document.createElement('div');
            timelineEl.className = 'in-sheet-timeline slide-in-right-premium';
            stopDetailsSheet.querySelector('.sheet-content').appendChild(timelineEl);

            timelineEl.style.display = 'flex';
            timelineEl.style.flexDirection = 'column';
            timelineEl.style.flex = '1';
            timelineEl.style.overflowY = 'hidden'; // Gestito dallo scroll interno

            // Resetta animazioni e forza reflow
            timelineEl.classList.remove('slide-out-right');
            void timelineEl.offsetWidth;
            timelineEl.classList.add('slide-in-right');

            const now = new Date();
            const curMins = now.getHours() * 60 + now.getMinutes();

            const timeToMinsMap = t => {
                let [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            // Sostituiamo il link OSM con un pulsante interno
            let html = `
                <div class="timeline-header" style="position: sticky; top: 0; background: var(--bg-deep); z-index: 10; padding: 1rem 0; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem;">
                    <button class="back-btn" onclick="window.closeTripDetail()" style="padding: 0.5rem; background: var(--bg-card); border-radius: 50%; border: none; color: white; cursor: pointer;">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div class="header-text" style="flex: 1;">
                        <h2 style="font-size:1.2rem; font-weight:800; margin:0;">Linea ${line.name}</h2>
                        <p style="opacity:0.6; margin:0; font-size:0.85rem;">Dir. ${trip.destination}</p>
                    </div>
                    <button onclick="window.showTripOnMap('${tripId}', '${lineId}')" style="padding: 0.5rem 0.8rem; background: ${line.color}; border: none; cursor: pointer; border-radius: 8px; color: #fff; text-decoration: none; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>
                        Mappa
                    </button>
                </div>
                <div class="timeline-scroll" style="flex: 1; overflow-y: auto; padding: 1rem 0 3rem 0; margin-top: 1rem; position: relative;">
                    <div id="bus-tracker" class="bus-tracker-icon" style="display: none; background: ${line.color}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                    </div>
            `;

            trip.stops.forEach((s, idx) => {
                const stopInfo = stavData.stops.find(fs => fs.id === s.stopId);
                const stopMins = timeToMinsMap(s.time);

                const isTodayLoc = (selectedDayType === getTodayDayType());
                const isPassed = isTodayLoc && stopMins < curMins;
                const isNext = isTodayLoc && !isPassed && (idx === 0 || timeToMinsMap(trip.stops[idx - 1].time) < curMins);

                html += `
                    <div id="timeline-row-${s.stopId}" class="timeline-row ${isPassed ? 'passed' : ''} ${isNext ? 'next' : ''}" style="${highlightStopId === s.stopId ? 'background-color: rgba(255, 235, 59, 0.4); border-radius: 8px; transition: background-color 1s ease-out;' : 'transition: background-color 1s ease-out;'}">
                        <div class="timeline-graphic">
                            <div class="timeline-line" style="background:${line.color}"></div>
                            <div class="timeline-node" style="border-color:${line.color};"></div>
                        </div>
                        <div class="timeline-content" style="padding-top: 10px; padding-bottom: 10px;">
                            <div class="stop-name" style="${highlightStopId === s.stopId ? 'font-weight: bold;' : ''}">${stopInfo ? stopInfo.name : 'Fermata'}</div>
                            <div class="stop-details">
                                <span class="stop-time badge" style="${highlightStopId === s.stopId ? 'background: var(--text-color); color: var(--bg-card);' : ''}">${s.time}</span>
                                ${s.variation ? `<span class="stop-variation badge">${s.variation}</span>` : ''}
                            </div>
                        </div>
                        ${idx < trip.stops.length - 1 ? `
                        <div class="timeline-chevron">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                        ` : ''}
                    </div>
                `;
            });

            html += `</div>`;
            timelineEl.innerHTML = html;

            // Logica per posizionare il bus
            let trackingAnimationFrame = null;
            const updateBusPosition = () => {
                if (!document.getElementById('bus-tracker') || !document.body.contains(timelineEl)) {
                    if (trackingAnimationFrame) cancelAnimationFrame(trackingAnimationFrame);
                    return; // Sheet chiuso
                }

                const now = new Date();
                const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                const isTodayLoc = (selectedDayType === getTodayDayType());
                const busIcon = document.getElementById('bus-tracker');

                if (!isTodayLoc) {
                    busIcon.style.display = 'none';
                    return;
                }

                const rows = timelineEl.querySelectorAll('.timeline-row');
                let lastStopSecs = -1;
                let nextStopSecs = -1;
                let lastStopEl = null;
                let nextStopEl = null;

                for (let i = 0; i < trip.stops.length; i++) {
                    const stopSecs = timeToMinsMap(trip.stops[i].time) * 60;
                    if (stopSecs <= currentSeconds) {
                        lastStopSecs = stopSecs;
                        lastStopEl = rows[i];
                        if (!rows[i].classList.contains('passed')) {
                            rows[i].classList.add('passed');
                            rows[i].classList.remove('next');
                        }
                    } else if (stopSecs > currentSeconds && nextStopSecs === -1) {
                        nextStopSecs = stopSecs;
                        nextStopEl = rows[i];
                        if (!rows[i].classList.contains('next')) {
                            rows[i].classList.add('next');
                            rows[i].classList.remove('passed');
                        }
                    } else {
                        rows[i].classList.remove('passed', 'next');
                    }
                }

                if (lastStopEl && nextStopEl) {
                    // Corsa in corso
                    const totalDiff = nextStopSecs - lastStopSecs;
                    const elapsed = currentSeconds - lastStopSecs;
                    const percentage = elapsed / totalDiff;

                    const lastY = lastStopEl.offsetTop + 11; // Centro del cerchio
                    const nextY = nextStopEl.offsetTop + 11;
                    const currentY = lastY + ((nextY - lastY) * percentage);

                    const graphic = lastStopEl.querySelector('.timeline-graphic');
                    const currentX = lastStopEl.offsetLeft + graphic.offsetLeft + (graphic.offsetWidth / 2);

                    busIcon.style.display = 'flex';
                    busIcon.style.top = `${currentY}px`;
                    busIcon.style.left = `${currentX}px`;
                } else if (lastStopEl && !nextStopEl && currentSeconds <= lastStopSecs + 300) {
                    // Capolinea d'arrivo (mostra per 5 minuti post arrivo)
                    const graphic = lastStopEl.querySelector('.timeline-graphic');
                    const currentX = lastStopEl.offsetLeft + graphic.offsetLeft + (graphic.offsetWidth / 2);

                    busIcon.style.display = 'flex';
                    busIcon.style.top = `${lastStopEl.offsetTop + 11}px`;
                    busIcon.style.left = `${currentX}px`;
                } else {
                    busIcon.style.display = 'none';
                }

                // Chiama costantemente al prossimo frame visivo
                trackingAnimationFrame = requestAnimationFrame(updateBusPosition);
            };

            setTimeout(() => {
                const busIcon = document.getElementById('bus-tracker');
                if (busIcon) busIcon.style.transition = 'none'; // la transizione CSS urterebbe requestAnimationFrame

                trackingAnimationFrame = requestAnimationFrame(updateBusPosition);

                // Auto-scroll alla fermata evidenziata se presente
                if (highlightStopId) {
                    const highlightEl = document.getElementById(`timeline-row-${highlightStopId}`);
                    if (highlightEl) {
                        highlightEl.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });

                        // Rimuovi evidenziazione flash giallo dopo 1.5 secondi
                        setTimeout(() => {
                            highlightEl.style.backgroundColor = 'transparent';
                        }, 1500);
                    }
                }

            }, 100);

            // Forza un lieve ri-scroll in alto al container principale se necessario
            // ma solo se l'utente non ha chiesto una highlight stop
            if (!highlightStopId) {
                stopDetailsSheet.scrollTop = 0;
            }

        }, 200); // 200ms per completare fade-out
    };

    window._old_closeTripDetail = function () {
        const timelineEl = stopDetailsSheet.querySelector('.in-sheet-timeline');
        if (timelineEl) {
            timelineEl.classList.remove('slide-in-right-premium');
            timelineEl.classList.add('slide-out-right-premium');

            setTimeout(() => {
                timelineEl.style.display = 'none';
                routesContainer.style.display = 'block';
                // Mostra di nuovo con animazione inversa
                void routesContainer.offsetWidth; // Reflow
                routesContainer.classList.add('fade-in-left-premium');
                // Auto cleanup classes per evitare ghosting
                setTimeout(() => routesContainer.classList.remove('fade-in-left-premium', 'fade-out-left-premium'), 500);
            }, 400); // 400ms per completare slide out
        } else {
            routesContainer.style.display = 'block';
        }
    };

    // --- LOGICA MAPPA PERCORSO (IN-APP) ---
    let currentMapPolyline = null;
    let currentMapDecorator = null;
    let currentMapMarkers = [];

    window.showTripOnMap = async function (tripId, lineId) {
        if (!map) return;

        const line = stavData.lines.find(l => l.id === lineId);
        if (!line) return;

        let trip = null;
        Object.values(line.dayTypes).forEach(trips => {
            const found = trips.find(t => t.tripId === tripId);
            if (found) trip = found;
        });
        if (!trip) return;

        // Recupera le fermate come lat,lng
        const stopPoints = trip.stops.map(s => {
            const st = stavData.stops.find(fs => fs.id === s.stopId);
            return st ? [st.lat, st.lng] : null;
        }).filter(Boolean);

        if (stopPoints.length === 0) return;

        // Nascondi il modal overlay e falli abbassare ma mantenendolo leggermente visibile (peek)
        stopDetailsSheet.classList.add('map-peek');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';

        // Nascondi i marker blu globali della mappa temporaneamente
        markers.forEach(m => {
            if (map.hasLayer(m.marker)) {
                map.removeLayer(m.marker);
            }
        });

        // Abbassa il pannello principale se serve (nascondi l'expanded mode) e nascondilo visivamente
        const mainPanel = document.getElementById('main-panel');
        if (mainPanel) {
            mainPanel.classList.remove('expanded');
            mainPanel.classList.add('map-hidden');
        }

        // Mostra il pulsante "Chiudi Percorso"
        const closeRouteBtn = document.getElementById('close-route-btn');
        if (closeRouteBtn) closeRouteBtn.classList.remove('hidden');

        // Pulisci eventuali disegni vecchi prima di tracciare il nuovo
        clearTripFromMap();

        const mapLoader = document.getElementById('map-loader');
        if (mapLoader) mapLoader.classList.remove('hidden');

        let routePolylineData = null;
        let allCoordinates = [];
        let hasError = false;

        try {
            // L'API gratuita di Valhalla (su openstreetmap.de) supporta max 20 punti per chiamata
            if (stopPoints.length > 1) {
                const chunkSize = 19; // 19 nuovi punti + 1 di sovrapposizione = 20 max
                const chunks = [];
                for (let i = 0; i < stopPoints.length; i += chunkSize) {
                    let chunk = stopPoints.slice(i, i + chunkSize + 1);
                    if (chunk.length > 1) chunks.push(chunk);
                }

                const decodePolyline = (str, precision = 6) => {
                    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
                    while (index < str.length) {
                        byte = null; shift = 0; result = 0;
                        do {
                            byte = str.charCodeAt(index++) - 63;
                            result |= (byte & 0x1f) << shift;
                            shift += 5;
                        } while (byte >= 0x20);
                        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
                        shift = result = 0;
                        do {
                            byte = str.charCodeAt(index++) - 63;
                            result |= (byte & 0x1f) << shift;
                            shift += 5;
                        } while (byte >= 0x20);
                        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
                        lat += latitude_change;
                        lng += longitude_change;
                        coordinates.push([lat / factor, lng / factor]);
                    }
                    return coordinates;
                };

                for (const chunk of chunks) {
                    const reqData = {
                        locations: chunk.map((p, idx) => ({
                            lat: p[0],
                            lon: p[1],
                            type: (idx === 0 || idx === chunk.length - 1) ? "break" : "through"
                        })),
                        costing: "bus",
                        costing_options: {
                            bus: {
                                maneuver_penalty: 10, // Disincentiva le manovre complesse (inversioni a U)
                                route_preference: 1
                            }
                        },
                        directions_options: { units: "km" }
                    };

                    const encodedJson = encodeURIComponent(JSON.stringify(reqData));
                    const valhallaUrl = `https://valhalla1.openstreetmap.de/route?json=${encodedJson}`;

                    const resp = await fetch(valhallaUrl);
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.trip && data.trip.legs && data.trip.legs.length > 0) {
                            data.trip.legs.forEach(leg => {
                                if (leg.shape) {
                                    const decodedCoords = decodePolyline(leg.shape, 6);
                                    allCoordinates = allCoordinates.concat(decodedCoords);
                                }
                            });
                        } else {
                            hasError = true;
                            break;
                        }
                    } else {
                        console.warn(`Errore API Valhalla: ${resp.status}`);
                        hasError = true;
                        break;
                    }
                }
            }

            if (!hasError && allCoordinates.length > 0) {
                routePolylineData = allCoordinates;
            } else {
                routePolylineData = null; // Forza il fallback
            }

        } catch (e) {
            console.warn("API Routing (Valhalla) fallita. Uso fallback (linee dritte):", e);
        } finally {
            if (mapLoader) mapLoader.classList.add('hidden');
        }

        try {
            // Fallback se l'API fallisce o se punti > 100
            if (!routePolylineData) {
                routePolylineData = stopPoints;
            }

            // 2. Disegna la linea (bordo colorato + interno bianco)
            // Sfondo spesso colorato
            const outerLine = L.polyline(routePolylineData, {
                color: line.color,
                weight: 8, // Ridotto come richiesto
                opacity: 1,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);

            // Interno più sottile per dare l'effetto di un binario/tubo colorato se necessario, 
            // ma l'utente ha mandato uno screenshot dove la linea è 100% colorata e spessa, 
            // quindi manteniamo una singola linea colorata molto spessa, stile UI moderna.
            currentMapPolyline = outerLine;

            // 3. Aggiungi frecce all'interno di cerchi bianchi con bordi colorati
            if (L.polylineDecorator) {
                // Creiamo un icona HTML customizzata per la freccia direzionale
                const arrowIcon = L.divIcon({
                    className: 'route-arrow-marker',
                    html: `<div style="width: 100%; height: 100%; border-radius: 50%; background: #fff; border: 4px solid ${line.color}; display: flex; align-items: center; justify-content: center;">
                               <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="${line.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-90deg); flex-shrink: 0; margin-left: 2px;">
                                   <polyline points="9 18 15 12 9 6"></polyline>
                               </svg>
                           </div>`,
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });

                currentMapDecorator = L.polylineDecorator(currentMapPolyline, {
                    patterns: [
                        { offset: '5%', repeat: '300px', symbol: L.Symbol.marker({ rotate: true, markerOptions: { icon: arrowIcon } }) }
                    ]
                }).addTo(map);
            }

            // 4. Aggiungi cerchi molto visibili per indicare le singole fermate
            const stopIcon = L.divIcon({
                className: 'route-stop-marker-html',
                html: `<div style="width: 100%; height: 100%; border-radius: 50%; background: #fff; border: 4px solid ${line.color};"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            trip.stops.forEach((s) => {
                const stopData = stavData.stops.find(fs => fs.id === s.stopId);
                if (!stopData) return;

                const latlng = [stopData.lat, stopData.lng];
                const marker = L.marker(latlng, {
                    icon: stopIcon,
                    zIndexOffset: 1000 // Sopra la linea
                }).addTo(map);

                // Calcolo delle linee che passano per questa fermata
                let passingLinesHTML = '';
                stavData.lines.forEach(otherLine => {
                    let passesHere = false;
                    for (let dayVariant in otherLine.dayTypes) {
                        const variantTrips = otherLine.dayTypes[dayVariant];
                        if (variantTrips && variantTrips.some(t => t.stops.some(st => st.stopId === s.stopId))) {
                            passesHere = true;
                            break;
                        }
                    }
                    if (passesHere) {
                        passingLinesHTML += `<div class="popup-line-chip" style="background-color: ${otherLine.color};">${otherLine.id}</div>`;
                    }
                });

                // Gestione connessioni/interscambi (es. Metro, Treni)
                let connectionsHTML = '';
                if (stopData.connections && stopData.connections.length > 0) {
                    let connectionItems = stopData.connections.map(conn => {
                        return `
                            <div class="popup-connection-pill">
                                <div class="popup-connection-icon-wrapper" style="background-color: ${conn.color};">
                                    <img src="${conn.icon}" class="popup-connection-icon" alt="${conn.name} icon">
                                </div>
                                <span>${conn.name}</span>
                            </div>
                        `;
                    }).join('');

                    connectionsHTML = `
                        <div class="popup-separator"></div>
                        <div style="font-size: 0.9rem; margin-bottom: 8px; color: var(--text-white);">Altre corrispondenze:</div>
                        <div class="popup-connections-container">
                            ${connectionItems}
                        </div>
                    `;
                }

                const popupContent = `
                    <div class="custom-popup-content">
                        <div class="popup-header">
                            <span class="popup-time">${s.time}</span>
                        </div>
                        <div class="popup-stop-name">${stopData.name}</div>
                        <div class="popup-lines-container">
                            ${passingLinesHTML}
                        </div>
                        ${connectionsHTML}
                    </div>
                `;

                marker.bindPopup(popupContent, {
                    className: 'atsom-map-popup',
                    closeButton: false,
                    minWidth: 200
                });

                currentMapMarkers.push(marker);
            });

            // 5. Adatta i bound della mappa al percorso
            map.fitBounds(currentMapPolyline.getBounds(), { padding: [50, 50] });

        } catch (e) {
            console.error("Errore nel tracciato mappa:", e);
        }
    };

    window.closeTripFromMapClick = function () {
        clearTripFromMap();

        // Riporta i marker blu globali sulla mappa
        markers.forEach(m => {
            if (!map.hasLayer(m.marker)) {
                map.addLayer(m.marker);
            }
        });

        // Nascondi il pulsante Close Route
        const closeRouteBtn = document.getElementById('close-route-btn');
        if (closeRouteBtn) closeRouteBtn.classList.add('hidden');

        // Riapri completamente il modal (leva peek e ridai overlay)
        stopDetailsSheet.classList.remove('map-peek');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Ripristina il pannello di ricerca sottostante
        const mainPanel = document.getElementById('main-panel');
        if (mainPanel) {
            mainPanel.classList.remove('map-hidden');
        }
    };

    function clearTripFromMap() {
        if (currentMapPolyline && map.hasLayer(currentMapPolyline)) {
            map.removeLayer(currentMapPolyline);
        }
        currentMapPolyline = null;

        if (currentMapDecorator && map.hasLayer(currentMapDecorator)) {
            map.removeLayer(currentMapDecorator);
        }
        currentMapDecorator = null;

        currentMapMarkers.forEach(marker => {
            if (map.hasLayer(marker)) map.removeLayer(marker);
        });
        currentMapMarkers = [];
    }

    // Aggiungi event listener dal bottone close in app.html se esiste
    const closeRouteBtnDOM = document.getElementById('close-route-btn');
    if (closeRouteBtnDOM) {
        closeRouteBtnDOM.addEventListener('click', window.closeTripFromMapClick);
    }

    renderLists();

    window.renderOtherServices = function () {
        const otherServicesResults = document.getElementById('other-services-results');
        if (!otherServicesResults) return;

        // Per ora sempre vuoto come da richiesta
        otherServicesResults.innerHTML = `
            <div class="empty-service-card">
                Non ci sono altri servizi nelle vicinanze
            </div>
        `;
    };

    renderOtherServices();

    // --- MAIN BOTTOM PANEL INTERACTIVITY ---
    const mainPanel = document.getElementById('main-panel');
    const mainPanelHandle = document.getElementById('main-panel-handle');

    if (mainPanel && mainPanelHandle) {
        let isExpanded = false;

        let isDraggingHandle = false;
        let startYHandle = 0;

        let isDraggingList = false;
        let startYList = 0;
        let listScrollStart = 0;

        const handleDragStart = (clientY) => {
            isExpanded = mainPanel.classList.contains('expanded');
            isDraggingHandle = true;
            startYHandle = clientY;
            mainPanel.classList.add('dragging');
            mainPanel.style.setProperty('--drag-y', `0px`);
            document.body.style.userSelect = 'none';
        };

        const handleDragMove = (clientY) => {
            if (!isDraggingHandle) return;
            let deltaY = clientY - startYHandle;
            if (isExpanded && deltaY < 0) {
                deltaY = deltaY * 0.2;
            } else if (!isExpanded && deltaY > 0) {
                deltaY = deltaY * 0.2;
            }
            mainPanel.style.setProperty('--drag-y', `${deltaY}px`);
        };

        const handleDragEnd = (clientY) => {
            if (!isDraggingHandle) return;
            isDraggingHandle = false;
            document.body.style.userSelect = '';
            mainPanel.classList.remove('dragging');

            let deltaY = clientY - startYHandle;
            mainPanel.style.setProperty('--drag-y', `0px`);

            if (Math.abs(deltaY) < 5) {
                isExpanded = !isExpanded;
                mainPanel.classList.toggle('expanded', isExpanded);
                if (!isExpanded) searchInput.blur();
                if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
                return;
            }

            if (!isExpanded && deltaY < -60) {
                isExpanded = true;
                mainPanel.classList.add('expanded');
            } else if (isExpanded && deltaY > 60) {
                isExpanded = false;
                mainPanel.classList.remove('expanded');
                searchInput.blur();
            }
            if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
        };

        mainPanelHandle.addEventListener('touchstart', (e) => handleDragStart(e.touches[0].clientY), { passive: true });
        mainPanelHandle.addEventListener('touchmove', (e) => handleDragMove(e.touches[0].clientY), { passive: true });
        mainPanelHandle.addEventListener('touchend', (e) => handleDragEnd(e.changedTouches[0].clientY), { passive: true });

        // Mouse (PC testing)
        mainPanelHandle.addEventListener('mousedown', (e) => handleDragStart(e.clientY));
        document.addEventListener('mousemove', (e) => handleDragMove(e.clientY));
        document.addEventListener('mouseup', (e) => handleDragEnd(e.clientY));

        // Drag sulla lista rimosso su richiesta: il pannello si sposta solo dalla maniglia.

        /* searchInput.addEventListener('focus', () => {
            if (!isExpanded) {
                isExpanded = true;
                mainPanel.classList.add('expanded');
            }
        }); */
    }

    // Registrazione Service Worker (solo se su HTTPS o localhost)
    const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
    );

    if (window.location.protocol === 'https:' || isLocalhost) {
        // Inietta manifest dinamico
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = 'manifest.json';
        document.head.appendChild(link);

        navigator.serviceWorker.register('sw.js?v=5')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    } else if ('serviceWorker' in navigator) {
        console.log('Service Worker & Manifest skipping (non-secure or local-file origin)');
    }

    // Nota: La logica di installazione è gestita in index.html (landing page).
    // app.js si occupa solo del funzionamento dell'app standalone.

    // --- NUOVA GESTIONE IN-PANEL VIEWS ---
    // mainListsWrapper e internalViewWrapper spostati all'inizio del DOMContentLoaded per visibilità globale 

    window.closeInternalView = function () {
        if (currentInterval) clearInterval(currentInterval);
        if (nextBusInterval) { clearInterval(nextBusInterval); nextBusInterval = null; }
        activeStop = null;
        if (internalViewWrapper) internalViewWrapper.innerHTML = '';
        if (internalViewWrapper) internalViewWrapper.classList.add('hidden');
        if (mainListsWrapper) mainListsWrapper.classList.remove('hidden');

        const mainPanel = document.getElementById('main-panel');
        if (mainPanel) mainPanel.scrollTop = 0;
        if (typeof window.updateMapStatePill === 'function') window.updateMapStatePill();
    };

    function closeModal() { window.closeInternalView(); }
    window.closeModal = closeModal;

    function openStopDetails(stop) {
        activeStop = stop;
        if (currentInterval) clearInterval(currentInterval);
        if (nextBusInterval) { clearInterval(nextBusInterval); nextBusInterval = null; }

        if (mainListsWrapper) mainListsWrapper.classList.add('hidden');
        if (internalViewWrapper) internalViewWrapper.classList.remove('hidden');

        const mainPanel = document.getElementById('main-panel');
        if (mainPanel && !mainPanel.classList.contains('expanded')) {
            mainPanel.classList.add('expanded');
        }

        let html = `
            <div class="internal-header">
                <button class="internal-back-btn" onclick="window.closeInternalView()">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <div class="internal-title">${stop.name}</div>
            </div>
            <div id="inpanel-next-bus"></div>
            <div id="inpanel-lines-list" style="padding-bottom: 40px;"></div>
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
                        // Raggruppa per linea.id (proposto dall'utente)
                        const key = line.id;
                        if (!routesMap[key]) {
                            routesMap[key] = {
                                line: line,
                                destinations: new Set(),
                                trips: []
                            };
                        }
                        routesMap[key].destinations.add(trip.destination);
                        routesMap[key].trips.push({
                            time: stopEntry.time,
                            fullTrip: trip,
                            variation: stopEntry.variation,
                            destination: trip.destination
                        });
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
                    if (timeTotalMinutes < 240 && currentTotalMinutes >= 18 * 60) timeTotalMinutes += 24 * 60;

                    if (timeTotalMinutes >= currentTotalMinutes) {
                        const diffMinutes = timeTotalMinutes - currentTotalMinutes;
                        if (!absoluteNextTrip || diffMinutes < absoluteNextTrip.diff) {
                            absoluteNextTrip = { line: route.line, dest: t.destination, timeStr: t.time, diff: diffMinutes };
                        }
                        break;
                    }
                }

                const lineCard = document.createElement('div');
                lineCard.className = 'line-detail-card-premium stagger-in';

                const allDests = Array.from(route.destinations);
                // Apre il dettaglio per questa linea, passando la prima destinazione come default
                lineCard.onclick = () => window.openTripDetail(route.line.id, stop.id, allDests[0]);

                lineCard.innerHTML = `
                    <div class="line-color-stripe" style="background-color:${route.line.color};"></div>
                    <div class="line-info-box">
                        <div class="line-name">Linea ${route.line.name}</div>
                        <div class="line-dest">Direzione: ${allDests.join(' / ')}</div>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" class="chevron-right" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                `;
                linesContainer.appendChild(lineCard);
            });

            if (absoluteNextTrip) {
                const liveDiff = absoluteNextTrip.diff;
                const isUrgent = liveDiff <= 5;
                nextBusContainer.innerHTML = `
                <div class="next-bus-card-premium stagger-in ${isUrgent ? 'urgent' : ''}">
                    <div class="next-bus-minutes-box">
                        <div class="minutes-val">${liveDiff === 0 ? 'Ora' : liveDiff}</div>
                        <div class="minutes-label">${liveDiff === 0 ? '' : 'minuti'}</div>
                    </div>
                    <div class="next-bus-details">
                        <div class="arrival-label">Prossimo arrivo:</div>
                        <div class="line-info">Linea ${absoluteNextTrip.line.name}</div>
                        <div class="dest-info">Dest: ${absoluteNextTrip.dest}</div>
                        <div class="time-info">Ora: ${absoluteNextTrip.timeStr}</div>
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

    window.openTripDetail = function (lineId, activeStopId, requestedDest, requestedDayType) {
        if (currentInterval) clearInterval(currentInterval);
        if (nextBusInterval) { clearInterval(nextBusInterval); nextBusInterval = null; }

        const line = stavData.lines.find(l => l.id === lineId);
        if (!line) return;

        const sourceStop = stavData.stops.find(s => s.id === activeStopId) || activeStop;
        if (!sourceStop) return;

        // Recupero di tutte le destinazioni disponibili per questa linea a questa fermata (tra tutti i daytypes)
        const availableDestinations = new Set();
        for (let dt in line.dayTypes) {
            line.dayTypes[dt].forEach(t => {
                if (t.stops.some(s => s.stopId === activeStopId)) {
                    availableDestinations.add(t.destination);
                }
            });
        }
        const dests = Array.from(availableDestinations);

        // Stato corrente della vista
        let currentDest = requestedDest || dests[0];
        let currentDay = requestedDayType || getTodayDayType();

        const labelsMap = {
            "feriale_scolastico": "Lun-Ven scolastico",
            "sabato_scolastico": "Sabato scolastico",
            "feriale_non_scolastico": "Lun-Ven Non scolastico",
            "sabato_non_scolastico": "Sabato Non scolastico",
            "festivo": "Domeniche e festivi"
        };

        function renderAll() {
            if (internalViewWrapper) internalViewWrapper.scrollTop = 0;

            const dayTrips = line.dayTypes[currentDay] || [];
            const validTrips = dayTrips.filter(t => t.destination === currentDest);

            let mainVariationTrip = null;
            if (validTrips.length > 0) {
                mainVariationTrip = validTrips[0];
                validTrips.forEach(t => {
                    if (t.stops.length > mainVariationTrip.stops.length) mainVariationTrip = t;
                });
            }

            let html = `
                <div class="internal-header">
                    <button class="internal-back-btn" onclick="openStopDetails(stavData.stops.find(s=>s.id === '${activeStopId}'))">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div class="internal-title">${sourceStop.name}</div>
                </div>

                <div class="line-detail-header" style="background:var(--bg-deep); border-radius:17px; padding:16px; margin-bottom:12px; display:flex; align-items:center; box-shadow:0 4px 12px rgba(17,51,92,0.2);">
                    <div class="route-line" style="background:${line.color}; padding:6px 12px; border-radius:12px; font-weight:800; color:${line.txColor || '#fff'}; font-size:1rem; box-shadow:0 2px 6px rgba(0,0,0,0.2); margin-right: 14px;">${line.name}</div>
                    <div style="flex:1; font-weight:600; color:white; font-size:0.95rem; line-height:1.2;">Direzione:<br><span style="opacity:0.8; font-weight:500;">${currentDest}</span></div>
                </div>
            `;

            // DESTINATION SELECTOR (se ci sono più destinazioni)
            if (dests.length > 1) {
                html += `<div class="selector-row">`;
                dests.forEach(d => {
                    html += `<button class="selector-chip stagger-in ${d === currentDest ? 'active' : ''}" onclick="window.openTripDetail('${lineId}', '${activeStopId}', '${d.replace(/'/g, "\\'")}', '${currentDay}')">${d}</button>`;
                });
                html += `</div>`;
            }

            html += `
                <div class="orari-box" style="background:var(--bg-deep); border-radius:17px; padding:16px; margin-bottom:16px; box-shadow:0 4px 12px rgba(17,51,92,0.2);">
                    <div style="font-size:1.05rem; color:var(--text-white); margin-bottom:16px; font-style: italic; display: flex; justify-content: space-between; align-items: center;">
                        Orari
                        <span style="font-size: 0.65rem; opacity: 0.6; font-style: normal;">Fonte: ${line.operatore || 'STAV Autolinee'}</span>
                    </div>
            `;

            // DAY SELECTOR
            html += `<div class="selector-row" style="margin-bottom: 20px; border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 12px;">`;
            const availableDays = Object.keys(line.dayTypes);
            availableDays.forEach(dayKey => {
                const label = labelsMap[dayKey] || dayKey;
                html += `<button class="selector-chip stagger-in ${dayKey === currentDay ? 'active' : ''}" onclick="window.openTripDetail('${lineId}', '${activeStopId}', '${currentDest.replace(/'/g, "\\'")}', '${dayKey}')">${label}</button>`;
            });
            html += `</div>`;

            // TIMES GRID
            html += `<div class="times-grid">`;
            if (validTrips.length === 0) {
                html += `<div style="color:var(--text-muted); font-size:0.9rem; width:100%; text-align:center; padding:20px;">Nessuna corsa prevista per questo giorno.</div>`;
            } else {
                const now = new Date();
                const isToday = (currentDay === getTodayDayType());
                const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

                const stopTimes = [];
                validTrips.forEach(t => {
                    const stopEntry = t.stops.find(s => s.stopId === activeStopId);
                    if (stopEntry) {
                        stopTimes.push({ time: stopEntry.time, variation: stopEntry.variation, tripId: t.tripId });
                    }
                });
                stopTimes.sort((a, b) => a.time.localeCompare(b.time));

                let nextIndexFound = false;
                stopTimes.forEach(st => {
                    const [h, m] = st.time.split(':').map(Number);
                    let tm = h * 60 + m;
                    if (tm < 240 && currentTotalMinutes >= 18 * 60) tm += 24 * 60;

                    let cls = 'future';
                    if (isToday) {
                        if (tm < currentTotalMinutes) cls = 'past';
                        else if (!nextIndexFound) { cls = 'next'; nextIndexFound = true; }
                    }

                    html += `<div class="time-badge stagger-in ${cls}"><span>${st.time}</span>${st.variation ? `<span class="time-variation">${st.variation}</span>` : ''}</div>`;
                });
            }
            html += `</div>`;

            // LEGENDA
            let uniqueLegend = {};
            validTrips.forEach(t => {
                if (t.legend) {
                    Object.assign(uniqueLegend, t.legend);
                }
            });

            if (Object.keys(uniqueLegend).length > 0) {
                html += `
                <div style="margin-top:20px; border-top:1px dashed rgba(255,255,255,0.2); padding-top:12px;">
                    <div style="font-size:0.9rem; color:white; font-weight:700; margin-bottom:6px; font-style: italic;">Legenda</div>
                `;
                for (let key in uniqueLegend) {
                    html += `<div style="font-size:0.85rem; color:white; opacity:0.9; margin-bottom:2px;"><span style="color:#FFEB3B; font-weight:700;">${key}</span> - ${uniqueLegend[key]}</div>`;
                }
                html += `</div>`;
            }

            html += `</div>`;

            // TIMELINE (Stops path)
            if (mainVariationTrip && mainVariationTrip.stops.length > 0) {
                html += `
                <div class="timeline-box" style="background:var(--bg-deep); border-radius:17px; padding:16px; box-shadow:0 4px 12px rgba(17,51,92,0.2); margin-bottom: 2rem;">
                    <div style="font-size:1.05rem; color:white; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-style: italic;">Fermate e percorso</span>
                        <button class="back-btn" onclick="window.showTripOnMap('${mainVariationTrip.tripId}', '${line.id}')" style="background:var(--accent-color); color:white; border:none; border-radius:8px; padding:6px 12px; font-size:0.8rem; font-weight:700; box-shadow:0 4px 10px rgba(0,0,0,0.2);">Mappa</button>
                    </div>
                    <div class="timeline-scroll" style="position:relative;">
                `;

                mainVariationTrip.stops.forEach((s, idx) => {
                    const isMatch = (s.stopId === activeStopId);
                    const sInfo = stavData.stops.find(fs => fs.id === s.stopId);
                    const sName = sInfo ? sInfo.name : 'Fermata';
                    const isLast = idx === mainVariationTrip.stops.length - 1;

                    html += `
                        <div class="timeline-row stagger-in ${isMatch ? 'next' : ''}" onclick="window.openStopFromTimeline('${s.stopId}')">
                            <div class="timeline-graphic" style="color:${line.color};">
                                <div class="timeline-line"></div>
                                <div class="timeline-node"></div>
                            </div>
                            <div class="timeline-content">
                                <div class="stop-name ${isMatch ? 'active' : ''}">${sName}</div>
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }

            internalViewWrapper.innerHTML = html;
        }

        renderAll();
    };

    // Helper:
    function hexToRgb(hex) {
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return r + ", " + g + ", " + b;
    }

    // --- GLOBAL TOUCH FEEDBACK ---
    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('button, .selector-chip, .time-badge, .menu-item-card, .line-detail-card-premium, .floating-btn, .internal-back-btn, .travel-btn-primary, .nav-icon-wrapper, .circular-btn, .search-card-premium, .filter-line-chip, .nav-cancel-btn');
        if (target) {
            target.classList.add('touch-pressed');
        }
    }, { passive: true });

    // --- PROFILE PICTURE LOGIC ---
    const btnProfile = document.getElementById('btn-profile');
    const profileImg = document.getElementById('profile-img');
    const profilePlaceholder = profileImg ? profileImg.parentElement : null;
    const profileUploadOverlay = document.getElementById('profile-upload-overlay');
    const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
    const btnImportDevice = document.getElementById('btn-import-device');
    const btnCapturePhoto = document.getElementById('btn-capture-photo');
    const profileFileInput = document.getElementById('profile-file-input');
    const profileCaptureInput = document.getElementById('profile-capture-input');

    function loadProfilePicture() {
        const savedPic = localStorage.getItem('atmsom_profile_pic');
        if (savedPic && profileImg) {
            profileImg.src = savedPic;
            if (profilePlaceholder) profilePlaceholder.classList.add('has-image');
        } else if (profileImg) {
            profileImg.src = 'icons/User.svg';
            if (profilePlaceholder) profilePlaceholder.classList.remove('has-image');
        }
    }

    if (btnProfile) {
        btnProfile.addEventListener('click', () => {
            if (profileUploadOverlay) profileUploadOverlay.classList.remove('hidden');
        });
    }

    if (btnCloseProfileModal) {
        btnCloseProfileModal.addEventListener('click', () => {
            if (profileUploadOverlay) profileUploadOverlay.classList.add('hidden');
        });
    }

    if (profileUploadOverlay) {
        profileUploadOverlay.addEventListener('click', (e) => {
            if (e.target === profileUploadOverlay) {
                profileUploadOverlay.classList.add('hidden');
            }
        });
    }

    const handleFile = (input) => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                localStorage.setItem('atmsom_profile_pic', dataUrl);
                loadProfilePicture();
                if (profileUploadOverlay) profileUploadOverlay.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    };

    if (btnImportDevice && profileFileInput) {
        btnImportDevice.addEventListener('click', () => profileFileInput.click());
        profileFileInput.addEventListener('change', () => handleFile(profileFileInput));
    }

    if (btnCapturePhoto && profileCaptureInput) {
        btnCapturePhoto.addEventListener('click', () => profileCaptureInput.click());
        profileCaptureInput.addEventListener('change', () => handleFile(profileCaptureInput));
    }

    const btnRemovePhoto = document.getElementById('btn-remove-photo');
    if (btnRemovePhoto) {
        btnRemovePhoto.addEventListener('click', () => {
            localStorage.removeItem('atmsom_profile_pic');
            loadProfilePicture();
            if (profileUploadOverlay) profileUploadOverlay.classList.add('hidden');
        });
    }

    loadProfilePicture();

    const clearTouchPressed = () => {
        document.querySelectorAll('.touch-pressed').forEach(el => el.classList.remove('touch-pressed'));
    };
    document.addEventListener('touchend', clearTouchPressed, { passive: true });
    document.addEventListener('touchcancel', clearTouchPressed, { passive: true });
});

// --- STIBM MODAL CONTROL ---
window.openStibmInfo = function (zoneName) {
    const modal = document.getElementById("stibm-info-modal");
    const title = document.getElementById("stibm-modal-title");
    if (modal && title) {
        title.textContent = "Area STIBM " + zoneName;
        modal.classList.remove("hidden");
    }
};

window.closeStibmInfo = function () {
    const modal = document.getElementById("stibm-info-modal");
    if (modal) {
        modal.classList.add("hidden");
    }
};

// --- TICKETS MODAL CONTROL ---
window.openTicketsInfo = function () {
    console.log("Opening tickets info modal...");
    const modal = document.getElementById("tickets-info-modal");
    if (modal) {
        modal.classList.remove("hidden");
    } else {
        console.error("Tickets info modal not found!");
    }
};

window.closeTicketsInfo = function () {
    const modal = document.getElementById("tickets-info-modal");
    if (modal) {
        modal.classList.add("hidden");
    }
};

window.downloadAtmApp = function () {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        window.open("https://apps.apple.com/it/app/atm-milano-official-app/id415637297", "_blank");
    } else {
        window.open("https://play.google.com/store/apps/details?id=it.atm.appmobile&pcampaignid=web_share", "_blank");
    }
};

// --- TRAVEL TIPS MODAL CONTROL ---
window.openTravelTips = function () {
    const modal = document.getElementById("travel-tips-modal");
    if (modal) {
        modal.classList.remove("hidden");
    }
};

window.closeTravelTips = function () {
    const modal = document.getElementById("travel-tips-modal");
    if (modal) {
        modal.classList.add("hidden");
    }
};
