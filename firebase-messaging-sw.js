importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDWNmVX1HIeXYFMzYnIeBZD4PZXSXifxxc",
    authDomain: "myatsom-39ac3.firebaseapp.com",
    projectId: "myatsom-39ac3",
    storageBucket: "myatsom-39ac3.firebasestorage.app",
    messagingSenderId: "446042556353",
    appId: "1:446042556353:web:de8fbd1e575ca3736cd140"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Ricevuta notifica in background: ', payload);
    
    const notificationTitle = payload.notification.title || "Nuova Notifica myATSOM";
    const notificationOptions = {
        body: payload.notification.body || "Apri l'app per i dettagli",
        icon: 'FavIconAtsom.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestione del click sulla notifica
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Se c'è già una finestra aperta, focalizzala
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            // Altrimenti apri l'app
            return clients.openWindow('./app.html');
        })
    );
});

