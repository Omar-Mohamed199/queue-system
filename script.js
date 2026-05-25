const API_BASE = '/api/queue';

function formatTime(totalMinutes) {
    if (totalMinutes < 60) return `${totalMinutes} دقيقة`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} ساعة`;
    return `${hours} ساعة و ${minutes} دقيقة`;
}

function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTo12Hour(timeStr) {
    if (!timeStr) return '-';
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
}

function calcEstimatedWait(targetQueue, allQueues, avgTime) {
    const targetDate = targetQueue.date;
    if (!targetDate) return 0;

    const targetTimeMin = timeToMinutes(targetQueue.time);
    if (targetTimeMin === null) return 0;

    // Get all active (not done) queues on the same date, sorted by order
    const activeQueues = allQueues
        .filter(q => q.date === targetDate && q.status !== 'done')
        .sort((a, b) => a.order - b.order);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    let simTime = 0;
    let baseTime = 0;
    
    if (targetDate === todayStr) {
        const currentMins = now.getHours() * 60 + now.getMinutes();
        simTime = currentMins;
        baseTime = currentMins;
    } else {
        const apptTimes = activeQueues
            .map(q => timeToMinutes(q.time))
            .filter(t => t !== null);
        const firstApptTime = apptTimes.length > 0 ? Math.min(...apptTimes) : 0;
        simTime = firstApptTime;
        baseTime = firstApptTime;
    }

    let targetStartSimTime = null;

    for (const q of activeQueues) {
        const apptTime = timeToMinutes(q.time);
        if (apptTime === null) continue;

        let serviceStart = 0;
        let serviceDuration = avgTime;

        if (q.status === 'working') {
            serviceStart = simTime;
            if (q.startedAt && targetDate === todayStr) {
                const elapsedMs = now.getTime() - new Date(q.startedAt).getTime();
                const elapsedMins = Math.floor(elapsedMs / 60000);
                serviceDuration = Math.max(0, avgTime - elapsedMins);
            } else {
                serviceDuration = avgTime;
            }
        } else {
            serviceStart = Math.max(simTime, apptTime);
        }

        if (q._id.toString() === targetQueue._id.toString()) {
            targetStartSimTime = serviceStart;
            break;
        }

        simTime = serviceStart + serviceDuration;
    }

    if (targetStartSimTime === null) {
        return 0;
    }

    const waitMinutes = targetStartSimTime - baseTime;
    return Math.max(0, waitMinutes);
}

function calcPeopleAhead(targetQueue, allQueues) {
    const targetDate = targetQueue.date;
    const targetIdx = allQueues.findIndex(q => q._id === targetQueue._id);
    if (targetIdx === -1) return 0;
    
    return allQueues.slice(0, targetIdx).filter(q => 
        q.date === targetDate && 
        q.status !== 'done'
    ).length;
}

document.addEventListener('DOMContentLoaded', () => {
    const inputSection = document.getElementById('input-section');
    const resultSection = document.getElementById('result-section');
    const checkBtn = document.getElementById('check-status-btn');
    const resetBtn = document.getElementById('reset-btn');
    const queueInput = document.getElementById('queue-number');

    const resNumber = document.getElementById('res-number');
    const resAhead = document.getElementById('res-ahead');
    const resTime = document.getElementById('res-time');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');

    const resName = document.getElementById('res-name');
    const resWeight = document.getElementById('res-weight');
    const resDate = document.getElementById('res-date');
    const resTimeDisplay = document.getElementById('res-time-display');

    let currentNumber = null;
    let pollInterval = null;

    async function fetchQueueData(isInitial) {
        if (!currentNumber) return;

        if (isInitial) {
            checkBtn.textContent = 'جاري التحميل...';
            checkBtn.disabled = true;
        }

        try {
            const res = await fetch(API_BASE);
            const queues = await res.json();

            const targetQ = queues.find(q => q.queueNumber === currentNumber);

            if (!targetQ) {
                if (isInitial) {
                    alert('الرقم غير موجود');
                    checkBtn.textContent = 'اعرض حالتي';
                    checkBtn.disabled = false;
                    queueInput.value = '';
                    currentNumber = null;
                } else {
                    resetScreen();
                }
                return;
            }

            const storedTime = localStorage.getItem('avgTime') || 5;
            const avgTime = parseInt(storedTime, 10);

            let aheadCount = 0;
            let time = 0;

            if (targetQ.status !== 'done' && targetQ.status !== 'working') {
                aheadCount = calcPeopleAhead(targetQ, queues);
                time = calcEstimatedWait(targetQ, queues, avgTime);
            }

            // ── Status display ────────────────────────────────────────────────
            let progress = 100;
            let status = '';

            if (targetQ.status === 'done') {
                status = 'دورك خلص!';
                progress = 100;
            } else if (targetQ.status === 'working') {
                status = 'دورك دلوقتي!';
                progress = 90;
            } else {
                if (aheadCount === 0) {
                    status = 'قربت';
                    progress = 75;
                } else if (aheadCount <= 3) {
                    status = 'استنى شوية';
                    progress = 50;
                } else {
                    status = 'لسه بدري';
                    progress = 20;
                }
            }

            resNumber.textContent = `#${currentNumber}`;
            resAhead.textContent = (targetQ.status === 'done' || targetQ.status === 'working') ? '0' : aheadCount;
            resTime.textContent = (targetQ.status === 'done' || targetQ.status === 'working') ? 'جاهز' : (time > 0 ? formatTime(time) : 'جاهز');
            statusText.textContent = status;

            // Render name, date, time display
            if (resName) {
                resName.textContent = targetQ.people.map(p => p.name).join(' - ');
            }
            if (resWeight) {
                resWeight.textContent = targetQ.weight || '-';
            }
            if (resDate) {
                let dateFormatted = '-';
                if (targetQ.date) {
                    const dateParts = targetQ.date.split('-');
                    dateFormatted = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : targetQ.date;
                }
                resDate.textContent = dateFormatted;
            }
            if (resTimeDisplay) {
                resTimeDisplay.textContent = formatTo12Hour(targetQ.time);
            }

            if (isInitial) {
                inputSection.classList.remove('active');
                inputSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
                resultSection.classList.add('active');

                setTimeout(() => {
                    progressBar.style.width = `${progress}%`;
                }, 100);
            } else {
                progressBar.style.width = `${progress}%`;
            }

        } catch (e) {
            console.error('Failed to connect to API', e);
            if (isInitial) {
                alert('يوجد خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً');
            }
        } finally {
            if (isInitial) {
                checkBtn.textContent = 'اعرض حالتي';
                checkBtn.disabled = false;
            }
        }
    }

    // Check Status
    checkBtn.addEventListener('click', () => {
        const numberInput = queueInput.value.trim();
        if (!numberInput) {
            queueInput.focus();
            return;
        }

        currentNumber = numberInput;
        fetchQueueData(true);

        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => fetchQueueData(false), 5000);
    });

    function resetScreen() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        currentNumber = null;
        queueInput.value = '';
        progressBar.style.width = '0%';

        resultSection.classList.remove('active');
        resultSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
        inputSection.classList.add('active');
    }

    resetBtn.addEventListener('click', resetScreen);

    queueInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkBtn.click();
        }
    });
});
