
(function() {
    // --- Styles ---
    const style = document.createElement('style');
    style.textContent = `
        #schedule-notification {
            position: fixed;
            bottom: 1rem;
            left: 1rem;
            z-index: 9999;
            background-color: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid #252525;
            border-radius: 1.5rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            padding: 0.5rem 0.5rem 0.5rem 1.25rem;
            color: #e5e7eb;
            font-family: 'Geist', sans-serif;
            gap: 1rem;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;
            transform: translateY(150%) scale(0.95);
            opacity: 0;
            max-width: 400px;
            pointer-events: auto;
        }

        #schedule-notification.visible {
            transform: translateY(0) scale(1);
            opacity: 1;
        }

        .sn-icon {
            color: #4f46e5;
            font-size: 1.2rem;
        }

        .sn-content {
            display: flex;
            align-items: baseline;
            gap: 0.75rem;
            white-space: nowrap;
        }

        .sn-next {
            font-style: italic;
            color: #9ca3af;
            font-size: 0.9rem;
        }

        .sn-countdown {
            font-weight: 500;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            font-size: 1.1rem;
            color: #fff;
        }

        .sn-close {
            background-color: rgba(79, 70, 229, 0.1);
            color: #4f46e5;
            border: 1px solid transparent;
            width: 2.5rem;
            height: 2.5rem;
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            margin-left: 0.5rem;
            flex-shrink: 0;
        }

        .sn-close:hover {
            background-color: rgba(79, 70, 229, 0.2);
            color: #6366f1;
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);

    // --- State ---
    let notificationEl = null;
    let scheduleData = [];
    let checkInterval = null;
    let countdownInterval = null;
    let activeNotificationPeriodId = null; // ID of the period currently triggering the notification
    let dismissedPeriodId = null; // ID of the period the user explicitly closed

    // --- Logic ---
    function loadSchedule() {
        try {
            const s = localStorage.getItem('4sp_user_schedule');
            scheduleData = s ? JSON.parse(s) : [];
        } catch (e) {
            console.error("Failed to load schedule data", e);
        }
    }

    // Listen for updates from the schedule page
    window.addEventListener('schedule-updated', loadSchedule);

    function createNotification() {
        if (document.getElementById('schedule-notification')) return;

        const el = document.createElement('div');
        el.id = 'schedule-notification';
        el.innerHTML = `
            <i class="fa-solid fa-clock sn-icon"></i>
            <div class="sn-content">
                <span class="sn-next" id="sn-next-text">Next: ...</span>
                <span class="sn-countdown" id="sn-timer">00:00</span>
            </div>
            <button class="sn-close" id="sn-close-btn"><i class="fa-solid fa-xmark"></i></button>
        `;
        document.body.appendChild(el);
        
        document.getElementById('sn-close-btn').addEventListener('click', hideNotification);
        notificationEl = el;
    }

    function showNotification(nextClass, secondsRemaining, periodId) {
        if (!notificationEl) createNotification();
        
        // If the user dismissed THIS period, don't show it.
        if (dismissedPeriodId === periodId) return;

        const nextText = document.getElementById('sn-next-text');
        const timerText = document.getElementById('sn-timer');
        
        nextText.textContent = `Next: ${nextClass}`;
        timerText.textContent = formatTime(secondsRemaining);
        
        requestAnimationFrame(() => {
            notificationEl.classList.add('visible');
        });
    }

    function hideNotification() {
        if (notificationEl) {
            notificationEl.classList.remove('visible');
            // Remember that we dismissed this specific period instance
            dismissedPeriodId = activeNotificationPeriodId;
        }
    }

    function formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function checkTime() {
        const now = new Date();
        
        // Check only regular schedule
        const allPeriods = scheduleData;

        let activePeriodFound = false;

        for (let i = 0; i < allPeriods.length; i++) {
            const p = allPeriods[i];
            if (!p.end) continue;

            const [endH, endM] = p.end.split(':').map(Number);
            
            const periodEnd = new Date(now);
            periodEnd.setHours(endH, endM, 0, 0);

            const diff = periodEnd - now; // Milliseconds

            // 60000 ms = 1 minute. 
            // Trigger if between 0 and 60000ms.
            if (diff > 0 && diff <= 60000) {
                // Find next period
                const nextP = allPeriods.find(np => {
                    const [startH, startM] = np.start.split(':').map(Number);
                    return (startH > endH) || (startH === endH && startM >= endM);
                });
                
                const nextTitle = nextP ? nextP.title : "Freedom";

                // Update active tracking
                activeNotificationPeriodId = p.id;

                showNotification(nextTitle, diff / 1000, p.id);
                activePeriodFound = true;
                break; // Only show for one
            }
        }

        if (!activePeriodFound && notificationEl && notificationEl.classList.contains('visible')) {
            // If the time passed (diff <= 0), hide it automatically (not user dismissal)
            notificationEl.classList.remove('visible');
            activeNotificationPeriodId = null;
        }
    }

    // Init
    loadSchedule();
    // Run every second
    checkInterval = setInterval(checkTime, 1000);

})();
