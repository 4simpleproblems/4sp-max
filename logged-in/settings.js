
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { 
            getAuth, 
            onAuthStateChanged, 
            signOut,
            EmailAuthProvider, 
            reauthenticateWithCredential, 
            updatePassword,
            // NEW AUTH IMPORTS
            GoogleAuthProvider,
            GithubAuthProvider,
            OAuthProvider,
            linkWithPopup,
            unlink,
            reauthenticateWithPopup,
            deleteUser
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { 
            getFirestore, 
            doc, 
            getDoc, 
            updateDoc, 
            collection,
            query,
            where,
            getDocs,
            serverTimestamp,
            deleteDoc, // NEW FIREBASE IMPORT
            setDoc,
            writeBatch
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import { 
            getStorage, 
            ref, 
            listAll, 
            getDownloadURL, 
            uploadString, 
            deleteObject, 
            uploadBytes 
        } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
        
        // --- Import Firebase Config (Assumed to exist in a relative file) ---
        import { firebaseConfig } from "../firebase-config.js"; 
        
        // --- NEW: Import Site Mapping (from index.html logic) ---
        // This file MUST exist at ../site-mapping.js for import/export to work
        import { siteMapping } from "../site-mapping.js";


        if (!firebaseConfig || !firebaseConfig.apiKey) {
            console.error("FATAL ERROR: Firebase configuration is missing or invalid.");
        }

        // --- Firebase Initialization ---
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const storage = getStorage(app);

        // --- Global State and Element References ---
        const sidebarTabs = document.querySelectorAll('.settings-tab');
        const mainView = document.getElementById('settings-main-view');
        let currentUser = null; // To store the authenticated user object
        let isUserAdmin = false; // Stores admin status result to prevent race conditions
        
        // --- NEW: Global var for loading overlay (from index.html) ---
        let loadingTimeout = null;
        
        // Constants for validation and limits
        const MIN_LENGTH = 6; 
        const MAX_LENGTH = 24;
        const MAX_CHANGES = 5; 


        // Tab Content Data Structure (can be expanded later)
        const tabContent = {
            'general': { title: 'General Settings', icon: 'fa-gear' },
            'privacy': { title: 'Privacy & Security', icon: 'fa-shield-halved' },
            'personalization': { title: 'Personalization', icon: 'fa-palette' },
            'data': { title: 'Data Management', icon: 'fa-database' },
            'management': { title: 'Management', icon: 'fa-users-gear' },
            'about': { title: 'About 4SP', icon: 'fa-circle-info' },
        };
        
        // Constants for providers (NEW)
        const PROVIDER_CONFIG = {
            'google.com': { 
                name: 'Google', 
                icon: '../images/google-icon.png', 
                instance: () => new GoogleAuthProvider() 
            },
            'github.com': { 
                name: 'GitHub', 
                icon: '../images/github-mark-white.png', 
                instance: () => new GithubAuthProvider() 
            },
            'microsoft.com': { 
                name: 'Microsoft', 
                icon: '../images/microsoft.png', 
                instance: () => new OAuthProvider('microsoft.com') 
            },
            'twitter.com': { // NEW: X (Twitter) Provider
                name: 'X (Twitter)',
                icon: '../images/x.png',
                instance: () => new OAuthProvider('twitter.com')
            },
            'password': { 
                name: 'Email & Password', 
                icon: '<i class="fa-solid fa-at fa-lg mr-3"></i>', 
                isCredential: true
            }
        };

        // --- NEW: Constants for Privacy Settings ---
        
        // IndexedDB Config for Panic Key
        const DB_NAME = 'userLocalSettingsDB';
        const STORE_NAME = 'panicKeyStore';
        
        // localStorage Key for URL Changer
        const URL_CHANGER_KEY = 'selectedUrlPreset';
        
        // --- NEW: Constant for Theme Storage ---
        // (Copied from navigation.js)
        const THEME_STORAGE_KEY = 'user-navbar-theme';


        // Presets copied from url-changer.js
        const urlChangerPresets = [
            { id: 'hac', name: 'HAC', title: 'Login', favicon: '../favicons/hac.png', category: 'websites' },
            { id: 'gmm', name: 'GMM', title: 'Get More Math!', favicon: '../favicons/gmm.png', category: 'websites' },
            { id: 'kahoot', name: 'Kahoot', title: 'Kahoot! | Learning games | Make learning awesome!', favicon: '../favicons/kahoot.png', category: 'websites' },
            { id: 'g_classroom', name: 'Google Classroom', title: 'Home', favicon: '../favicons/google-classroom.png', category: 'websites' },
            { id: 'g_docs', name: 'Google Docs', title: 'Google Docs', favicon: '../favicons/google-docs.png', category: 'websites' },
            { id: 'g_slides', name: 'Google Slides', title: 'Google Slides', favicon: '../favicons/google-slides.png', category: 'websites' },
            { id: 'g_drive', name: 'Google Drive', title: 'Home - Google Drive', favicon: '../favicons/google-drive.png', category: 'websites' },
            { id: 'wikipedia', name: 'Wikipedia', title: 'Wikipedia', favicon: '../favicons/wikipedia.png', category: 'websites' },
            { id: 'clever', name: 'Clever', title: 'Clever | Connect every student to a world of learning', favicon: '../favicons/clever.png', category: 'websites' },
            { id: '_LIVE_CURRENT_TIME', name: 'Current Time', title: 'Live Time', favicon: '', category: 'live', live: true }
        ];

        
        // --- Shared Helper Functions ---
        // --- Shared Helper Functions ---
        const getUserDocRef = (userId) => doc(db, 'users', userId);
        
        import { checkAdminStatus } from '../utils.js';
        
        const showMessage = (element, text, type = 'error') => {
            // Prevent clearing a success message if a warning is generated elsewhere
            if (element && element.innerHTML.includes('success') && type !== 'error') return;
            if (element) {
                element.innerHTML = text;
                element.className = `general-message-area text-sm ${type}-message`;
            }
        };
        
        const checkProfanity = async (text) => {
            try {
                const response = await fetch(`https://www.purgomalum.com/service/containsprofanity?text=${encodeURIComponent(text)}`);
                const result = await response.text();
                return result.toLowerCase() === 'true';
            } catch (error) { console.error('Profanity API error:', error); return false; }
        };

        const isUsernameTaken = async (username) => {
            const q = query(collection(db, 'users'), where('username', '==', username));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
        };
        
        // --- NEW: IndexedDB Helper Functions ---

        /**
         * Opens the IndexedDB and creates the object store if needed.
         */
        function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME);
                request.onupgradeneeded = event => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        
        /**
         * Fetches all panic key settings from IndexedDB.
         */
        async function getPanicKeySettings() {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => {
                    const settingsMap = new Map(request.result.map(item => [item.id, item]));
                    db.close();
                    resolve(settingsMap);
                };
                request.onerror = () => {
                     db.close();
                    reject(request.error);
                };
            });
        }
        
        /**
         * Saves panic key settings to IndexedDB.
         */
        async function savePanicKeySettings(settingsArray) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                let completed = 0;
                const total = settingsArray.length;

                settingsArray.forEach(setting => {
                    const request = store.put(setting);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            db.close();
                            resolve();
                        }
                    };
                    request.onerror = () => {
                         db.close();
                        reject(request.error); // Stop on first error
                    };
                });
                
                // Handle case where array is empty
                if (total === 0) {
                     db.close();
                    resolve();
                }
            });
        }

        // --- NEW: localStorage Helper Functions ---
        
        function getSavedUrlChangerSetting() {
            const savedSettingsJSON = localStorage.getItem(URL_CHANGER_KEY);
            let savedSettings = { type: 'none' };
            if (savedSettingsJSON) {
                try { 
                    savedSettings = JSON.parse(savedSettingsJSON); 
                } catch (e) { 
                    console.error("Failed to parse saved tab settings, reverting to default.", e); 
                } 
            }
            return savedSettings;
        }

        function saveUrlChangerSetting(settings) {
            try {
                localStorage.setItem(URL_CHANGER_KEY, JSON.stringify(settings));
                return true;
            } catch (e) {
                console.error("Failed to save URL changer settings:", e);
                return false;
            }
        }
        
        // --- NEW: Modal and Loading Functions (from index.html) ---
        
        function openModal(text, buttons = []) {
            const modal = document.getElementById('modalPrompt');
            const modalText = document.getElementById('modalText');
            const modalButtons = document.getElementById('modalButtons');
            
            modalText.textContent = text;
            modalButtons.innerHTML = "";
            buttons.forEach(btn => {
                const buttonEl = document.createElement("button");
                // MODIFICATION: Use settings page button styles
                buttonEl.className = "btn-toolbar-style";
                if (btn.text.toLowerCase() === 'yes') {
                    buttonEl.classList.add('btn-primary-override-danger'); // Make 'Yes' destructive
                } else {
                    buttonEl.classList.add('btn-primary-override');
                }
                buttonEl.textContent = btn.text;
                buttonEl.onclick = btn.onclick;
                modalButtons.appendChild(buttonEl);
            });
            modal.style.display = "flex";
        }
        
        function showLoading(text = "Loading...") {
            const loadingOverlay = document.getElementById('loadingOverlay');
            const loadingText = document.getElementById('loadingText');
            
            loadingText.textContent = text;
            loadingOverlay.style.display = "flex";
            loadingOverlay.classList.add("active");
            if (loadingTimeout) clearTimeout(loadingTimeout);
            loadingTimeout = setTimeout(() => {
                hideLoading();
            }, 5000); // 5 second timeout
        }

        function hideLoading() {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
            loadingOverlay.classList.remove("active");
            loadingOverlay.style.display = "none";
        }
        
        // --- NEW: Core Data Functions (from index.html) ---
        
        function getAllLocalStorageData() {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Skip theme key
                if (key === THEME_STORAGE_KEY) continue;
                // Skip URL changer key
                if (key === URL_CHANGER_KEY) continue;
                
                const value = localStorage.getItem(key);
                data[key] = value;
            }
            return data;
        }

        function setAllLocalStorageData(data) {
            // Don't clear *everything*, just the keys in the data
            // This avoids wiping the user's theme setting
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, value);
            }
        }

        async function getAllIndexedDBData() {
            if (!indexedDB.databases) return {};
            let dbList = [];
            try {
                dbList = await indexedDB.databases();
            } catch (error) {
                console.error("Error fetching IndexedDB databases:", error);
                return {};
            }
            const result = {};
            for (const dbInfo of dbList) {
                if (!dbInfo.name) continue;
                // Skip our own settings DB
                if (dbInfo.name === DB_NAME) continue; 
                
                result[dbInfo.name] = await getDataFromDatabase(dbInfo.name);
            }
            return result;
        }

        function getDataFromDatabase(dbName) {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(dbName);
                request.onsuccess = event => {
                    const db = event.target.result;
                    const storeNames = Array.from(db.objectStoreNames);
                    const dbData = {};
                    let pending = storeNames.length;
                    if (pending === 0) {
                        db.close();
                        resolve(dbData);
                        return;
                    }
                    storeNames.forEach(storeName => {
                        const transaction = db.transaction(storeName, "readonly");
                        const store = transaction.objectStore(storeName);
                        const items = [];
                        const cursorRequest = store.openCursor();
                        cursorRequest.onsuccess = evt => {
                            const cursor = evt.target.result;
                            if (cursor) {
                                items.push({ key: cursor.key, value: cursor.value });
                                cursor.continue();
                            } else {
                                dbData[storeName] = items;
                                pending--;
                                if (pending === 0) {
                                    db.close();
                                    resolve(dbData);
                                }
                            }
                        };
                        cursorRequest.onerror = evt => {
                            pending--;
                            if (pending === 0) {
                                db.close();
                                resolve(dbData);
                            }
                        };
                    });
                };
                request.onerror = event => {
                    reject(event.target.error);
                };
            });
        }

        async function setAllIndexedDBData(indexedData) {
            for (const dbName in indexedData) {
                const storesData = indexedData[dbName];
                await new Promise(resolve => {
                    const deleteRequest = indexedDB.deleteDatabase(dbName);
                    deleteRequest.onsuccess = () => resolve();
                    deleteRequest.onerror = () => resolve();
                    deleteRequest.onblocked = () => resolve();
                });
                const openRequest = indexedDB.open(dbName, 1);
                openRequest.onupgradeneeded = function (event) {
                    const db = event.target.result;
                    for (const storeName in storesData) {
                        if (!db.objectStoreNames.contains(storeName)) {
                            db.createObjectStore(storeName, { autoIncrement: false });
                        }
                    }
                };
                const dbInstance = await new Promise((resolve, reject) => {
                    openRequest.onsuccess = event => {
                        resolve(event.target.result);
                    };
                    openRequest.onerror = event => {
                        reject(event.target.error);
                    };
                });
                for (const storeName in storesData) {
                    await new Promise(resolve => {
                        const transaction = dbInstance.transaction(storeName, "readwrite");
                        transaction.oncomplete = () => resolve();
                        transaction.onerror = () => resolve();
                        const store = transaction.objectStore(storeName);
                        const clearRequest = store.clear();
                        clearRequest.onsuccess = async () => {
                            for (const record of storesData[storeName]) {
                                await new Promise(r => {
                                    const putRequest = store.put(record.value, record.key);
                                    putRequest.onsuccess = () => r();
                                    putRequest.onerror = () => r();
                                });
                            }
                        };
                    });
                }
                dbInstance.close();
            }
        }
        
        // --- NEW: Domain Key Functions (from index.html) ---
        
        function getCurrentSiteKey() {
            const currentURL = window.location.href;
            const keys = Object.keys(siteMapping);
            keys.sort((a, b) => b.length - a.length);
            for (const key of keys) {
                const normalizedKey = key.replace(/^https?:\/\//, "");
                if (currentURL.includes(normalizedKey)) {
                    return normalizedKey;
                }
            }
            return window.location.host + window.location.pathname.replace(/\/$/, "");
        }
        
        function normalizeDomainKey(str) {
            return str.replace(/^https?:\/\//, "").replace(/\/$/, "");
        }
        
        function replaceDomainsInData(dataObj, currentDomain) {
            const currentDomainKey = getCurrentSiteKey(); // Get current domain
            const keysToCheck = Object.keys(siteMapping).map(k => normalizeDomainKey(k));
            const normalizedCurrentDomain = normalizeDomainKey(currentDomainKey);

            function replaceInString(str) {
                for (const oldDomain of keysToCheck) {
                    if (str.includes(oldDomain)) {
                        const idx = str.indexOf(oldDomain);
                        if (idx === 0) {
                            return normalizedCurrentDomain + str.substring(oldDomain.length);
                        } else {
                            return str.replace(oldDomain, normalizedCurrentDomain);
                        }
                    }
                }
                return str;
            }
            
            // Check if dataObj is the root object {localStorageBackup: ..., indexedDBBackup: ...}
            if (dataObj.localStorageBackup || dataObj.indexedDBBackup) {
                 if (dataObj.localStorageBackup) {
                    const localObj = dataObj.localStorageBackup;
                     for (const k in localObj) {
                        const newKey = replaceInString(k);
                        let newVal = localObj[k];
                        if (typeof newVal === "string") {
                            newVal = replaceInString(newVal);
                        }
                        if (newKey !== k) {
                            delete localObj[k];
                            localObj[newKey] = newVal;
                        } else {
                            localObj[k] = newVal;
                        }
                    }
                 }
                 // Note: IndexedDB data is less likely to contain domain keys in its structure
                 // so we primarily focus on localStorage keys and values.
            }
        }
        
        // --- NEW: Import/Export Handlers (from index.html) ---
        
        async function downloadAllSaves() {
            showLoading("Preparing download...");
            const localData = getAllLocalStorageData();
            const indexedData = await getAllIndexedDBData();
            const dataToDownload = {
                localStorageBackup: localData,
                indexedDBBackup: indexedData,
            };
            hideLoading();
            const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "4sp_saves.json"; // Changed name
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

        function handleFileUpload() {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async evt => {
                    const content = evt.target.result;
                    let parsed;
                    try {
                        parsed = JSON.parse(content);
                    } catch (err) {
                        alert("Invalid file format");
                        return;
                    }
                    
                    // This is the domain key logic from index.html
                    replaceDomainsInData(parsed, ""); // Pass empty string, replaceDomainsInData will get it

                    openModal(
                        "Are you sure you would like to upload this save? It will overwrite all current local data.",
                        [
                            {
                                text: "Yes",
                                onclick: async () => {
                                    modal.style.display = "none";
                                    showLoading("Uploading save...");
                                    
                                    let loadedLocalData = parsed.localStorageBackup;
                                    let loadedIndexedData = parsed.indexedDBBackup;

                                    if (loadedLocalData)
                                        setAllLocalStorageData(loadedLocalData);
                                    if (loadedIndexedData)
                                        await setAllIndexedDBData(loadedIndexedData);
                                        
                                    hideLoading();
                                    alert("Upload complete! Refreshing the page...");
                                    setTimeout(() => location.reload(), 1000);
                                },
                            },
                            {
                                text: "No",
                                onclick: () => {
                                    modal.style.display = "none";
                                },
                            },
                        ]
                    );
                };
                reader.readAsText(file);
            };
            input.click();
        }

        /**
         * Generates the HTML for the "Change Password" section.
         */
        function getChangePasswordSection() {
            return `
                <h3 class="text-xl font-bold text-white mb-2 mt-8">Change Password</h3>
                <div id="passwordChangeSection" class="settings-box w-full p-4">
                    <p class="text-sm font-light text-gray-400 mb-3">
                        Change your password. You must provide your current password for security.
                    </p>
                    
                    <div class="flex flex-col gap-3">
                        <input type="password" id="currentPasswordInput" placeholder="Current Password" class="input-text-style">
                        <input type="password" id="newPasswordInput" placeholder="New Password (min 6 characters)" class="input-text-style">
                        <input type="password" id="confirmPasswordInput" placeholder="Confirm New Password" class="input-text-style">
                    </div>
                    
                    <div class="flex justify-between items-center pt-4">
                        <p id="passwordMessage" class="general-message-area text-sm"></p>
                        <button id="applyPasswordBtn" class="btn-toolbar-style btn-primary-override w-32" disabled style="padding: 0.5rem 0.75rem;">
                            <i class="fa-solid fa-lock mr-1"></i> Apply
                        </button>
                    </div>
                </div>
            `;
        }
        
        /**
         * Renders the Linked Providers and Account Deletion section.
         */
        function getAccountManagementContent(providerData) {
            // Determine the Primary Provider (the first one in the list)
            const primaryProviderId = providerData && providerData.length > 0 ? providerData[0].providerId : null;
            
            let linkedProvidersHtml = providerData.map(info => {
                const id = info.providerId;
                const config = PROVIDER_CONFIG[id] || { name: id, icon: '<i class="fa-solid fa-puzzle-piece fa-lg mr-3"></i>' };
                
                const isPrimary = (id === primaryProviderId); // Check if this is the primary provider
                const canUnlink = providerData.length > 1 && !(id === 'password' && primaryProviderId === 'password');
                
                // NEW: Determine if "Set as Primary" button should be shown
                // Show if no primary is explicitly set, it's not the current primary, and it's not the password provider.
                const showSetPrimaryButton = !isPrimary && primaryProviderId === null && id !== 'password';

                // Determine if icon is an image or a FontAwesome icon
                let iconHtml = config.icon.startsWith('<i') ? config.icon : `<img src="${config.icon}" alt="${config.name} Icon" class="h-6 w-auto mr-3">`;

                return `
                    <div class="flex justify-between items-center px-4 py-4 border-b border-[#252525] last:border-b-0">
                        <div class="flex items-center text-lg text-white">
                            ${iconHtml}
                            ${config.name}
                            ${isPrimary ? '<span class="text-xs text-yellow-400 ml-2 font-normal">(Primary)</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2"> <!-- Container for buttons -->
                            ${showSetPrimaryButton ? 
                                `<button class="btn-toolbar-style btn-primary-override" data-provider-id="${id}" data-action="set-primary" style="padding: 0.5rem 0.75rem;">
                                    <i class="fa-solid fa-star mr-1"></i> Set Primary
                                </button>` : ''
                            }
                            ${canUnlink ? 
                                `<button class="btn-toolbar-style text-red-400 hover:border-red-600 hover:text-red-600" data-provider-id="${id}" data-action="unlink" style="padding: 0.5rem 0.75rem;">
                                    <i class="fa-solid fa-unlink mr-1"></i> Unlink
                                </button>` : 
                                // Show "Cannot Unlink" if not able to unlink (e.g., it's the only provider, or it's password and primary)
                                (providerData.length === 1 || (id === 'password' && primaryProviderId === 'password')) ? 
                                    `<span class="text-xs text-custom-light-gray font-light ml-4">Cannot Unlink</span>` : ''
                            }
                        </div>
                    </div>
                `;
            }).join('');

            // Filter out already linked social providers for the linking list
            const linkedIds = providerData.map(p => p.providerId);
            let availableProvidersHtml = Object.keys(PROVIDER_CONFIG)
                .filter(id => id !== 'password' && !linkedIds.includes(id))
                .map(id => {
                    const config = PROVIDER_CONFIG[id];
                    let iconHtml = config.icon.startsWith('<i') ? config.icon : `<img src="${config.icon}" alt="${config.name} Icon" class="h-6 w-auto mr-3">`;

                    return `
                        <div class="flex justify-between items-center px-4 py-4 border-b border-[#252525] last:border-b-0">
                            <div class="flex items-center text-lg text-white">
                                ${iconHtml}
                                ${config.name}
                            </div>
                            <button class="btn-toolbar-style btn-primary-override" data-provider-id="${id}" data-action="link" style="padding: 0.5rem 0.75rem;">
                                <i class="fa-solid fa-link mr-1"></i> Link Provider
                            </button>
                        </div>
                    `;
                }).join('');
                
            if (availableProvidersHtml === '') {
                availableProvidersHtml = `
                    <div class="px-4 py-4">
                        <p class="text-sm text-gray-500 text-center">All available social providers are linked.</p>
                    </div>
                `;
            }


            // --- Account Deletion Section ---
            let deletionContent = '';
            
            if (!primaryProviderId) { // No primary provider found
                deletionContent = `
                    <h3 class="text-xl font-bold text-white mb-2 mt-8">Delete Account</h3>
                    <div id="deletionSection" class="settings-box w-full bg-red-900/10 border-red-700/50 p-4">
                        <p class="text-sm font-light text-red-300 mb-3">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            WARNING: Deleting your account is permanent. No primary authentication method found. Please contact support.
                        </p>
                    </div>
                `;
            } else if (primaryProviderId === 'password') {
                deletionContent = `
                    <h3 class="text-xl font-bold text-white mb-2 mt-8">Delete Account</h3>
                    <div id="deletionSection" class="settings-box w-full bg-red-900/10 border-red-700/50 p-4">
                        <p class="text-sm font-light text-red-300 mb-3">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            WARNING: Deleting your account is permanent and cannot be undone.
                        </p>
                        
                        <div id="passwordDeletionStep1">
                            <label for="deletePasswordInput" class="block text-red-300 text-sm font-light mb-2">Confirm Current Password</label>
                            <input type="password" id="deletePasswordInput" placeholder="Current Password" class="input-text-style w-full bg-red-900/20 border-red-700/50 mb-3">
                            
                            <label for="deleteConfirmText" class="block text-red-300 text-sm font-light mb-2">Type "Delete My Account" to confirm (Case-insensitive)</label>
                            <input type="text" id="deleteConfirmText" placeholder="Delete My Account" class="input-text-style w-full bg-red-900/20 border-red-700/50">
                            
                            <div class="flex justify-between items-center pt-4">
                                <p id="deleteMessage" class="general-message-area text-sm"></p>
                                <button id="finalDeleteBtn" class="btn-toolbar-style btn-primary-override-danger w-48" disabled style="padding: 0.5rem 0.75rem;">
                                     <i class="fa-solid fa-trash mr-1"></i> Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                deletionContent = `
                    <h3 class="text-xl font-bold text-white mb-2 mt-8">Delete Account</h3>
                    <div id="deletionSection" class="settings-box w-full bg-red-900/10 border-red-700/50 p-4">
                        <p class="text-sm font-light text-red-300 mb-3">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            WARNING: Deleting your account is permanent. You must re-authenticate with ${PROVIDER_CONFIG[primaryProviderId].name} to proceed.
                        </p>
                        
                        <div class="flex justify-between items-center pt-2">
                            <p id="deleteMessage" class="general-message-area text-sm"></p>
                            <button id="reauthenticateBtn" class="btn-toolbar-style w-48 btn-primary-override" data-provider-id="${primaryProviderId}" style="padding: 0.5rem 0.75rem;">
                                 <i class="fa-solid fa-key mr-1"></i> Re-authenticate
                            </button>
                            <button id="finalDeleteBtn" class="btn-toolbar-style btn-primary-override-danger w-48 hidden" style="padding: 0.5rem 0.75rem;">
                                 <i class="fa-solid fa-trash mr-1"></i> Delete Account
                            </button>
                        </div>
                    </div>
                `;
            }

            // --- Combined HTML for Account Management ---
            return `
                <h3 class="text-xl font-bold text-white mb-2">Linked Providers</h3>
                <div class="settings-box w-full mb-4 p-0" data-section="linked-providers">
                    ${linkedProvidersHtml}
                </div>
                
                <h3 class="text-xl font-bold text-white mb-2">Link New Providers</h3>
                <div class="settings-box w-full flex flex-col gap-0 p-0">
                    ${availableProvidersHtml}
                </div>
                
                ${deletionContent}
            `;
        }


        /**
         * Generates the HTML for the "General Settings" section.
         */
        function getGeneralContent(currentUsername, changesRemaining, changesThisMonth, currentMonthName, isEmailPasswordUser, providerData) {
             const changesUsed = changesThisMonth;
             
             // Conditionally generate the password section HTML
             let passwordSectionHtml = '';
             if (isEmailPasswordUser) {
                 passwordSectionHtml = getChangePasswordSection();
             }

             return `
                 <h2 class="text-3xl font-bold text-white mb-6">General Settings</h2>
                 
                 <div class="w-full">
                    
                    <div class="flex justify-between items-center mb-4 settings-box p-4">
                        <p class="text-sm font-light text-gray-300">
                           <i class="fa-solid fa-calendar-alt mr-2 text-yellow-500"></i>
                           Changes this month (<span class="text-emphasis text-yellow-300">${currentMonthName}</span>):
                        </p>
                        <span class="text-lg font-semibold ${changesRemaining > 0 ? 'text-green-400' : 'text-red-400'}">
                            ${changesUsed}/${MAX_CHANGES} used
                        </span>
                    </div>

                    <h3 class="text-xl font-bold text-white mb-2">Account Username</h3>
                    
                    <div id="usernameSection" class="settings-box transition-all duration-300 p-4">
                        
                        <div id="viewMode" class="flex justify-between items-center">
                            <p class="text-lg text-gray-400 leading-relaxed">
                                Current: <span id="currentUsernameText" class="text-emphasis text-blue-400">${currentUsername}</span>
                            </p>
                            <button id="enterEditModeBtn" class="btn-toolbar-style" style="padding: 0.5rem 0.75rem;">
                                 <i class="fa-solid fa-pen-to-square mr-1"></i> Change
                            </button>
                        </div>

                        <div id="editMode" class="hidden flex-col gap-3 pt-4 border-t border-[#252525]">
                            <label for="newUsernameInput" class="block text-gray-400 text-sm font-light">New Username</label>
                            <input type="text" id="newUsernameInput" value="${currentUsername}" maxlength="${MAX_LENGTH}"
                                   class="input-text-style w-full" 
                                   placeholder="${MIN_LENGTH}-${MAX_LENGTH} characters, only allowed symbols">
                            
                            <div class="flex justify-between items-center pt-2">
                                <p class="text-xs text-gray-500 font-light whitespace-nowrap">
                                    Length: <span id="minLength" class="font-semibold text-gray-400">${MIN_LENGTH}</span>/<span id="charCount" class="font-semibold text-gray-400">${currentUsername.length}</span>/<span id="maxLength" class="font-semibold text-gray-400">${MAX_LENGTH}</span>
                                </p>
                                
                                <div class="flex gap-2">
                                    <button id="applyUsernameBtn" class="btn-toolbar-style btn-primary-override w-24 transition-opacity duration-300" disabled style="padding: 0.5rem 0.75rem;">
                                        <i class="fa-solid fa-check"></i> Apply
                                    </button>
                                    <button id="cancelEditBtn" class="btn-toolbar-style w-24 transition-opacity duration-300" style="padding: 0.5rem 0.75rem;">
                                        <i class="fa-solid fa-xmark"></i> Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="usernameChangeMessage" class="general-message-area text-sm"></div>
                </div>
                
                ${passwordSectionHtml}
                
                ${getAccountManagementContent(providerData)}
             `;
         }

        /**
         * NEW: Generates the HTML for the "Privacy & Security" section.
         */
        function getPrivacyContent() {
            // Generate preset options
            const presetOptions = urlChangerPresets.map(preset => 
                `<option value="${preset.id}">${preset.name}</option>`
            ).join('');

            return `
                <h2 class="text-3xl font-bold text-white mb-6">Privacy & Security</h2>
                
                <div class="w-full">
                    <h3 class="text-xl font-bold text-white mb-2">Panic Key Settings</h3>
                    <div id="panicKeySection" class="settings-box transition-all duration-300 p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Configure up to 3 panic keys. Pressing the specified key (without Shift, Ctrl, or Alt) on any page will redirect you to the URL you set.
                            <br>
                            <span class="text-yellow-400">Valid keys:</span> a-z, 0-9, and &#96; - = [ ] \ ; ' , . /
                        </p>
                        
                        <div class="flex items-center gap-4 px-2 mb-2">
                            <label class="block text-gray-400 text-sm font-light" style="width: 4rem; text-align: center;">Key</label>
                            <label class="block text-gray-400 text-sm font-light flex-grow">Redirect URL</label>
                        </div>

                        <div class="flex items-center gap-4 mb-3">
                            <input type="text" id="panicKey1" data-key-id="1" class="input-key-style panic-key-input" placeholder="-" maxlength="1">
                            <input type="url" id="panicUrl1" class="input-text-style" placeholder="e.g., https://google.com">
                        </div>
                        
                        <div class="flex items-center gap-4 mb-3">
                            <input type="text" id="panicKey2" data-key-id="2" class="input-key-style panic-key-input" placeholder="-" maxlength="1">
                            <input type="url" id="panicUrl2" class="input-text-style" placeholder="e.g., https://youtube.com/feed/subscriptions">
                        </div>
                        
                        <div class="flex items-center gap-4 mb-3">
                            <input type="text" id="panicKey3" data-key-id="3" class="input-key-style panic-key-input" placeholder="-" maxlength="1">
                            <input type="url" id="panicUrl3" class="input-text-style" placeholder="e.g., https://wikipedia.org">
                        </div>
                        
                        <div class="flex justify-between items-center pt-4 border-t border-[#252525]">
                            <p id="panicKeyMessage" class="general-message-area text-sm"></p>
                            <button id="applyPanicKeyBtn" class="btn-toolbar-style btn-primary-override w-36" style="padding: 0.5rem 0.75rem;">
                                <i class="fa-solid fa-check mr-1"></i> Apply Keys
                            </button>
                        </div>
                    </div>
                    
                    <div id="panicKeyGlobalMessage" class="general-message-area text-sm"></div>
                </div>
                
                <div class="w-full mt-8">
                    <h3 class="text-xl font-bold text-white mb-2">Tab Disguise (URL Changer)</h3>
                    <div id="urlChangerSection" class="settings-box transition-all duration-300 p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Change the title and favicon of the website to disguise it. This setting is saved locally in your browser.
                        </p>
                        
                        <div class="flex flex-col gap-4">
                            <div>
                                <label for="tabDisguiseMode" class="block text-gray-400 text-sm font-light mb-2">Mode</label>
                                <select id="tabDisguiseMode" class="input-select-style">
                                    <option value="none">None (Use 4SP Default)</option>
                                    <option value="preset">Use a Preset</option>
                                    <option value="custom">Use Custom Title/Favicon</option>
                                </select>
                            </div>
                            
                            <div id="tabDisguisePresetGroup" class="hidden">
                                <label for="tabDisguisePreset" class="block text-gray-400 text-sm font-light mb-2">Preset</label>
                                <select id="tabDisguisePreset" class="input-select-style">
                                    ${presetOptions}
                                </select>
                            </div>
                            
                            <div id="tabDisguiseCustomGroup" class="hidden flex flex-col gap-4">
                                <div>
                                    <label for="customTabTitle" class="block text-gray-400 text-sm font-light mb-2">Custom Title</label>
                                    <input type="text" id="customTabTitle" class="input-text-style" placeholder="e.g., Google Docs">
                                </div>
                                
                                <div class="form-group">
                                    <label for="faviconFetchInput" class="block text-gray-400 text-sm font-light mb-2">Custom Favicon (Fetch from Domain)</label>
                                    <div class="flex items-center gap-2">
                                        <input type="text" id="faviconFetchInput" class="input-text-style" placeholder="e.g., google.com">
                                        <button type="button" id="fetchFaviconBtn" class="btn-toolbar-style btn-primary-override w-28" style="padding: 0.5rem 0.75rem;">Fetch</button>
                                        <div id="favicon-fetch-preview-container" class="w-10 h-10 border border-[#252525] bg-[#111111] rounded-md flex items-center justify-center p-1 flex-shrink-0">
                                            <img src="" alt="Preview" class="w-full h-full object-contain" style="display: none;">
                                        </div>
                                    </div>
                                </div>
                                </div>
                        </div>

                        <div class="flex justify-between items-center pt-4 mt-4 border-t border-[#252525]">
                            <p id="urlChangerMessage" class="general-message-area text-sm"></p>
                            <button id="applyUrlChangerBtn" class="btn-toolbar-style btn-primary-override w-36" style="padding: 0.5rem 0.75rem;">
                                <i class="fa-solid fa-check mr-1"></i> Apply Tab
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        
        /**
         * NEW: Generates the HTML for the "Personalization" section.
         */
        function getPersonalizationContent() {
             return `
                <style>
                    /* Custom Range Slider Styling */
                    .mac-slider {
                        -webkit-appearance: none;
                        appearance: none;
                        background: transparent; /* Track color handled by Tailwind classes */
                    }
                    .mac-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        background: black;
                        border: 2px solid white;
                        border-radius: 50%;
                        cursor: pointer;
                        margin-top: -6px; /* Adjust based on track height */
                    }
                    .mac-slider::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        background: black;
                        border: 2px solid white;
                        border-radius: 50%;
                        cursor: pointer;
                    }
                    .mac-slider::-webkit-slider-runnable-track {
                        height: 0.5rem;
                        border-radius: 0.5rem;
                        background: #374151; /* gray-700 */
                    }
                    .mac-slider::-moz-range-track {
                        height: 0.5rem;
                        border-radius: 0.5rem;
                        background: #374151;
                    }
                    /* Live preview scaling for orientation mode */
                    .mac-preview-scaled {
                        transition: transform 0.3s ease;
                        transform-origin: center;
                    }
                </style>
                <h2 class="text-3xl font-bold text-white mb-6">Personalization</h2>
                
                <div class="w-full">
                    <!-- PROFILE PICTURE SECTION -->
                    <h3 class="text-xl font-bold text-white mb-2">Profile Picture</h3>
                    <div id="pfpSection" class="settings-box transition-all duration-300 p-4 mb-8">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Choose how you appear across the site.
                        </p>
                        
                        <div class="flex flex-col gap-4">
                            <!-- Mode Selection Buttons -->
                            <div class="flex gap-4 mb-4 border-b border-[#333] pb-4">
                                <button class="pfp-mode-btn active btn-toolbar-style" data-mode="google">Google PFP</button>
                                <button class="pfp-mode-btn btn-toolbar-style" data-mode="letter">Letter Avatar</button>
                                <button class="pfp-mode-btn btn-toolbar-style" data-mode="mibi">Mibi Avatar</button>
                                <button class="pfp-mode-btn btn-toolbar-style" data-mode="custom">Upload Image</button>
                            </div>

                            <!-- Letter Avatar Options -->
                            <div id="pfpLetterSettings" class="hidden flex flex-col gap-4 mt-2">
                                <label class="block text-gray-400 text-xs mb-1 font-light">Custom Text (Max 3)</label>
                                <div class="flex gap-4 items-center mb-4">
                                    <input type="text" id="pfp-custom-text" maxlength="3" class="input-text-style w-24 text-center uppercase" placeholder="A">
                                    <p class="text-xs text-gray-500">Leave empty to use username initial.</p>
                                </div>
                                
                                <label class="block text-gray-400 text-xs mb-2 font-light">Background Color</label>
                                <div class="flex flex-wrap gap-2 mb-6" id="pfp-color-grid"></div>
                                
                                <button id="save-letter-pfp-btn" class="btn-toolbar-style btn-primary-override w-full justify-center">Set Letter Avatar</button>
                            </div>

                            <!-- Mibi Avatar Settings (Hidden by default) -->
                            <div id="pfpMibiSettings" class="hidden flex flex-col gap-4 mt-2">
                                <p class="text-sm font-light text-gray-400 mb-4">
                                    Create your custom Mibi Avatar!
                                </p>
                                <button id="open-mac-menu-btn" class="btn-toolbar-style btn-primary-override">
                                    <i class="fa-solid fa-paintbrush mr-2"></i> Open Mibi Avatar Creator
                                </button>
                                
                                <!-- MAC Modal -->
                                <div id="mibi-mac-menu" class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 hidden backdrop-blur-sm">
                                    <div class="relative bg-black rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-[#333]">
                                        
                                        <!-- Header -->
                                        <div class="flex justify-between items-center p-6 border-b border-[#333] bg-black">
                                            <h3 class="text-2xl font-bold text-white">Mibi Avatar Creator</h3>
                                            <button id="mac-close-x-btn" class="btn-toolbar-style w-10 h-10 flex items-center justify-center p-0">
                                                <i class="fa-solid fa-xmark fa-xl"></i>
                                            </button>
                                        </div>
                                        
                                        <!-- Main Content Area (Split View) -->
                                        <div class="flex flex-grow overflow-hidden relative">
                                            
                                            <!-- LEFT: Live Preview -->
                                            <div id="mac-preview-wrapper" class="w-1/2 flex flex-col items-center justify-center bg-[#0a0a0a] p-8 border-r border-[#333] transition-all duration-500 ease-in-out z-10">
                                                <div class="relative h-64 md:h-80 aspect-square rounded-full overflow-hidden border-4 border-[#333] shadow-lg mb-6 transition-all duration-300 hover:border-dashed hover:border-white cursor-pointer flex-shrink-0" id="mac-preview-container" style="aspect-ratio: 1/1;">
                                                    <!-- Background (Static) -->
                                                    <div id="mac-preview-bg" class="absolute inset-0 w-full h-full transition-colors duration-300"></div>
                                                    
                                                    <!-- Avatar Layers Container (Rotates/Scales/Moves) -->
                                                    <div id="mac-layers-container" class="absolute inset-0 w-full h-full transition-transform duration-75 ease-out origin-center pointer-events-none">
                                                        <img id="mac-layer-head" src="../mibi-avatars/head.png" class="absolute inset-0 w-full h-full object-contain z-10">
                                                        <img id="mac-layer-eyes" class="absolute inset-0 w-full h-full object-contain z-20 hidden">
                                                        <img id="mac-layer-mouth" class="absolute inset-0 w-full h-full object-contain z-20 hidden">
                                                        <img id="mac-layer-hat" class="absolute inset-0 w-full h-full object-contain z-30 hidden">
                                                    </div>
                                                </div>
                                                
                                                <div id="mac-sliders-container" class="hidden flex-col gap-6 w-full max-w-xs transition-opacity duration-300 opacity-0">
                                                    <div class="flex flex-col gap-2">
                                                        <label class="text-xs text-gray-400 uppercase tracking-wider font-bold">Size</label>
                                                        <input type="range" id="mac-size-slider" min="50" max="150" value="100" list="mac-size-ticks" class="mac-slider w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                                                        <datalist id="mac-size-ticks">
                                                            <option value="100"></option>
                                                        </datalist>
                                                    </div>
                                                    <div class="flex flex-col gap-2">
                                                        <label class="text-xs text-gray-400 uppercase tracking-wider font-bold">Rotation</label>
                                                        <input type="range" id="mac-rotation-slider" min="-180" max="180" value="0" list="mac-rotation-ticks" class="mac-slider w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                                                        <datalist id="mac-rotation-ticks">
                                                            <option value="0"></option>
                                                        </datalist>
                                                    </div>
                                                    <p class="text-center text-gray-500 text-sm mt-2"><i class="fa-solid fa-hand-pointer mr-1"></i> Drag avatar to position</p>
                                                </div>
                                                
                                                <p class="text-gray-500 text-sm font-mono mt-2" id="mac-preview-label">Click preview to adjust orientation</p>
                                            </div>

                                            <!-- RIGHT: Controls & Options -->
                                            <div id="mac-controls-wrapper" class="w-1/2 flex flex-col bg-black transition-transform duration-500 ease-in-out translate-x-0">
                                                
                                                <!-- Tabs -->
                                                <div class="flex border-b border-[#333]">
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium active-tab" data-tab="hats">
                                                        <i class="fa-solid fa-hat-wizard mr-2"></i> Hats
                                                    </button>
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium" data-tab="eyes">
                                                        <i class="fa-solid fa-eye mr-2"></i> Eyes
                                                    </button>
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium" data-tab="mouths">
                                                        <i class="fa-solid fa-face-smile mr-2"></i> Mouths
                                                    </button>
                                                    <button class="mac-tab-btn flex-1 py-4 text-gray-400 hover:text-white hover:bg-[#252525] transition-colors border-b-2 border-transparent font-medium" data-tab="bg">
                                                        <i class="fa-solid fa-palette mr-2"></i> Color
                                                    </button>
                                                </div>

                                                <!-- Options Grid (Scrollable) -->
                                                <div class="flex-grow overflow-y-auto p-6 custom-scrollbar" id="mac-options-container">
                                                    <!-- Dynamic Content Loaded Here -->
                                                    <div class="grid grid-cols-3 gap-4" id="mac-grid">
                                                        <!-- JS populates this -->
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                        
                                        <!-- Footer Actions -->
                                        <div class="p-6 border-t border-[#333] bg-black flex justify-end gap-4 items-center">
                                            <button id="mac-reset-btn" class="btn-toolbar-style mr-auto px-4 py-2 rounded-xl" title="Reset Avatar">
                                                <i class="fa-solid fa-rotate-left"></i>
                                            </button>
                                            <button id="mac-cancel-btn" class="btn-toolbar-style px-6 py-2 rounded-xl">Cancel</button>
                                            <button id="mac-confirm-btn" class="btn-toolbar-style btn-primary-override px-6 py-2 rounded-xl">
                                                <i class="fa-solid fa-check mr-2"></i> Confirm Avatar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Custom Upload Settings (Hidden by default) -->
                            <div id="pfpCustomSettings" class="hidden mt-2">
                                <div class="flex items-center gap-4">
                                    <!-- Preview -->
                                    <div class="w-16 h-16 rounded-full overflow-hidden border border-gray-600 flex-shrink-0 bg-black relative">
                                        <img id="customPfpPreview" src="" class="w-full h-full object-cover" style="display: none;">
                                        <div id="customPfpPlaceholder" class="w-full h-full flex items-center justify-center text-gray-600">
                                            <i class="fa-solid fa-user"></i>
                                        </div>
                                    </div>
                                    
                                    <!-- Upload Button -->
                                    <div>
                                        <button id="uploadPfpBtn" class="btn-toolbar-style btn-primary-override">
                                            <i class="fa-solid fa-upload mr-2"></i> Upload Image
                                        </button>
                                        <input type="file" id="pfpFileInput" accept="image/*" style="display: none;">
                                        <p class="text-xs text-gray-500 mt-1">Max size: 2MB. Images are cropped to square.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="pfpMessage" class="general-message-area text-sm"></div>
                    </div>

                    <!-- THEME SECTION -->
                    <h3 class="text-xl font-bold text-white mb-2">Navigation Bar Theme</h3>
                    <div id="themeSection" class="settings-box transition-all duration-300 p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Select a theme for your navigation bar. This setting is saved locally and will apply a live preview.
                        </p>
                        
                        <div id="theme-picker-container">
                            <div class="flex items-center justify-center p-8">
                                <i class="fa-solid fa-spinner fa-spin fa-2x text-gray-500"></i>
                            </div>
                        </div>
                        
                        <div id="themeMessage" class="general-message-area text-sm"></div>
                    </div>
                </div>
             `;
        }
        
        // --- NEW: Generates the HTML for the "Data Management" section ---
        function getDataManagementContent() {
            return `
                <h2 class="text-3xl font-bold text-white mb-6">Data Management</h2>
                <div class="w-full">
                    <h3 class="text-xl font-bold text-white mb-2">Export Data</h3>
                    <div class="settings-box transition-all duration-300 p-4 mb-8">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Export all your local game data (from LocalStorage and IndexedDB) into a single JSON file. 
                            This file can be used as a backup or to transfer your data to another browser.
                        </p>
                        <button id="exportDataBtn" class="btn-toolbar-style btn-primary-override w-48">
                            <i class="fa-solid fa-download mr-2"></i> Export Data
                        </button>
                    </div>

                    <h3 class="text-xl font-bold text-white mb-2">Import Data</h3>
                    <div class="settings-box transition-all duration-300 p-4 bg-red-900/10 border-red-700/50">
                        <p class="text-sm font-light text-red-300 mb-4">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i> 
                            **WARNING:** Importing data will overwrite all existing local game data. This action cannot be undone.
                            Only import a file you have previously exported from this site.
                        </p>
                        <button id="importDataBtn" class="btn-toolbar-style btn-primary-override-danger w-48">
                            <i class="fa-solid fa-upload mr-2"></i> Import Data
                        </button>
                    </div>
                </div>
            `;
        }


        /**
         * NEW: Generates the HTML for the "Admin" section.
         */
                 function getManagementContent() {            return `

                <h2 class="text-3xl font-bold text-white mb-6">Admin Management</h2>
                
                <!-- Admin Management Section -->
                <div class="w-full mb-8">
                    <h3 class="text-xl font-bold text-white mb-2">Admin Management</h3>
                    <div class="settings-box p-4">
                        <p class="text-sm font-light text-gray-400 mb-4">
                            Manage website administrators. Superadmins can add/remove other admins and designate additional superadmins.
                        </p>

                        <!-- Current Admins List -->
                        <div class="mb-4">
                            <label class="block text-gray-400 text-sm font-light mb-2">Current Administrators</label>
                            <div id="current-admins-list" class="flex flex-col gap-2">
                                <!-- Admins will be loaded here by JavaScript -->
                                <p class="text-gray-500 italic">Loading admins...</p>
                            </div>
                        </div>

                        <!-- Add Admin Section -->
                        <div class="border-t border-[#252525] pt-4 mt-4">
                            <label for="newAdminEmail" class="block text-gray-400 text-sm font-light mb-2">Add New Admin (by Email)</label>
                            <div class="flex gap-2">
                                <input type="email" id="newAdminEmail" class="input-text-style flex-grow" placeholder="Enter email address">
                                <button id="addAdminBtn" class="btn-toolbar-style btn-primary-override w-24">
                                    <i class="fa-solid fa-user-plus"></i> Add
                                </button>
                            </div>
                            <p id="adminMessage" class="general-message-area text-sm mt-2"></p>
                        </div>

                        <!-- Superadmin Controls (only visible to superadmin) -->
                        <div id="superadmin-controls" class="hidden border-t border-[#252525] pt-4 mt-4">
                            <h4 class="text-lg font-bold text-white mb-2">Superadmin Actions</h4>
                            <p class="text-sm font-light text-gray-400 mb-4">
                                Only the primary superadmin can manage other superadmins and strip admin privileges.
                            </p>
                            <div class="flex flex-col gap-3">
                                <div class="flex gap-2 items-center">
                                    <input type="email" id="newSuperadminEmail" class="input-text-style flex-grow" placeholder="Email for new superadmin">
                                    <button id="addSuperadminBtn" class="btn-toolbar-style btn-primary-override w-36">
                                        <i class="fa-solid fa-user-gear"></i> Add Superadmin
                                    </button>
                                </div>
                                <p id="superadminMessage" class="general-message-area text-sm mt-2"></p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        /**
         * NEW: Loads data and adds event listeners for the Admin tab.
         * (Client-side implementation without Cloud Functions)
         */
        async function loadManagementTab() {
            // Safety check: Ensure we don't run this logic if not an admin (even if tab is somehow visible)
            // This relies on initializeAuth correctly setting isUserAdmin
            if (!isUserAdmin) {
                console.warn("loadManagementTab called but user is not an admin.");
                // Optionally clear the view or show an error
                document.getElementById('settings-main-view').innerHTML = '<p class="text-red-500 p-4">Access Denied: Insufficient permissions.</p>';
                return;
            }

            const SUPERADMIN_EMAIL = '4simpleproblems@gmail.com';
            const MAX_SUPERADMINS = 2; // Primary superadmin + 2 others

            const currentAdminsList = document.getElementById('current-admins-list');
            const newAdminEmailInput = document.getElementById('newAdminEmail');
            const addAdminBtn = document.getElementById('addAdminBtn');
            const adminMessage = document.getElementById('adminMessage');
            const superadminControls = document.getElementById('superadmin-controls');
            const newSuperadminEmailInput = document.getElementById('newSuperadminEmail');
            const addSuperadminBtn = document.getElementById('addSuperadminBtn');
            const superadminMessage = document.getElementById('superadminMessage');

            let allAdmins = []; // Store all admin user objects (with email/username)
            let isPrimarySuperadmin = currentUser.email === SUPERADMIN_EMAIL;

            // --- Helper: Render Admin List ---
            const renderAdminList = () => {
                currentAdminsList.innerHTML = '';
                if (allAdmins.length === 0) {
                    currentAdminsList.innerHTML = `<p class="text-gray-500 italic">No administrators found (besides yourself if you are one).</p>`;
                    return;
                }

                allAdmins.forEach(admin => {
                    const isAdminUser = admin.isAdmin; // true for all entries in allAdmins
                    const isSuperadmin = admin.isSuperadmin;
                    const isCurrentUser = admin.uid === currentUser.uid;

                    let actionsHtml = '';
                    if (isPrimarySuperadmin && !isCurrentUser) { // Primary superadmin can manage other admins/superadmins
                        if (isSuperadmin) {
                            // Only primary superadmin can remove other superadmins
                            actionsHtml += `<button class="btn-toolbar-style btn-primary-override-danger w-24" onclick="window.handleRemoveSuperadmin('${admin.uid}', '${admin.email}')"><i class="fa-solid fa-user-slash mr-1"></i> Remove SA</button>`;
                        } else {
                            actionsHtml += `<button class="btn-toolbar-style btn-primary-override-danger w-24" onclick="window.handleRemoveAdmin('${admin.uid}', '${admin.username || admin.email}')"><i class="fa-solid fa-user-minus mr-1"></i> Remove Admin</button>`;
                        }
                    } else if (!isPrimarySuperadmin && !isCurrentUser) {
                        actionsHtml = `<span class="text-gray-500 text-sm">No actions</span>`;
                    } else if (isCurrentUser) {
                        actionsHtml = `<span class="text-gray-500 text-sm">(You)</span>`;
                    }
                    
                    const adminEntry = document.createElement('div');
                    adminEntry.className = 'flex justify-between items-center bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-3';
                    adminEntry.innerHTML = `
                        <div>
                            <span class="font-medium text-white">${admin.username || admin.email}</span>
                            ${isSuperadmin ? '<span class="text-xs text-yellow-400 ml-2 font-normal">(Superadmin)</span>' : ''}
                            ${isCurrentUser ? '<span class="text-xs text-blue-400 ml-2 font-normal">(Current User)</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            ${actionsHtml}
                        </div>
                    `;
                    currentAdminsList.appendChild(adminEntry);
                });
            };

            // --- Fetch Users and Admins ---
            const fetchAdmins = async () => {
                currentAdminsList.innerHTML = `<p class="text-gray-500 italic">Loading admins...</p>`;

                try {
                    const adminsSnap = await getDocs(collection(db, 'admins'));
                    
                    const adminsMap = new Map(); // Store full admin data for display
                    adminsSnap.forEach(doc => adminsMap.set(doc.id, doc.data()));

                    allAdmins = [];

                    adminsSnap.forEach(doc => {
                        const uid = doc.id;
                        const adminData = doc.data();
                        const isSuperadmin = adminData.email === SUPERADMIN_EMAIL || adminData.role === 'superadmin';

                        const adminEntry = {
                            uid: uid,
                            username: adminData.username || 'Unknown',
                            email: adminData.email || 'No Email',
                            isAdmin: true,
                            isSuperadmin: isSuperadmin
                        };

                        allAdmins.push(adminEntry);
                    });

                    // Sort admins to put primary superadmin first, then other superadmins, then regular admins
                    allAdmins.sort((a, b) => {
                        if (a.email === SUPERADMIN_EMAIL) return -1;
                        if (b.email === SUPERADMIN_EMAIL) return 1;
                        if (a.isSuperadmin && !b.isSuperadmin) return -1;
                        if (!a.isSuperadmin && b.isSuperadmin) return 1;
                        return (a.username || '').localeCompare(b.username || '');
                    });

                    renderAdminList();
                    
                    // Show superadmin controls if current user is primary superadmin
                    if (isPrimarySuperadmin) {
                        superadminControls.classList.remove('hidden');
                    } else {
                        superadminControls.classList.add('hidden');
                    }

                } catch (error) {
                    console.error("Error fetching admins:", error);
                    currentAdminsList.innerHTML = `<p class="text-red-400">Error loading admins: ${error.message}</p>`;
                }
            };
            
            // --- Handlers for Admin Management Actions (Add/Remove Admin, Add/Remove Superadmin) ---
            window.handleRemoveAdmin = async (uid, username) => {
                if (!isPrimarySuperadmin) {
                    showMessage(adminMessage, 'You do not have permission to remove admins.', 'error');
                    return;
                }
                if (!confirm(`Are you sure you want to remove ${username} as an admin?`)) return;

                showMessage(adminMessage, `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Removing admin privileges...`, 'warning');
                try {
                    await deleteDoc(doc(db, 'admins', uid));
                    showMessage(adminMessage, `${username}'s admin privileges have been removed.`, 'success');
                    fetchAdmins();
                } catch (error) {
                    console.error("Remove Admin error:", error);
                    showMessage(adminMessage, `Failed to remove admin: ${error.message}`, 'error');
                }
            };

            addAdminBtn.addEventListener('click', async () => {
                const email = newAdminEmailInput.value.trim();
                if (!email) {
                    showMessage(adminMessage, 'Please enter an email address.', 'error');
                    return;
                }
                if (allAdmins.some(admin => admin.email === email)) {
                    showMessage(adminMessage, 'This user is already an admin.', 'error');
                    return;
                }

                showMessage(adminMessage, `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Searching for user and adding as admin...`, 'warning');
                addAdminBtn.disabled = true;

                try {
                    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
                    const usersSnapshot = await getDocs(usersQuery);

                    if (usersSnapshot.empty) {
                        showMessage(adminMessage, 'No user found with that email address.', 'error');
                    } else {
                        const userDoc = usersSnapshot.docs[0];
                        const uid = userDoc.id;
                        const username = userDoc.data().username || email; // Use email if no username

                        await setDoc(doc(db, 'admins', uid), {
                            role: 'admin',
                            addedBy: currentUser.uid,
                            addedAt: serverTimestamp(),
                            username: username,
                            email: email
                        });
                        showMessage(adminMessage, `${username} has been added as an admin.`, 'success');
                        newAdminEmailInput.value = '';
                        fetchAdmins();
                    }
                } catch (error) {
                    console.error("Add Admin by email error:", error);
                    showMessage(adminMessage, `Failed to add admin: ${error.message}`, 'error');
                } finally {
                    addAdminBtn.disabled = false;
                }
            });

            window.handleRemoveSuperadmin = async (uid, email) => {
                if (!isPrimarySuperadmin) {
                    showMessage(superadminMessage, 'You do not have permission to remove superadmins.', 'error');
                    return;
                }
                if (email === SUPERADMIN_EMAIL) { // Cannot remove primary superadmin
                    showMessage(superadminMessage, 'The primary superadmin cannot be removed.', 'error');
                    return;
                }
                if (!confirm(`Are you sure you want to remove ${email} as a superadmin? They will revert to a regular admin.`)) return;

                showMessage(superadminMessage, `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Removing superadmin privileges...`, 'warning');
                try {
                    await updateDoc(doc(db, 'admins', uid), {
                        role: 'admin', // Revert to regular admin
                        superadminRemovedBy: currentUser.uid,
                        superadminRemovedAt: serverTimestamp()
                    });
                    showMessage(superadminMessage, `${email}'s superadmin privileges have been removed.`, 'success');
                    fetchAdmins();
                } catch (error) {
                    console.error("Remove Superadmin error:", error);
                    showMessage(superadminMessage, `Failed to remove superadmin: ${error.message}`, 'error');
                }
            };
            
            addSuperadminBtn.addEventListener('click', async () => {
                const email = newSuperadminEmailInput.value.trim();
                if (!email) {
                    showMessage(superadminMessage, 'Please enter an email address.', 'error');
                    return;
                }
                if (!isPrimarySuperadmin) {
                    showMessage(superadminMessage, 'You do not have permission to add superadmins.', 'error');
                    return;
                }

                // Check current superadmin count
                const currentSuperadmins = allAdmins.filter(admin => admin.isSuperadmin);
                if (currentSuperadmins.length >= MAX_SUPERADMINS + (SUPERADMIN_EMAIL === currentUser.email ? 0 : 1) && email !== SUPERADMIN_EMAIL) {
                    showMessage(superadminMessage, `Cannot add more than ${MAX_SUPERADMINS} additional superadmins.`, 'error');
                    return;
                }

                showMessage(superadminMessage, `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Searching for user and adding as superadmin...`, 'warning');
                addSuperadminBtn.disabled = true;

                try {
                    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
                    const usersSnapshot = await getDocs(usersQuery);

                    if (usersSnapshot.empty) {
                        showMessage(superadminMessage, 'No user found with that email address.', 'error');
                    } else {
                        const userDoc = usersSnapshot.docs[0];
                        const uid = userDoc.id;
                        const username = userDoc.data().username || email;

                        // Check if already an admin
                        const adminDocRef = doc(db, 'admins', uid);
                        const adminDocSnap = await getDoc(adminDocRef);

                        if (adminDocSnap.exists()) {
                            // Already an admin, just upgrade role
                            await updateDoc(adminDocRef, {
                                role: 'superadmin',
                                superadminAddedBy: currentUser.uid,
                                superadminAddedAt: serverTimestamp()
                            });
                            showMessage(superadminMessage, `${username} has been promoted to superadmin.`, 'success');
                        } else {
                            // Not an admin yet, add as superadmin
                            await setDoc(adminDocRef, {
                                role: 'superadmin',
                                addedBy: currentUser.uid,
                                addedAt: serverTimestamp(),
                                username: username,
                                email: email
                            });
                            showMessage(superadminMessage, `${username} has been added as a superadmin.`, 'success');
                        }
                        newSuperadminEmailInput.value = '';
                        fetchAdmins();
                    }
                } catch (error) {
                    console.error("Add Superadmin error:", error);
                    showMessage(superadminMessage, `Failed to add superadmin: ${error.message}`, 'error');
                } finally {
                    addSuperadminBtn.disabled = false;
                }
            });
            
            // Initial Fetch
            await fetchAdmins();
        }


        /**
         * Generates the HTML for the "About 4SP" section.
         */
        function getAboutContent() {
            return `
                <h2 class="text-3xl font-bold text-white mb-4">About 4SP (4simpleproblems)</h2>
                
                <div class="about-section-content">
                    <p class="text-lg text-gray-400 leading-relaxed">
                        <span class="text-emphasis">4SP (4simpleproblems)</span> is a <span class="text-emphasis">Student Toolkit and Entertainment website</span> designed to boost student productivity and provide useful resources. We aim to solve four core challenges that students face every day by integrating essential tools and engaging digital content into one seamless platform.
                    </p>
                    
                    <h3 class="text-xl font-bold text-white mt-6 mb-2">The Four Simple Problems We Address</h3>
                    <ul class="list-disc list-inside ml-4 text-lg text-gray-400 leading-relaxed">
                        <li>Providing a <span class="text-emphasis">digital leisure platform free of advertisements</span>.</li>
                        <li>Delivering a <span class="text-emphasis">student toolkit designed for accessibility and consistent availability</span>, bypassing typical institutional network restrictions.</li>
                        <li>Establishing a <span class="text-emphasis">free, comprehensive, and reliable entertainment and resource hub</span>.</li>
                        <li>Enforcing <span class="text-emphasis">internal governance and balance of power</span>: Administrative authority is strictly limited to necessary website management functions, and only the creator holds full administrative power, ensuring neutrality.</li>
                    </ul>

                    <p class="text-lg text-gray-400 mt-4 leading-relaxed">
                        Features currently include an <span class="text-emphasis">online notebook</span> in the Notes App for secure organization, a <span class="text-emphasis">live clock</span> on the dashboard, a <span class="text-emphasis">dictionary</span> for quick lookups, and more tools.
                    </p>
                    
                    <h3 class="text-xl font-bold text-white mt-6 mb-2">Version</h3>
                    <p class="text-gray-400">
                        Current Version: <span class="text-blue-400 text-emphasis">5.0.17</span>
                    </p>

                    <h3 class="text-xl font-bold text-white mt-6 mb-3">Connect & Support</h3>
                    <div class="social-link-group">
                        <a href="https://www.youtube.com/@4simpleproblems" target="_blank" class="btn-toolbar-style" title="YouTube">
                            <i class="fa-brands fa-youtube fa-lg mr-2"></i> YouTube
                        </a>
                        <a href="https://x.com/4simpleproblems" target="_blank" class="btn-toolbar-style" title="X (Twitter)">
                            <i class="fa-brands fa-x-twitter fa-lg mr-2"></i>X
                        </a>
                        <a href="https://buymeacoffee.com/4simpleproblems" target="_blank" class="btn-toolbar-style" title="Buy Me a Coffee">
                            <i class="fa-solid fa-mug-hot fa-lg mr-2"></i> Buy Me a Coffee
                        </a>
                        <a href="https://github.com/v5-4simpleproblems" target="_blank" class="btn-toolbar-style" title="GitHub">
                            <i class="fa-brands fa-github fa-lg mr-2"></i> Github
                        </a>
                    </div>
                    
                    <h3 class="text-xl font-bold text-white mt-6 mb-3">Legal Information</h3>
                    <div class="legal-buttons">
                        <a href="../legal.html#terms-of-service" class="btn-toolbar-style">Terms of Service</a>
                        <a href="../legal.html#privacy-policy" class="btn-toolbar-style">Privacy Policy</a>
                    </div>
                </div>
            `;
        }

        /**
         * Generates the HTML for the "Coming Soon" sections.
         */
        function getComingSoonContent(title) {
            return `
                <h2 class="text-3xl font-bold text-white mb-2">${title}</h2>
                <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                    <p class="text-xl text-gray-500 italic">...Coming Soon...</p>
                    <i class="fa-solid fa-hourglass-start fa-5x text-gray-700 mt-4"></i>
                </div>
            `;
        }
        
        // Helper for refreshing the General Tab
        const refreshGeneralTab = () => {
            // Clear the current view state and re-render the General tab
            // This is necessary because currentUser.providerData needs to be fresh
            switchTab('general');
        };

        // --- Mibi Avatar Creator (MAC) Logic ---

        // Global state for Mibi Avatar parts (persisted in this scope)
        let mibiAvatarState = {
            eyes: '',
            mouths: '',
            hats: '',
            bgColor: '#3B82F6', // Default blue
            size: 100,
            rotation: 0,
            offsetX: 0,
            offsetY: 0
        };
        
        const letterColors = [
            'EF4444', 'F97316', 'FDBA74', 'EAB308', 'FDE047',
            '22C55E', '86EFAC', '06B6D4', '67E8F9', '3B82F6',
            '93C5FD', '6366F1', 'A5B4FC', 'A855F7', 'D8B4FE',
            'EC4899', 'F9A8D4', '6B7280', '000000'
        ];

        // Constants for Assets
        const MIBI_ASSETS = {
            eyes: ['default-eyes.png', 'glasses.png', 'odd.png'],
            mouths: ['default-mouth.png', 'drool.png', 'meh.png', 'no-clue.png', 'sad.png', 'wow.png'],
            hats: ['strawhat.png', 'tophat.png', 'partyhat.png', 'halo.png', 'toiletpaper.png'],
            colors: [
    // --- RAINBOW ORDER ---
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#EAB308', // Yellow
    '#84CC16', // Lime
    '#22C55E', // Green
    '#14B8A6', // Teal
    '#06B6D4', // Cyan
    '#0EA5E9', // Sky
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#7C3AED', // Violet
    '#A855F7', // Purple
    '#E879F9', // Fuchsia
    '#EC4899', // Pink
    '#F43F5E', // Rose
    '#FFFFFF'  // White
]
        };

        const updateMibiPreview = () => {
            const bgEl = document.getElementById('mac-preview-bg');
            const layersContainer = document.getElementById('mac-layers-container'); // New container for transforms
            const eyesEl = document.getElementById('mac-layer-eyes');
            const mouthEl = document.getElementById('mac-layer-mouth');
            const hatEl = document.getElementById('mac-layer-hat');
            
            if (!bgEl || !layersContainer) return;

            // Update BG
            bgEl.style.backgroundColor = mibiAvatarState.bgColor;
            
            // Update Transforms (using percentages for translate)
            const scale = mibiAvatarState.size / 100;
            layersContainer.style.transform = `translate(${mibiAvatarState.offsetX}%, ${mibiAvatarState.offsetY}%) rotate(${mibiAvatarState.rotation}deg) scale(${scale})`;

            // Update Layers
            if (mibiAvatarState.eyes) {
                eyesEl.src = `../mibi-avatars/eyes/${mibiAvatarState.eyes}`;
                eyesEl.classList.remove('hidden');
            } else {
                eyesEl.classList.add('hidden');
            }
            
            if (mibiAvatarState.mouths) {
                mouthEl.src = `../mibi-avatars/mouths/${mibiAvatarState.mouths}`;
                mouthEl.classList.remove('hidden');
            } else {
                mouthEl.classList.add('hidden');
            }

            if (mibiAvatarState.hats) {
                hatEl.src = `../mibi-avatars/hats/${mibiAvatarState.hats}`;
                hatEl.classList.remove('hidden');
            } else {
                hatEl.classList.add('hidden');
            }
        };

        const renderMacGrid = (category) => {
            const grid = document.getElementById('mac-grid');
            grid.innerHTML = ''; // Clear existing

            if (category === 'bg') {
                // Switch to Flex for Colors (Wrapping, no scrollbar)
                grid.className = 'flex flex-wrap gap-2 justify-center p-2';

                // Color Palette
                MIBI_ASSETS.colors.forEach(color => {
                    const btn = document.createElement('button');
                    const isSelected = mibiAvatarState.bgColor === color;
                    // Style: Match X button (w-10 h-10, rounded-xl i.e. 0.75rem) + flex-shrink-0
                    btn.className = `w-10 h-10 rounded-xl shadow-sm transition-transform hover:scale-110 focus:outline-none border-2 flex-shrink-0 ${isSelected ? 'border-white' : 'border-transparent'} hover:border-dashed hover:border-white`;
                    btn.style.backgroundColor = color;
                    
                    btn.onclick = () => {
                        mibiAvatarState.bgColor = color;
                        updateMibiPreview();
                        renderMacGrid('bg'); // Re-render to update selection ring
                    };
                    grid.appendChild(btn);
                });
                // Add custom picker
                const customWrapper = document.createElement('div');
                // Match size and roundness + flex-shrink-0
                customWrapper.className = 'w-10 h-10 rounded-xl bg-[#333] flex items-center justify-center cursor-pointer hover:bg-[#444] relative overflow-hidden border-2 border-transparent hover:border-dashed hover:border-white flex-shrink-0';
                customWrapper.innerHTML = '<i class="fa-solid fa-eye-dropper text-white text-sm"></i><input type="color" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full">';
                const input = customWrapper.querySelector('input');
                input.oninput = (e) => {
                    mibiAvatarState.bgColor = e.target.value;
                    updateMibiPreview();
                };
                grid.appendChild(customWrapper);

            } else {
                // Reset to Grid for Assets
                grid.className = 'grid grid-cols-3 gap-4';
                
                // "None" Option - ONLY for Hats
                if (category === 'hats') {
                    const noneBtn = document.createElement('div');
                    // Light grey background (bg-gray-200), More rounded (rounded-2xl)
                    noneBtn.className = `bg-gray-200 rounded-2xl p-2 flex flex-col items-center justify-center cursor-pointer border-2 hover:border-dashed hover:border-black transition-all ${!mibiAvatarState[category] ? 'border-black' : 'border-transparent'} aspect-square`;
                    noneBtn.innerHTML = `<i class="fa-solid fa-ban fa-2x text-gray-600"></i>`;
                    noneBtn.onclick = () => {
                        mibiAvatarState[category] = '';
                        updateMibiPreview();
                        renderMacGrid(category);
                    };
                    grid.appendChild(noneBtn);
                }

                // Asset Options
                const files = MIBI_ASSETS[category] || [];
                files.forEach(file => {
                    const item = document.createElement('div');
                    const isSelected = mibiAvatarState[category] === file;
                    // Light grey background (bg-gray-200), More rounded (rounded-2xl)
                    item.className = `bg-gray-200 rounded-2xl p-2 flex flex-col items-center justify-center cursor-pointer border-2 hover:border-dashed hover:border-black transition-all ${isSelected ? 'border-black' : 'border-transparent'} aspect-square`;
                    
                    item.innerHTML = `
                        <img src="../mibi-avatars/${category}/${file}" class="w-full h-full object-contain">
                    `;
                    
                    item.onclick = () => {
                        mibiAvatarState[category] = file;
                        updateMibiPreview();
                        renderMacGrid(category);
                    };
                    grid.appendChild(item);
                });
            }
        };

        const preloadMibiAssets = () => {

            const categories = ['eyes', 'mouths', 'hats'];

            categories.forEach(cat => {

                const files = MIBI_ASSETS[cat] || [];

                files.forEach(file => {

                    const img = new Image();

                    img.src = `../mibi-avatars/${cat}/${file}`;

                });

            });

        };

                

                        const setupMacMenuListeners = () => {

                            // Preload assets for faster loading

                            preloadMibiAssets();

                

                            const openBtn = document.getElementById('open-mac-menu-btn');

                            const menu = document.getElementById('mibi-mac-menu');

                            const closeBtn = document.getElementById('mac-close-x-btn');

                            const cancelBtn = document.getElementById('mac-cancel-btn');

                            const confirmBtn = document.getElementById('mac-confirm-btn');

                            const resetBtn = document.getElementById('mac-reset-btn'); // NEW

                            const tabBtns = document.querySelectorAll('.mac-tab-btn');

                            const pfpModeSelect = document.getElementById('pfpModeSelect');

                            const pfpMessage = document.getElementById('pfpMessage');

                            

                            // Orientation Mode Elements

                            const previewContainer = document.getElementById('mac-preview-container');

                            const previewWrapper = document.getElementById('mac-preview-wrapper'); // The w-1/2 container

                            const controlsWrapper = document.getElementById('mac-controls-wrapper'); // The w-1/2 menu container

                            const slidersContainer = document.getElementById('mac-sliders-container');

                            const sizeSlider = document.getElementById('mac-size-slider');

                            const rotationSlider = document.getElementById('mac-rotation-slider');

                            const macPreviewLabel = document.getElementById('mac-preview-label'); // NEW: Reference to the label

                

                            if (!openBtn || !menu) return;

                

                            window.MIBI_ASSETS = MIBI_ASSETS; 

                            

                                        let isOrientationMode = false;

                            

                                        let currentTab = 'hats'; // Track current tab

                            

                                        let orientationSnapshot = null; // Store state for reverting

                            

                            

                                        const openMenu = () => {

                            

                                            menu.classList.remove('hidden');

                            

                                            // Default selections if empty

                            

                                            if (!mibiAvatarState.eyes) mibiAvatarState.eyes = MIBI_ASSETS.eyes[0];

                            

                                            if (!mibiAvatarState.mouths) mibiAvatarState.mouths = MIBI_ASSETS.mouths[0];

                            

                                            

                                            // Reset Orientation Mode state on open

                            

                                            exitOrientationMode(false); // Don't revert on initial open reset

                            

                                            updateMibiPreview();

                            

                                            

                                            // Trigger click on first tab (or current) to load it

                            

                                            // Default to Hats

                            

                                            document.querySelector(`.mac-tab-btn[data-tab="${currentTab}"]`)?.click();

                            

                                        };

                            

                            

                                        const closeMenu = () => {

                            

                                            menu.classList.add('hidden');

                            

                                        };

                            

                            

                                        // --- Orientation Mode Logic ---

                            

                                                    const enterOrientationMode = () => {
    if (isOrientationMode) return;
    isOrientationMode = true;

    // Snapshot state for revert
    orientationSnapshot = { ...mibiAvatarState };

    // Animate UI
    // Parent changes layout to row
    previewWrapper.classList.remove('w-1/2', 'flex-col', 'items-center', 'justify-center');
    previewWrapper.classList.add('w-full', 'flex-row', 'justify-start', 'items-start', 'gap-x-12', 'pl-16'); 

    // Explicitly force width and height to be equal to fix pill bug
    const computedHeight = previewContainer.offsetHeight; 
    
    // --- FIX START ---
    previewContainer.style.width = `${computedHeight}px`;
    previewContainer.style.height = `${computedHeight}px`;
    // Add min-width to prevent flexbox crushing
    previewContainer.style.minWidth = `${computedHeight}px`; 
    previewContainer.style.minHeight = `${computedHeight}px`;
    // --- FIX END ---

    previewContainer.style.transform = ''; 

    // --- FIX START ---
    // DO NOT remove 'flex-shrink-0'. We remove 'w-2/3' and margins, but KEEP flex-shrink-0
    previewContainer.classList.remove('mt-16', 'w-2/3'); 
    previewContainer.classList.add('flex-shrink-0'); // Explicitly force it not to shrink
    
    // Show Sliders
    slidersContainer.classList.remove('hidden');
    // Trigger reflow/animation
    setTimeout(() => {
        slidersContainer.classList.remove('opacity-0');
        slidersContainer.classList.add('opacity-100');
    }, 50);

    // Hide Controls
    controlsWrapper.style.transform = 'translateX(100%)';
    controlsWrapper.style.opacity = '0';
    
    // Hide label
    if (macPreviewLabel) macPreviewLabel.style.display = 'none';
};

const exitOrientationMode = (shouldRevert = true) => {
    if (!isOrientationMode) return;
    isOrientationMode = false;

    if (shouldRevert && orientationSnapshot) {
        // User cancelled, revert changes made during orientation mode
        mibiAvatarState = { ...orientationSnapshot };
        // Reset slider values to snapshot
        sizeSlider.value = mibiAvatarState.size;
        rotationSlider.value = mibiAvatarState.rotation;
        updateMibiPreview();
    }

    // Revert UI
    previewWrapper.classList.remove('w-full', 'flex-row', 'justify-start', 'items-start', 'gap-x-12', 'pl-16');
    previewWrapper.classList.add('w-1/2', 'flex-col', 'items-center', 'justify-center');

    // Reset container size
    previewContainer.style.width = '';
    previewContainer.style.height = '';
    previewContainer.style.minWidth = '';
    previewContainer.style.minHeight = '';
    
    // Re-add removed classes (if any, though w-2/3 might not be needed in vertical mode if sizing is handled by css)
    // Actually, in vertical mode (start state), it relies on flex centering.
    
    // Hide Sliders
    slidersContainer.classList.remove('opacity-100');
    slidersContainer.classList.add('opacity-0');
    setTimeout(() => {
        if (!isOrientationMode) slidersContainer.classList.add('hidden'); // Check in case re-entered
    }, 300);

    // Show Controls
    controlsWrapper.style.transform = 'translateX(0)';
    controlsWrapper.style.opacity = '1';
    
    // Show label
    if (macPreviewLabel) macPreviewLabel.style.display = 'block';
};

// --- Event Listeners ---

openBtn.addEventListener('click', openMenu);
closeBtn.addEventListener('click', () => { closeMenu(); exitOrientationMode(true); });
cancelBtn.addEventListener('click', () => { closeMenu(); exitOrientationMode(true); });

// Click outside to close (optional, maybe safer to force button use)
menu.addEventListener('click', (e) => {
    if (e.target === menu) { closeMenu(); exitOrientationMode(true); }
});

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => {
            b.classList.remove('active-tab', 'text-white', 'border-white');
            b.classList.add('text-gray-400', 'border-transparent');
        });
        btn.classList.add('active-tab', 'text-white', 'border-white');
        btn.classList.remove('text-gray-400', 'border-transparent');
        
        currentTab = btn.dataset.tab;
        renderMacGrid(currentTab);
    });
});

