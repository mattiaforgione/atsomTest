/**
 * Notifications Logic for MyATSOM
 * Integrates with Firestore to show real-time notifications, toasts, and list view.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyDWNmVX1HIeXYFMzYnIeBZD4PZXSXifxxc",
    authDomain: "myatsom-39ac3.firebaseapp.com",
    projectId: "myatsom-39ac3",
    storageBucket: "myatsom-39ac3.firebasestorage.app",
    messagingSenderId: "446042556353",
    appId: "1:446042556353:web:de8fbd1e575ca3736cd140"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

const VAPID_KEY = "BL7ajNbRFlTs-8dyVMbyk6hoXiQNxBbsKdDbKSSkYWvEzyKZJu-YINuQoTVJ6tpEHPXVZYqSxG1ZCTHIpzddr80";

document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('notification-badge');
    const toast = document.getElementById('notification-toast');
    const popup = document.getElementById('notification-popup');
    const listView = document.getElementById('notification-list-view');
    const detailView = document.getElementById('notification-detail-view');
    const btnNotifications = document.getElementById('btn-notifications');

    // Richiesta permessi notifiche di sistema (Push)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        setTimeout(() => Notification.requestPermission(), 3000);
    }

    async function setupPush() {
        try {
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                console.log("FCM Registration Token (Copia per test):", currentToken);
                // In un vero ambiente, salveresti questo token su Firestore per l'utente corrente
            } else {
                console.log('Nessun token di registrazione disponibile. Richiedi i permessi.');
            }
        } catch (err) {
            console.log('Errore recupero token FCM:', err);
        }
    }
    setupPush();

    onMessage(messaging, (payload) => {
        console.log('Messaggio FCM ricevuto in primo piano: ', payload);
        // La logica onSnapshot gestirà già l'aggiornamento UI se il database cambia
    });

    let allNotifications = [];
    let readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
    let pendingNotificaId = new URLSearchParams(window.location.search).get('notificaId');

    // --- MESSAGGI DAL SERVICE WORKER (Deep Link) ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'OPEN_NOTIFICATION') {
                console.log("Ricevuto comando deep-link SW per ID:", event.data.id);
                pendingNotificaId = event.data.id;
                tryOpenPending();
            }
        });
    }

    function tryOpenPending() {
        if (!pendingNotificaId) return;
        const n = allNotifications.find(notif => notif.id === pendingNotificaId);
        if (n) {
            console.log("Apertura automatica notifica deep-link:", n.titolo);
            popup.classList.remove('hidden');
            showDetail(n);
            pendingNotificaId = null;
            // Pulisci URL per evitare riaperture al refresh
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // --- FIRESTORE LISTENER ---
    const q = query(collection(db, "notifiche"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        const now = new Date().toISOString();
        console.log("Ricevuto aggiornamento Firestore. Ora:", now);

        allNotifications = snapshot.docs
            .map(doc => {
                const data = doc.data();
                // Conversione robusta della scadenza (da Timestamp a ISO string)
                if (data.scadenza && typeof data.scadenza.toDate === 'function') {
                    data.scadenza = data.scadenza.toDate().toISOString();
                }
                return { id: doc.id, ...data };
            })
            .filter(n => {
                const active = n.scadenza > now;
                if (!active) console.log("Notifica ignorata (scaduta):", n.titolo, "Scadenza:", n.scadenza);
                return active;
            });

        console.log("Notifiche attive da mostrare:", allNotifications.length);
        updateUI();
        checkNewForToast();
        tryOpenPending(); // Controlla se c'era un deep-link in attesa dei dati
    }, (error) => {
        console.error("Errore listener Firestore:", error);
    });

    function updateUI() {
        const unreadCount = allNotifications.filter(n => !readIds.includes(n.id)).length;

        // Update Badge
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        // Update List
        renderList();
    }

    function renderList() {
        listView.innerHTML = '';
        if (allNotifications.length === 0) {
            listView.innerHTML = '<div style="color:#11335C; text-align:center; padding:20px; font-weight:600; font-family:\'Montserrat\', sans-serif;">Non ci sono notifiche attive</div>';
            return;
        }

        allNotifications.forEach(n => {
            const card = document.createElement('div');
            card.className = 'notification-list-card';
            card.innerHTML = `
                <div class="card-info">
                    <div class="card-title">${n.titolo}</div>
                    <div class="card-subtitle">${n.sottotitolo || ''}</div>
                </div>
                <div class="card-arrow">
                    <img src="icons/ArrowRight.svg" alt="Apri">
                </div>
            `;
            card.onclick = () => showDetail(n);
            listView.appendChild(card);
        });
    }

    function showDetail(n) {
        detailView.innerHTML = `
            <div class="notification-detail">
                <div class="detail-header">
                    <button class="back-btn" id="detail-back">
                        <img src="icons/ArrowLeft.svg" alt="Indietro">
                    </button>
                    <div class="detail-title-block">
                        <div class="detail-title">${n.titolo}</div>
                    </div>
                </div>
                <div class="detail-body">
                    ${n.testo || ''}
                    ${n.immagini && n.immagini[0] ? `<img src="${n.immagini[0]}" class="detail-image" alt="Immagine">` : ''}
                </div>
            </div>
        `;

        listView.classList.add('hidden');
        detailView.classList.remove('hidden');

        document.getElementById('detail-back').onclick = () => {
            detailView.classList.add('hidden');
            listView.classList.remove('hidden');
        };

        markAsRead(n.id);
    }

    function checkNewForToast() {
        const unread = allNotifications.filter(n => !readIds.includes(n.id));
        if (unread.length > 0) {
            const latest = unread[0];
            const tTitle = document.getElementById('toast-title');
            const tSubtitle = document.getElementById('toast-subtitle');
            const tMain = document.getElementById('toast-main-click');
            const tClose = document.getElementById('toast-close');

            if (!tMain || !tClose || !tTitle || !tSubtitle) {
                console.warn("Elementi toast non trovati - Saltando visualizzazione toast.");
                return;
            }

            tTitle.textContent = latest.titolo;
            tSubtitle.textContent = latest.sottotitolo || latest.testo.substring(0, 60) + '...';
            toast.classList.remove('hidden');

            // --- NOTIFICA DI SISTEMA (PUSH) ---
            const showSystemNotification = async (title, opt) => {
                console.log("[MOBILE-FIX-V3] Provo a mostrare notifica di sistema per:", title);
                if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

                if ('serviceWorker' in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.ready;
                        await reg.showNotification(title, opt);
                        console.log("[MOBILE-FIX-V3] Notifica mostrata tramite Service Worker.");
                    } catch (err) {
                        console.warn("[MOBILE-FIX-V3] showNotification fallito:", err);
                        // Fallback disperato solo se non siamo su mobile (o se supportato)
                        try { new Notification(title, opt); } catch (e) { }
                    }
                } else {
                    try {
                        new Notification(title, opt);
                    } catch (e) { console.warn("[MOBILE-FIX-V3] Notifiche non supportate."); }
                }
            };

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                const options = {
                    body: latest.sottotitolo || (latest.testo ? latest.testo.substring(0, 80) + '...' : ''),
                    icon: 'FavIconAtsom.png',
                    badge: 'FavIconAtsom.png',
                    tag: 'notifica-' + latest.id,
                    data: { url: window.location.href, id: latest.id }
                };
                showSystemNotification(latest.titolo, options);
            }

            // Clicca sulla parte bianca -> Apri dettaglio e segna come letto
            tMain.onclick = () => {
                toast.classList.add('hidden');
                if (popup) popup.classList.remove('hidden');
                showDetail(latest);
            };

            // Clicca sulla X -> Solo chiusura, mantiene pallino rosso (unread)
            tClose.onclick = () => {
                toast.classList.add('hidden');
            };
        }
    }

    function markAsRead(id) {
        if (!readIds.includes(id)) {
            readIds.push(id);
            localStorage.setItem('read_notifications', JSON.stringify(readIds));
            updateUI();
        }
    }

    // --- EVENTS ---
    btnNotifications.onclick = () => {
        popup.classList.toggle('hidden');
        listView.classList.remove('hidden');
        detailView.classList.add('hidden');
    };

    // La gestione della chiusura toast è ora all'interno di checkNewForToast per supportare il contesto della notifica specifica.


    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !btnNotifications.contains(e.target)) {
            popup.classList.add('hidden');
        }
    });

    // --- REAL-TIME DELAY REPORTING ---
    window.activeDelays = {}; // Global state for delay banners
    window.lastReportedLineId = null;

    function initDelayListener() {
        // Query reports from the last 2 hours (to have a buffer for local 1-hour filtering)
        const twoHoursAgo = new Date(Date.now() - 7200000);
        const q = query(collection(db, "reports"), where("createdAt", ">", twoHoursAgo));

        onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const oneHour = 3600000;
            const delays = {};

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (!data.createdAt) return;
                
                const createdAt = data.createdAt.toDate().getTime();
                // Local filter for 1 hour window
                if (now - createdAt < oneHour) {
                    const { lineId, type } = data;
                    if (!delays[lineId]) delays[lineId] = { ritardo: 0, saltata: 0, guasto: 0, total: 0 };
                    delays[lineId][type]++;
                    delays[lineId].total++;
                }
            });

            window.activeDelays = delays;
            console.log("Update Active Delays:", delays);
            
            // Refresh UI if functions exist in app.js
            if (typeof window.refreshDelayBanners === 'function') {
                window.refreshDelayBanners();
            }
        }, (err) => console.error("Delay listener error:", err));
    }

    initDelayListener();

    window.openReportModal = (lineId) => {
        window.lastReportedLineId = lineId;
        document.getElementById('report-modal-overlay').classList.remove('hidden');
    };

    window.closeReportModal = () => {
        document.getElementById('report-modal-overlay').classList.add('hidden');
    };

    window.closeSuccessModal = () => {
        document.getElementById('success-modal-overlay').classList.add('hidden');
    };

    window.submitReport = async (type) => {
        const lineId = window.lastReportedLineId;
        if (!lineId) return;

        // Check cooldown (10 minutes)
        const lastReportTime = localStorage.getItem('last_report_timestamp');
        const now = Date.now();
        if (lastReportTime && (now - parseInt(lastReportTime)) < 600000) {
            const minutesLeft = Math.ceil((600000 - (now - parseInt(lastReportTime))) / 60000);
            alert(`Segnalazione bloccata. Devi attendere ancora ${minutesLeft} minuti.`);
            return;
        }

        try {
            // 1. Individual report for accurate real-time display
            await addDoc(collection(db, "reports"), {
                lineId: lineId,
                type: type,
                createdAt: serverTimestamp()
            });

            // 2. Update summary document (optional, but keep for consistency)
            const avvisoRef = doc(db, "avvisi", lineId);
            const avvisoDoc = await getDoc(avvisoRef);
            if (!avvisoDoc.exists()) {
                await setDoc(avvisoRef, { ritardo: 0, saltata: 0, guasto: 0 });
            }
            await updateDoc(avvisoRef, {
                [type]: increment(1)
            });

            localStorage.setItem('last_report_timestamp', now.toString());
            window.closeReportModal();
            window.showReportSuccess(type, lineId);
        } catch (err) {
            console.error("Submission error:", err);
            alert("Errore nell'invio. Riprova.");
        }
    };

    window.showReportSuccess = (type, lineId) => {
        const modal = document.getElementById('success-modal-overlay');
        const msg = document.getElementById('success-message');
        
        let typeStr = "Disservizio";
        if(type === 'ritardo') typeStr = "Ritardo";
        if(type === 'saltata') typeStr = "Corsa Saltata";
        if(type === 'guasto') typeStr = "Guasto o incidente";

        // We assume globalCurrentDest and globalLineName are set in app.js
        const lineName = window.globalLineName || lineId;
        const destName = window.globalCurrentDest || "destinazione";

        msg.innerHTML = `Hai segnalato <b>${typeStr}</b> per la linea <b>${lineName}</b> con direzione <b>${destName}</b> e il tuo avviso è stato inviato correttamente!`;
        modal.classList.remove('hidden');
    };
});
