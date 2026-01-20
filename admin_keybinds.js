(async function() {
    console.log("[Admin Keybinds] Script Loaded");

    // Firebase Config
    const firebaseConfig = {
        apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
        authDomain: "project-zirconium.firebaseapp.com",
        projectId: "project-zirconium",
        storageBucket: "project-zirconium.firebasestorage.app",
        messagingSenderId: "1096564243475",
        appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
        measurementId: "G-1D4F692C1Q"
    };

    // Dynamic Imports
    const [
        { initializeApp, getApp },
        { getAuth, onAuthStateChanged },
        { getFirestore, doc, getDoc, setDoc, onSnapshot }
    ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);

    // Initialize Firebase
    let app;
    try {
        app = getApp(); // Try to get the default app
        console.log("[Admin Keybinds] Attached to existing default app.");
    } catch (e) {
        console.log("[Admin Keybinds] Default app not found, initializing new one.");
        app = initializeApp(firebaseConfig); 
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    // State
    let isAdmin = false;
    let adminUnsubscribe = null;
    let toasterTimeout = null;
    
    const OWNER_EMAIL = "4simpleproblems@gmail.com";

    // Standardized Notification CSS (Matches soundboard.html exactly)
    const style = document.createElement('style');
    style.textContent = `
        #admin-status-toaster {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            z-index: 10000000;
            background-color: rgba(13, 13, 13, 0.95);
            backdrop-filter: blur(5px);
            padding: 0.75rem 1.5rem;
            border-radius: 18px;
            border: 1px solid #333;
            font-size: 0.85rem;
            color: #fff;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
            font-family: 'Geist', sans-serif;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        #admin-status-toaster.visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    `;
    document.head.appendChild(style);

    // Create Toaster Element
    const statusToaster = document.createElement('div');
    statusToaster.id = 'admin-status-toaster';
    document.body.appendChild(statusToaster);

    // Visual Feedback Helper (Matching soundboard.html)
    function showAdminToast(message, type = 'info') {
        statusToaster.innerHTML = '';
        
        let iconHtml = '';
        if (type === 'error' || type === 'red') {
            statusToaster.style.borderColor = '#ef4444';
            iconHtml = '<i class="fa-solid fa-circle-exclamation text-red-500"></i>';
        } else if (type === 'success' || type === 'green') {
            statusToaster.style.borderColor = '#22c55e';
            iconHtml = '<i class="fa-solid fa-check-circle text-green-500"></i>';
        } else {
            statusToaster.style.borderColor = '#333';
            iconHtml = '<i class="fa-solid fa-info-circle text-blue-400"></i>';
        }

        statusToaster.innerHTML = `${iconHtml}<span>${message}</span>`;
        statusToaster.classList.add('visible');
        
        if (toasterTimeout) clearTimeout(toasterTimeout);
        toasterTimeout = setTimeout(() => statusToaster.classList.remove('visible'), 2000);
    }

    function cleanupListeners() {
        if (adminUnsubscribe) {
            adminUnsubscribe();
            adminUnsubscribe = null;
        }
        isAdmin = false;
    }

    // Toggle Config Function
    async function toggleConfig(field, name) {
        if (!isAdmin) {
             console.warn("[Admin Keybinds] Access denied. Not an admin.");
             return;
        }
        
        console.log(`[Admin Keybinds] Toggling ${name}...`);
        const configRef = doc(db, 'config', 'soundboard');
        
        try {
            const snap = await getDoc(configRef);
            let currentVal = true; // Default to true if not set
            if (snap.exists()) {
                const data = snap.data();
                if (data[field] !== undefined) {
                    currentVal = data[field];
                }
            }
            
            const newVal = !currentVal;
            await setDoc(configRef, { [field]: newVal }, { merge: true });
            
            const statusColor = newVal ? "green" : "red";
            const statusText = newVal ? "ENABLED" : "DISABLED";
            showAdminToast(`${name}: ${statusText}`, statusColor);
            
        } catch (err) {
            console.error(`[Admin Keybinds] Error toggling ${name}:`, err);
            showAdminToast(`Error: ${err.message}`, "error");
        }
    }

    // Keybind Listener
    document.addEventListener('keydown', async (e) => {
        // Only run if admin, Shift key, and Ctrl key are pressed
        if (!isAdmin || !e.shiftKey || !e.ctrlKey) return;

        // Shift + Ctrl + E: Explicit Sounds
        if (e.key.toLowerCase() === 'e') {
            e.preventDefault(); // Prevent default browser behavior if any
            toggleConfig('explicitEnabled', 'Explicit Sounds');
        }

        // Shift + Ctrl + F: Third Party Sounds
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleConfig('thirdPartyEnabled', 'Third Party Sounds');
        }
    });

    // Auth & Role Check
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (user.email && user.email.toLowerCase() === OWNER_EMAIL) {
                console.log(`[Admin Keybinds] Owner recognized: ${OWNER_EMAIL}`);
                isAdmin = true;
                return;
            }

            if (adminUnsubscribe) adminUnsubscribe();

            adminUnsubscribe = onSnapshot(doc(db, 'admins', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const role = (data.role || '').toLowerCase();
                    
                    if (role === 'admin' || role === 'superadmin') {
                        if (!isAdmin) console.log("[Admin Keybinds] Admin privileges active.");
                        isAdmin = true;
                    } else {
                        isAdmin = false;
                    }
                } else {
                    isAdmin = false;
                }
            }, (error) => {
                console.error("[Admin Keybinds] Admin check error:", error);
                isAdmin = false;
            });
        } else {
            cleanupListeners();
        }
    });

})();