// Orientation Mode Triggers
previewContainer.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent bubbling if needed
    if (isOrientationMode) {
        exitOrientationMode(false); // Click again to confirm/exit
    } else {
        enterOrientationMode();
    }
});

// Slider Inputs
const handleSliderChange = () => {
    mibiAvatarState.size = parseInt(sizeSlider.value);
    mibiAvatarState.rotation = parseInt(rotationSlider.value);
    updateMibiPreview();
};

sizeSlider.addEventListener('input', handleSliderChange);
rotationSlider.addEventListener('input', handleSliderChange);

// --- Draggable Logic (for Orientation Mode) ---
let isDragging = false;
let startX, startY;
// Store initial offsets when drag starts
let initialOffsetX = 0; 
let initialOffsetY = 0;

previewContainer.addEventListener('mousedown', (e) => {
    if (!isOrientationMode) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialOffsetX = mibiAvatarState.offsetX;
    initialOffsetY = mibiAvatarState.offsetY;
    previewContainer.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !isOrientationMode) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    // Sensitivity factor
    const factor = 0.2; 
    
    mibiAvatarState.offsetX = initialOffsetX + (deltaX * factor); 
    mibiAvatarState.offsetY = initialOffsetY + (deltaY * factor);
    
    updateMibiPreview();
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        previewContainer.style.cursor = 'pointer';
    }
});

