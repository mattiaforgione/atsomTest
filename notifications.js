/**
 * Notifications Logic for MyATSOM
 * Integrates with Firestore to show real-time notifications, toasts, and list view.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
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
            listView.innerHTML = '<div style="color:white; text-align:center; padding:20px; opacity:0.6;">Nessuna modifica attiva</div>';
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
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                const systemNotif = new Notification(latest.titolo, {
                    body: latest.sottotitolo || (latest.testo ? latest.testo.substring(0, 80) + '...' : ''),
                    icon: 'FavIconAtsom.png'
                });
                systemNotif.onclick = () => {
                    window.focus();
                    toast.classList.add('hidden');
                    if (popup) popup.classList.remove('hidden');
                    showDetail(latest);
                };
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
});
