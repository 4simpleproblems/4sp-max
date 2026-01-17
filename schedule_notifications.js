
(function() {
    // --- Styles ---
    const style = document.createElement('style');
    style.textContent = `
        #schedule-notification {
            position: fixed;
            bottom: 6rem; /* Above the soundboard bar which is at 1rem */
            right: 1rem;
            z-index: 9999;
            background-color: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid #4f46e5;
            border-radius: 1.5rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            padding: 0.75rem 1.25rem;
            color: white;
            font-family: 'Geist', sans-serif;
            gap: 1rem;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;
            transform: translateY(150%) scale(0.95);
            opacity: 0;
            max-width: 90vw;
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
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #ccc;
            width: 2rem;
            height: 2rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            margin-left: 0.5rem;
        }

        .sn-close:hover {
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
        }
    `;
    document.head.appendChild(style);

    // --- State ---
    let notificationEl = null;
    let scheduleData = [];
    let specialScheduleData = [];
    let checkInterval = null;
    let countdownInterval = null;
    let activeNotificationPeriodId = null;

    // --- Logic ---
    function loadSchedule() {
        try {
            const s = localStorage.getItem('4sp_user_schedule');
            const ss = localStorage.getItem('4sp_user_special_schedule');
            scheduleData = s ? JSON.parse(s) : [];
            specialScheduleData = ss ? JSON.parse(ss) : [];
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

    function showNotification(nextClass, secondsRemaining) {
        if (!notificationEl) createNotification();
        
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
            activeNotificationPeriodId = null; // Allow it to trigger again if condition met (though usually it won't until next period)
        }
    }

    function formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function getNextPeriod(currentIndex, allPeriods) {
        // Simple logic: next in list, or loop to first? Usually school days don't loop immediately.
        // Assuming sorted by time.
        if (currentIndex < allPeriods.length - 1) {
            return allPeriods[currentIndex + 1].title;
        }
        return "End of Day";
    }

    function checkTime() {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentSeconds = now.getSeconds();
        
        // Combine regular and special periods, prioritized?
        // For simplicity, treat them equally but check overlaps. 
        // Or just iterate all.
        const allPeriods = [...scheduleData, ...specialScheduleData];

        // We assume period.start/end are "HH:MM"
        // We need to check if we are 1 minute (or less) before end.
        
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
                // To do this accurately, we should probably sort periods by start time first
                // But simplified: find the period that starts after this one ends?
                // Or just use the array index if sorted.
                // Let's find a period that starts >= this period's end.
                
                const nextP = allPeriods.find(np => {
                    const [startH, startM] = np.start.split(':').map(Number);
                    return (startH > endH) || (startH === endH && startM >= endM);
                });
                
                const nextTitle = nextP ? nextP.title : "Freedom";

                showNotification(nextTitle, diff / 1000);
                activePeriodFound = true;
                activeNotificationPeriodId = p.id;
                break; // Only show for one
            }
        }

        if (!activePeriodFound && notificationEl && notificationEl.classList.contains('visible')) {
            // If the time passed (diff <= 0), hide it.
            // But we need to check if we are "in" a notification window.
            // If we just broke the loop without finding a match, it means no period is < 1 min away.
            // So hide.
            hideNotification();
        }
    }

    // Init
    loadSchedule();
    // Run every second
    checkInterval = setInterval(checkTime, 1000);

})();