// --- Confirm Logic ---
confirmBtn.addEventListener('click', async () => {
    // 1. Capture the preview container as an image
    // Using HTML2Canvas or constructing a canvas manually.
    // Manual canvas is safer for cross-origin/local image issues.
    
    const canvas = document.createElement('canvas');
    canvas.width = 500; // High res
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    
    // Fill BG
    ctx.fillStyle = mibiAvatarState.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Helper to load image
    const loadImg = (src) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // Continue even if fail
        img.src = src;
    });
    
    // Draw layers with transforms
    // Note: Canvas transforms apply to the drawing context state
    ctx.save();
    
    // Center of canvas
    ctx.translate(canvas.width/2, canvas.height/2);
    
    // Apply user transforms
    // Translate (percentage converted to pixels relative to canvas)
    // Actually, offsetX/Y in state are percentages. 
    // Let's assume 100% translation = full width/height (approx 500px)
    // Sensitivity factor used in drag was arbitrary, let's just use it as relative units.
    // Adjust scaling factor to match visual feel
    ctx.translate(mibiAvatarState.offsetX * 5, mibiAvatarState.offsetY * 5); 
    
    ctx.rotate((mibiAvatarState.rotation * Math.PI) / 180);
    const scale = mibiAvatarState.size / 100;
    ctx.scale(scale, scale);
    
    // Move back to top-left of image (assuming 500x500 images drawn at 0,0 relative to centered context)
    // Our images are "contained" in the div. 
    // We should draw them centered.
    ctx.translate(-canvas.width/2, -canvas.height/2);

    const layers = [
        '../mibi-avatars/head.png',
        mibiAvatarState.eyes ? `../mibi-avatars/eyes/${mibiAvatarState.eyes}` : null,
        mibiAvatarState.mouths ? `../mibi-avatars/mouths/${mibiAvatarState.mouths}` : null,
        mibiAvatarState.hats ? `../mibi-avatars/hats/${mibiAvatarState.hats}` : null
    ].filter(Boolean);

    for (const src of layers) {
        const img = await loadImg(src);
        if (img) {
            ctx.drawImage(img, 0, 0, 500, 500);
        }
    }
    
    ctx.restore();
    
    // Get Data URL
    const finalDataUrl = canvas.toDataURL('image/png');
    
    // Update User Profile
    await updateProfilePicture(null, finalDataUrl, 'mibi');
    
    closeMenu();
    exitOrientationMode(false); // Reset mode without reverting state (confirmed)
});

// Reset Button Logic
resetBtn.addEventListener('click', () => {
    // Reset state to defaults
    mibiAvatarState = {
        eyes: MIBI_ASSETS.eyes[0],
        mouths: MIBI_ASSETS.mouths[0],
        hats: '',
        bgColor: '#3B82F6',
        size: 100,
        rotation: 0,
        offsetX: 0,
        offsetY: 0
    };
    // Reset Sliders UI
    sizeSlider.value = 100;
    rotationSlider.value = 0;
    
    updateMibiPreview();
    // Refresh current grid to show cleared selection
    renderMacGrid(currentTab);
});

} // End setupMacMenuListeners

        // --- Core Functions ---

        async function updateProfilePicture(file, dataUrl, mode = 'custom') {
            const userId = auth.currentUser.uid;
            const storageRef = ref(storage, `profile_pictures/${userId}`);
            
            showLoading("Updating profile picture...");
            
            try {
                let downloadURL = dataUrl;

                if (mode === 'custom' && file) {
                    await uploadBytes(storageRef, file);
                    downloadURL = await getDownloadURL(storageRef);
                } else if (mode === 'letter' || mode === 'mibi') {
                    // For generated avatars, upload the data URL to storage
                    // to ensure consistency and caching
                    await uploadString(storageRef, dataUrl, 'data_url');
                    downloadURL = await getDownloadURL(storageRef);
                } else if (mode === 'google') {
                    downloadURL = auth.currentUser.photoURL; // Use Google's URL directly
                }

                await updateDoc(getUserDocRef(userId), {
                    profilePicture: downloadURL,
                    pfpMode: mode
                });
                
                // Update global state immediately for UI responsiveness
                if (window.currentUser) {
                    window.currentUser.profilePicture = downloadURL;
                    window.currentUser.pfpMode = mode;
                }
                
                // Refresh to show changes
                showMessage(document.getElementById('pfpMessage'), 'Profile picture updated successfully!', 'success');
                // Force a reload of the image elements if needed, or just reload page
                setTimeout(() => location.reload(), 1000); 

            } catch (error) {
                console.error("Error updating PFP:", error);
                showMessage(document.getElementById('pfpMessage'), `Failed to update profile picture: ${error.message}`);
            } finally {
                hideLoading();
            }
        }

        function createLetterAvatar(letter, color) {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#' + color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = 'bold 100px sans-serif';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter.toUpperCase(), canvas.width / 2, canvas.height / 2);

            return canvas.toDataURL('image/png');
        }

        // --- Core Functions ---

        async function updateProfilePicture(file, dataUrl, mode = 'custom') {
            const userId = auth.currentUser.uid;
            const storageRef = ref(storage, `profile_pictures/${userId}`);
            
            showLoading("Updating profile picture...");
            
            try {
                let downloadURL = dataUrl;

                if (mode === 'custom' && file) {
                    await uploadBytes(storageRef, file);
                    downloadURL = await getDownloadURL(storageRef);
                } else if (mode === 'letter' || mode === 'mibi') {
                    // For generated avatars, upload the data URL to storage
                    // to ensure consistency and caching
                    await uploadString(storageRef, dataUrl, 'data_url');
                    downloadURL = await getDownloadURL(storageRef);
                } else if (mode === 'google') {
                    downloadURL = auth.currentUser.photoURL; // Use Google's URL directly
                }

                await updateDoc(getUserDocRef(userId), {
                    profilePicture: downloadURL,
                    pfpMode: mode
                });
                
                // Update global state immediately for UI responsiveness
                if (window.currentUser) {
                    window.currentUser.profilePicture = downloadURL;
                    window.currentUser.pfpMode = mode;
                }
                
                // Refresh to show changes
                showMessage(document.getElementById('pfpMessage'), 'Profile picture updated successfully!', 'success');
                // Force a reload of the image elements if needed, or just reload page
                setTimeout(() => location.reload(), 1000); 

            } catch (error) {
                console.error("Error updating PFP:", error);
                showMessage(document.getElementById('pfpMessage'), `Failed to update profile picture: ${error.message}`);
            } finally {
                hideLoading();
            }
        }

        function createLetterAvatar(letter, color) {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#' + color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = 'bold 100px sans-serif';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter.toUpperCase(), canvas.width / 2, canvas.height / 2);

            return canvas.toDataURL('image/png');
        }

        // --- Tab Switching Logic ---
        function switchTab(tabId) {
            // Update Sidebar UI
            sidebarTabs.forEach(tab => {
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });

            // Render Content
            mainView.innerHTML = ''; // Clear current content
            
            // Re-fetch current user data to ensure latest state (e.g. for provider linking)
            const user = auth.currentUser;
            
            switch (tabId) {
                case 'general':
                    // Need to calculate stats dynamically or pass them if available
                    // For now, placeholders or simple logic
                    // We need to fetch the user doc again if we want real-time stats
                    // But we can use the globally loaded 'currentUser' var if available from init
                    // Assuming 'currentUser' is populated by init
                    
                    if (currentUser) {
                        const now = new Date();
                        const currentMonth = now.toISOString().slice(0, 7);
                        const changes = currentUser.usernameChanges && currentUser.usernameChanges[currentMonth] ? currentUser.usernameChanges[currentMonth] : 0;
                        const remaining = MAX_CHANGES - changes;
                        const monthName = now.toLocaleString('default', { month: 'long' });
                        const isEmail = user.providerData.some(p => p.providerId === 'password');
                        
                        mainView.innerHTML = getGeneralContent(
                            currentUser.username, 
                            remaining, 
                            changes, 
                            monthName, 
                            isEmail,
                            user.providerData
                        );
                        
                        // Attach Event Listeners for General Tab
                        attachGeneralListeners();
                    } else {
                        mainView.innerHTML = '<p class="text-white">Loading user data...</p>';
                    }
                    break;
                case 'privacy':
                    mainView.innerHTML = getPrivacyContent();
                    attachPrivacyListeners();
                    break;
                case 'personalization':
                    mainView.innerHTML = getPersonalizationContent();
                    attachPersonalizationListeners();
                    break;
                case 'data':
                    mainView.innerHTML = getDataManagementContent();
                    attachDataListeners();
                    break;
                case 'management':
                    mainView.innerHTML = getManagementContent();
                    loadManagementTab();
                    break;
                case 'about':
                    mainView.innerHTML = getAboutContent();
                    break;
                default:
                    mainView.innerHTML = getComingSoonContent(tabContent[tabId].title);
            }
        }

        function attachGeneralListeners() {
            const editBtn = document.getElementById('enterEditModeBtn');
            const cancelBtn = document.getElementById('cancelEditBtn');
            const applyBtn = document.getElementById('applyUsernameBtn');
            const viewMode = document.getElementById('viewMode');
            const editMode = document.getElementById('editMode');
            const input = document.getElementById('newUsernameInput');
            const messageArea = document.getElementById('usernameChangeMessage');
            
            // Password Elements
            const applyPassBtn = document.getElementById('applyPasswordBtn');
            
            // Provider Linking Elements
            const linkBtns = document.querySelectorAll('button[data-action="link"]');
            const unlinkBtns = document.querySelectorAll('button[data-action="unlink"]');
            const setPrimaryBtns = document.querySelectorAll('button[data-action="set-primary"]');
            const reauthBtn = document.getElementById('reauthenticateBtn');
            const finalDeleteBtn = document.getElementById('finalDeleteBtn');
            const deleteConfirmInput = document.getElementById('deleteConfirmText');
            const deletePassInput = document.getElementById('deletePasswordInput');

            // --- Username Logic ---
            if (editBtn) {
                editBtn.onclick = () => {
                    viewMode.classList.add('hidden');
                    editMode.classList.remove('hidden');
                    editMode.style.display = 'flex';
                    input.focus();
                };
            }

            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    viewMode.classList.remove('hidden');
                    editMode.classList.add('hidden');
                    editMode.style.display = 'none';
                    input.value = currentUser.username;
                    messageArea.textContent = '';
                    // Reset validation display
                    document.getElementById('charCount').className = 'font-semibold text-gray-400';
                };
            }

            if (input) {
                input.oninput = async () => {
                    const val = input.value;
                    const len = val.length;
                    
                    document.getElementById('charCount').textContent = len;
                    
                    // Basic Validation
                    const isValidLength = len >= MIN_LENGTH && len <= MAX_LENGTH;
                    const isValidChars = /^[a-zA-Z0-9_.-]+$/.test(val);
                    const isChanged = val !== currentUser.username;
                    
                    // Profanity Check (Debounced ideally, but direct for now)
                    // We'll check profanity only on submit to save API calls
                    
                    // Visual Feedback
                    const charCountEl = document.getElementById('charCount');
                    if (isValidLength) charCountEl.className = 'font-semibold text-green-400';
                    else charCountEl.className = 'font-semibold text-red-400';

                    if (isValidLength && isValidChars && isChanged) {
                        applyBtn.disabled = false;
                        // Check availability asynchronously
                        const taken = await isUsernameTaken(val);
                        if (taken) {
                            showMessage(messageArea, 'Username is taken.', 'error');
                            applyBtn.disabled = true;
                        } else {
                            messageArea.innerHTML = ''; // Clear error
                        }
                    } else {
                        applyBtn.disabled = true;
                    }
                };
            }

            if (applyBtn) {
                applyBtn.onclick = async () => {
                    const newName = input.value;
                    showLoading("Updating username...");
                    
                    // Profanity Check
                    const isProfane = await checkProfanity(newName);
                    if (isProfane) {
                        hideLoading();
                        showMessage(messageArea, 'Username contains disallowed language.', 'error');
                        return;
                    }

                    try {
                        const now = new Date();
                        const currentMonth = now.toISOString().slice(0, 7);
                        let changesMap = currentUser.usernameChanges || {};
                        let monthlyCount = changesMap[currentMonth] || 0;

                        if (monthlyCount >= MAX_CHANGES) {
                            throw new Error("Maximum username changes reached for this month.");
                        }

                        // Update Firestore
                        changesMap[currentMonth] = monthlyCount + 1;
                        
                        await updateDoc(getUserDocRef(currentUser.uid), {
                            username: newName,
                            usernameChanges: changesMap,
                            usernameLower: newName.toLowerCase() // Useful for searching
                        });
                        
                        // Update Local State
                        currentUser.username = newName;
                        currentUser.usernameChanges = changesMap;
                        
                        hideLoading();
                        showMessage(messageArea, 'Username updated successfully!', 'success');
                        
                        // Refresh UI after delay
                        setTimeout(refreshGeneralTab, 1000);

                    } catch (error) {
                        hideLoading();
                        console.error(error);
                        showMessage(messageArea, error.message);
                    }
                };
            }
            
            // --- Password Change Logic ---
            if (applyPassBtn) {
                const curP = document.getElementById('currentPasswordInput');
                const newP = document.getElementById('newPasswordInput');
                const confP = document.getElementById('confirmPasswordInput');
                const pMsg = document.getElementById('passwordMessage');
                
                const validatePass = () => {
                    const v1 = newP.value;
                    const v2 = confP.value;
                    const v0 = curP.value;
                    
                    if (v0 && v1 && v2 && v1.length >= 6 && v1 === v2) {
                        applyPassBtn.disabled = false;
                    } else {
                        applyPassBtn.disabled = true;
                    }
                };
                
                [curP, newP, confP].forEach(el => el.addEventListener('input', validatePass));
                
                applyPassBtn.onclick = async () => {
                    showLoading("Updating password...");
                    const cred = EmailAuthProvider.credential(auth.currentUser.email, curP.value);
                    
                    try {
                        await reauthenticateWithCredential(auth.currentUser, cred);
                        await updatePassword(auth.currentUser, newP.value);
                        hideLoading();
                        showMessage(pMsg, "Password updated successfully!", "success");
                        // Clear inputs
                        curP.value = ''; newP.value = ''; confP.value = ''; applyPassBtn.disabled = true;
                    } catch (error) {
                        hideLoading();
                        showMessage(pMsg, "Failed: " + error.message, "error");
                    }
                };
            }
            
            // --- Provider Linking Logic ---
            linkBtns.forEach(btn => {
                btn.onclick = async () => {
                    const providerId = btn.dataset.providerId;
                    const provider = PROVIDER_CONFIG[providerId].instance();
                    
                    try {
                        await linkWithPopup(auth.currentUser, provider);
                        refreshGeneralTab(); // Refresh to update list
                    } catch (error) {
                        console.error("Link Error", error);
                        alert("Failed to link provider: " + error.message);
                    }
                };
            });
            
            unlinkBtns.forEach(btn => {
                btn.onclick = async () => {
                    const providerId = btn.dataset.providerId;
                    // Double check we are not unlinking the only provider
                    if (auth.currentUser.providerData.length <= 1) {
                        alert("Cannot unlink the only login method.");
                        return;
                    }
                    
                    if (!confirm(`Unlink ${PROVIDER_CONFIG[providerId].name}?`)) return;
                    
                    try {
                        await unlink(auth.currentUser, providerId);
                        refreshGeneralTab();
                    } catch (error) {
                        console.error("Unlink Error", error);
                        alert("Failed to unlink: " + error.message);
                    }
                };
            });
            
            // --- Set Primary Provider Logic ---
            setPrimaryBtns.forEach(btn => {
                btn.onclick = async () => {
                    const providerId = btn.dataset.providerId;
                    // Logic: We essentially just re-sort visually in most apps, but 
                    // since Firebase doesn't strictly have a "primary", we can just 
                    // store a preference in Firestore if needed, or rely on the order in providerData array 
                    // (which is usually chronological).
                    // However, for this UI, we might just want to indicate *preferred* login.
                    // For "Delete Account" logic, we pick providerData[0].
                    // Changing providerData order isn't directly supported via API easily without re-linking.
                    // Instead, let's just alert for now or implement a custom sorting in Firestore user doc.
                    
                    alert("To set this as primary, please unlink other providers and re-link them in order, or use this provider to log in next time.");
                };
            });
            
            // --- Account Deletion Logic ---
            if (deleteConfirmInput) {
                deleteConfirmInput.oninput = () => {
                    if (deleteConfirmInput.value.toLowerCase() === "delete my account") {
                        // If password input exists (for email users), check it too? 
                        // Actually, re-auth is handled separately or via credential.
                        // If it's password user, we need them to enter current password.
                        if (deletePassInput) {
                            if (deletePassInput.value) finalDeleteBtn.disabled = false;
                            else finalDeleteBtn.disabled = true;
                        } else {
                            finalDeleteBtn.disabled = false;
                        }
                    } else {
                        finalDeleteBtn.disabled = true;
                    }
                };
                
                if (deletePassInput) {
                    deletePassInput.oninput = deleteConfirmInput.oninput;
                }
            }
            
            if (reauthBtn && !finalDeleteBtn) { // Only for social providers
                reauthBtn.onclick = async () => {
                    const providerId = reauthBtn.dataset.providerId;
                    const provider = PROVIDER_CONFIG[providerId].instance();
                    try {
                        await reauthenticateWithPopup(auth.currentUser, provider);
                        // Hide reauth button, show delete button and input
                        reauthBtn.classList.add('hidden');
                        
                        // Create the confirm input dynamically if not exists (for social users)
                        // Or just show the hidden button?
                        // Let's replace the content container
                        const container = document.getElementById('deletionSection');
                        container.innerHTML = `
                            <p class="text-sm font-light text-red-300 mb-3">
                                Authentication confirmed. This is your last chance.
                            </p>
                            <label class="block text-red-300 text-sm font-light mb-2">Type "Delete My Account"</label>
                            <input type="text" id="finalDeleteConfirm" class="input-text-style w-full bg-red-900/20 border-red-700/50">
                            <div class="flex justify-end pt-4">
                                <button id="realDeleteBtn" class="btn-toolbar-style btn-primary-override-danger w-48" disabled>
                                     <i class="fa-solid fa-trash mr-1"></i> Confirm Delete
                                </button>
                            </div>
                        `;
                        
                        const inp = document.getElementById('finalDeleteConfirm');
                        const btn = document.getElementById('realDeleteBtn');
                        inp.oninput = () => { btn.disabled = (inp.value.toLowerCase() !== "delete my account"); };
                        
                        btn.onclick = performAccountDeletion;
                        
                    } catch (error) {
                        alert("Re-authentication failed: " + error.message);
                    }
                };
            } else if (finalDeleteBtn && !reauthBtn) { // Password user path
                finalDeleteBtn.onclick = async () => {
                    const pass = deletePassInput.value;
                    const cred = EmailAuthProvider.credential(auth.currentUser.email, pass);
                    try {
                        await reauthenticateWithCredential(auth.currentUser, cred);
                        await performAccountDeletion();
                    } catch (error) {
                        alert("Password incorrect or deletion failed: " + error.message);
                    }
                };
            }
        }
        
        async function performAccountDeletion() {
            showLoading("Deleting Account...");
            try {
                const uid = auth.currentUser.uid;
                // Delete Firestore Data
                await deleteDoc(doc(db, 'users', uid));
                // Delete Storage (Profile Pic) - Optional/Try-Catch
                try {
                    await deleteObject(ref(storage, `profile_pictures/${uid}`));
                } catch(e) { /* ignore if not exists */ }
                
                // Delete Auth
                await deleteUser(auth.currentUser);
                
                hideLoading();
                alert("Account deleted. Goodbye.");
                window.location.href = "../index.html";
            } catch (error) {
                hideLoading();
                console.error("Delete Error", error);
                alert("Critical error deleting account: " + error.message);
            }
        }

        function attachPrivacyListeners() {
            // Panic Key Logic
            const applyPanicBtn = document.getElementById('applyPanicKeyBtn');
            const panicMsg = document.getElementById('panicKeyMessage');
            const panicInputs = document.querySelectorAll('.panic-key-input');
            
            // Load existing
            getPanicKeySettings().then(settings => {
                settings.forEach((value, key) => {
                    const inputKey = document.getElementById(`panicKey${key}`);
                    const inputUrl = document.getElementById(`panicUrl${key}`);
                    if (inputKey && inputUrl) {
                        inputKey.value = value.key;
                        inputUrl.value = value.url;
                    }
                });
            });

            // Input handlers for single key
            panicInputs.forEach(input => {
                input.addEventListener('keydown', (e) => {
                    e.preventDefault();
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        input.value = '';
                    } else if (e.key.length === 1) {
                        input.value = e.key.toUpperCase();
                    }
                });
            });

            applyPanicBtn.onclick = async () => {
                const settingsToSave = [];
                for (let i = 1; i <= 3; i++) {
                    const key = document.getElementById(`panicKey${i}`).value;
                    const url = document.getElementById(`panicUrl${i}`).value;
                    if (key && url) {
                        settingsToSave.push({ id: i, key: key.toLowerCase(), url: url });
                    }
                }
                
                try {
                    await savePanicKeySettings(settingsToSave);
                    showMessage(panicMsg, "Panic keys updated successfully!", "success");
                    // Update global listener via broadcast or reload? 
                    // For now, the panic key script reads from DB on keydown so it should be instant.
                } catch (e) {
                    showMessage(panicMsg, "Error saving keys.", "error");
                }
            };
            
            // --- URL Changer Logic ---
            const modeSelect = document.getElementById('tabDisguiseMode');
            const presetGroup = document.getElementById('tabDisguisePresetGroup');
            const customGroup = document.getElementById('tabDisguiseCustomGroup');
            const presetSelect = document.getElementById('tabDisguisePreset');
            const applyUrlBtn = document.getElementById('applyUrlChangerBtn');
            const urlMsg = document.getElementById('urlChangerMessage');
            const fetchFavBtn = document.getElementById('fetchFaviconBtn');
            const faviconInput = document.getElementById('faviconFetchInput');
            const previewImg = document.querySelector('#favicon-fetch-preview-container img');

            // Load saved settings
            const savedUrlSettings = getSavedUrlChangerSetting();
            modeSelect.value = savedUrlSettings.type || 'none';
            if (savedUrlSettings.type === 'preset') presetSelect.value = savedUrlSettings.id;
            if (savedUrlSettings.type === 'custom') {
                document.getElementById('customTabTitle').value = savedUrlSettings.title || '';
                faviconInput.value = ''; // We don't store the source url easily, but maybe we should?
                if (savedUrlSettings.favicon) {
                    previewImg.src = savedUrlSettings.favicon;
                    previewImg.style.display = 'block';
                }
            }

            const updateVisibility = () => {
                const val = modeSelect.value;
                presetGroup.classList.toggle('hidden', val !== 'preset');
                customGroup.classList.toggle('hidden', val !== 'custom');
            };
            
            modeSelect.addEventListener('change', updateVisibility);
            updateVisibility();

            fetchFavBtn.onclick = () => {
                const domain = faviconInput.value;
                if (!domain) return;
                const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                previewImg.src = url;
                previewImg.style.display = 'block';
            };

            applyUrlBtn.onclick = () => {
                const mode = modeSelect.value;
                let settings = { type: mode };
                
                if (mode === 'preset') {
                    const presetId = presetSelect.value;
                    const preset = urlChangerPresets.find(p => p.id === presetId);
                    if (preset) {
                        settings = { type: 'preset', ...preset };
                    }
                } else if (mode === 'custom') {
                    const title = document.getElementById('customTabTitle').value;
                    const favSrc = previewImg.src; // Use the fetched source
                    settings = { type: 'custom', title: title, favicon: favSrc };
                }
                
                if (saveUrlChangerSetting(settings)) {
                    showMessage(urlMsg, "Tab settings applied! Refresh to see.", "success");
                    // Trigger update immediately if possible
                    if (window.updateTabDisguise) window.updateTabDisguise();
                } else {
                    showMessage(urlMsg, "Error saving settings.", "error");
                }
            };
        }
        
        function attachPersonalizationListeners() {
            // PFP Mode Logic
            const modeBtns = document.querySelectorAll('.pfp-mode-btn');
            const letterSettings = document.getElementById('pfpLetterSettings');
            const mibiSettings = document.getElementById('pfpMibiSettings');
            const customSettings = document.getElementById('pfpCustomSettings');
            const pfpMessage = document.getElementById('pfpMessage');
            
            // Helper to toggle visibility
            const updatePfpUI = (mode) => {
                modeBtns.forEach(btn => {
                    if (btn.dataset.mode === mode) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
                
                letterSettings.classList.add('hidden');
                mibiSettings.classList.add('hidden');
                customSettings.classList.add('hidden');
                
                if (mode === 'letter') letterSettings.classList.remove('hidden');
                if (mode === 'mibi') mibiSettings.classList.remove('hidden');
                if (mode === 'custom') customSettings.classList.remove('hidden');
                
                if (mode === 'google') {
                    // Immediate update for Google mode since no settings
                    updateProfilePicture(null, null, 'google');
                }
            };
            
            modeBtns.forEach(btn => {
                btn.onclick = () => updatePfpUI(btn.dataset.mode);
            });
            
            // Load current mode
            if (currentUser && currentUser.pfpMode) {
                updatePfpUI(currentUser.pfpMode);
            }

            // --- Letter Avatar Logic ---
            const colorGrid = document.getElementById('pfp-color-grid');
            let selectedColor = letterColors[0];
            
            letterColors.forEach(color => {
                const div = document.createElement('div');
                div.className = 'w-8 h-8 rounded-full cursor-pointer border-2 border-transparent hover:scale-110 transition-transform';
                div.style.backgroundColor = '#' + color;
                div.onclick = () => {
                    document.querySelectorAll('#pfp-color-grid div').forEach(d => d.style.borderColor = 'transparent');
                    div.style.borderColor = 'white';
                    selectedColor = color;
                };
                colorGrid.appendChild(div);
            });
            
            document.getElementById('save-letter-pfp-btn').onclick = () => {
                const text = document.getElementById('pfp-custom-text').value || currentUser.username.charAt(0);
                const dataUrl = createLetterAvatar(text, selectedColor);
                updateProfilePicture(null, dataUrl, 'letter');
            };
            
            // --- Custom Upload Logic with Cropper ---
            const uploadBtn = document.getElementById('uploadPfpBtn');
            const fileInput = document.getElementById('pfpFileInput');
            const cropperModal = document.getElementById('cropperModal');
            const cropperCanvas = document.getElementById('cropperCanvas');
            const submitCropBtn = document.getElementById('submitCropBtn');
            const cancelCropBtn = document.getElementById('cancelCropBtn');
            
            let cropperImage = null;
            let cropState = { x: 0, y: 0, scale: 1 };
            let isDragging = false;
            let dragStart = { x: 0, y: 0 };
            
            uploadBtn.onclick = () => fileInput.click();
            
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (file.size > 2 * 1024 * 1024) {
                    alert("File too large (Max 2MB)");
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (evt) => {
                    cropperImage = new Image();
                    cropperImage.onload = () => {
                        initCropper();
                    };
                    cropperImage.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            };
            
            function initCropper() {
                cropperModal.style.display = 'flex';
                // Reset state
                cropState = { x: 0, y: 0, scale: 1 };
                
                // Initial draw
                requestAnimationFrame(drawCropper);
            }
            
            function drawCropper() {
                if (!cropperImage) return;
                
                // Set canvas size (fixed viewport)
                const size = 400;
                cropperCanvas.width = size;
                cropperCanvas.height = size;
                
                const ctx = cropperCanvas.getContext('2d');
                ctx.clearRect(0, 0, size, size);
                
                // Calculate dimensions to fit/cover
                // We want to simulate a "window" looking onto the image
                // The crop is always the center square of the canvas view
                
                ctx.save();
                ctx.translate(size/2 + cropState.x, size/2 + cropState.y);
                ctx.scale(cropState.scale, cropState.scale);
                ctx.drawImage(cropperImage, -cropperImage.width/2, -cropperImage.height/2);
                ctx.restore();
                
                // Draw Overlay (Circle or Square mask guide)
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.beginPath();
                // 300x300 Selection box in center
                const boxSize = 300;
                ctx.rect((size-boxSize)/2, (size-boxSize)/2, boxSize, boxSize);
                ctx.stroke();
                
                // Dim area outside selection
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.rect(0,0,size,size);
                ctx.rect((size-boxSize)/2, (size-boxSize)/2, boxSize, boxSize);
                ctx.clip("evenodd");
                ctx.fillRect(0,0,size,size);
            }
            
            // Cropper Interactions
            cropperCanvas.onmousedown = (e) => {
                isDragging = true;
                dragStart = { x: e.clientX, y: e.clientY };
            };
            
            window.onmousemove = (e) => {
                if (isDragging) {
                    const dx = e.clientX - dragStart.x;
                    const dy = e.clientY - dragStart.y;
                    cropState.x += dx;
                    cropState.y += dy;
                    dragStart = { x: e.clientX, y: e.clientY };
                    requestAnimationFrame(drawCropper);
                }
            };
            
            window.onmouseup = () => isDragging = false;
            
            cropperCanvas.onwheel = (e) => {
                e.preventDefault();
                const zoomSpeed = 0.1;
                if (e.deltaY < 0) cropState.scale += zoomSpeed;
                else cropState.scale = Math.max(0.1, cropState.scale - zoomSpeed);
                requestAnimationFrame(drawCropper);
            };
            
            cancelCropBtn.onclick = () => {
                cropperModal.style.display = 'none';
                fileInput.value = '';
            };
            
            submitCropBtn.onclick = () => {
                // Generate final cropped image
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = 300;
                finalCanvas.height = 300;
                const ctx = finalCanvas.getContext('2d');
                
                // Replicate the draw logic but centered and clipped
                // This implies applying the inverse of the view transform relative to the crop box
                
                // Simply drawing the view canvas cropped center is easiest but low res
                // Better: Draw image again with transforms adjusted
                
                ctx.translate(150 + cropState.x, 150 + cropState.y);
                ctx.scale(cropState.scale, cropState.scale);
                ctx.drawImage(cropperImage, -cropperImage.width/2, -cropperImage.height/2);
                
                const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
                
                // Upload
                // We pass null for file because we have a dataUrl now
                updateProfilePicture(null, dataUrl, 'custom');
                
                cropperModal.style.display = 'none';
                fileInput.value = '';
            };
            
            // --- Theme Picker Logic ---
            const themeContainer = document.getElementById('theme-picker-container');
            const themeMessage = document.getElementById('themeMessage');
            
            // Fetch Themes
            fetch('../themes.json')
                .then(res => res.json())
                .then(themes => {
                    themeContainer.innerHTML = '';
                    themes.forEach(theme => {
                        const btn = document.createElement('div');
                        // MODIFICATION: Use new styling
                        btn.className = 'theme-button flex flex-col items-center justify-between gap-2 h-full';
                        
                        // Set inline styles for theme preview
                        // We use the theme's own colors to style its button
                        const activeBorder = theme.colors['--tab-active-border'] || '#4f46e5';
                        const activeBg = theme.colors['--tab-active-bg'] || 'rgba(79, 70, 229, 0.1)';
                        
                        btn.style.borderColor = '#333'; // Default border
                        btn.style.setProperty('--tab-active-border', activeBorder);
                        btn.style.setProperty('--tab-active-hover-border', activeBorder); // Simplify hover
                        btn.style.setProperty('--tab-active-shadow', activeBg);
                        
                        // Preview content
                        const preview = document.createElement('div');
                        preview.className = 'w-full h-12 rounded-md mb-2 flex items-center justify-center';
                        preview.style.backgroundColor = theme.colors['--menu-bg'];
                        preview.style.border = `1px solid ${theme.colors['--menu-border']}`;
                        
                        // Fake active tab in preview
                        const fakeTab = document.createElement('div');
                        fakeTab.className = 'w-3/4 h-6 rounded-md';
                        fakeTab.style.backgroundColor = activeBg;
                        fakeTab.style.border = `1px solid ${activeBorder}`;
                        preview.appendChild(fakeTab);
                        
                        const name = document.createElement('span');
                        name.className = 'theme-button-name text-sm';
                        name.textContent = theme.name;
                        
                        btn.appendChild(preview);
                        btn.appendChild(name);
                        
                        btn.onclick = () => {
                            // Apply Theme
                            applyTheme(theme);
                            localStorage.setItem(THEME_STORAGE_KEY, theme.id);
                            
                            // Visual Selection
                            document.querySelectorAll('.theme-button').forEach(b => {
                                b.classList.remove('active');
                                b.style.borderColor = '#333';
                            });
                            btn.classList.add('active');
                            btn.style.borderColor = activeBorder;
                            
                            showMessage(themeMessage, `Theme applied: ${theme.name}`, 'success');
                        };
                        
                        // Check if active
                        if (localStorage.getItem(THEME_STORAGE_KEY) === theme.id) {
                            btn.classList.add('active');
                            btn.style.borderColor = activeBorder;
                        }
                        
                        themeContainer.appendChild(btn);
                    });
                });
                
            setupMacMenuListeners(); // Initialize MAC listeners
        }
        
        function applyTheme(theme) {
            const root = document.documentElement;
            for (const [key, value] of Object.entries(theme.colors)) {
                root.style.setProperty(key, value);
            }
        }
        
        function attachDataListeners() {
            document.getElementById('exportDataBtn').onclick = downloadAllSaves;
            document.getElementById('importDataBtn').onclick = handleFileUpload;
        }

        // --- Main Initialization ---
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch full user data including username
                const userDoc = await getDoc(getUserDocRef(user.uid));
                if (userDoc.exists()) {
                    currentUser = { uid: user.uid, ...userDoc.data() };
                } else {
                    // Fallback if doc doesn't exist yet (shouldn't happen in normal flow)
                    currentUser = { uid: user.uid, email: user.email, username: user.displayName || 'User' };
                }
                
                // --- NEW: Check Admin Status ---
                try {
                    const adminCheck = await checkAdminStatus(auth, db);
                    isUserAdmin = adminCheck.isAdmin;
                    // Show management tab if admin
                    if (isUserAdmin) {
                        document.querySelector('.settings-tab[data-tab="management"]').classList.remove('hidden');
                    }
                } catch (e) { console.error("Admin check failed", e); }

                // Load initial tab
                switchTab('general');
            } else {
                window.location.href = '../index.html';
            }
        });

        // Tab Navigation
        sidebarTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.dataset.tab);
            });
        });

