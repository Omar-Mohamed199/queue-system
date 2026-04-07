const API_BASE = '/api/queue';

function formatTime(totalMinutes) {
    if (totalMinutes < 60) return `${totalMinutes} دقيقة`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} ساعة`;
    return `${hours} ساعة و ${minutes} دقيقة`;
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
            
            const targetQIndex = queues.findIndex(q => q.queueNumber === currentNumber);
            if (targetQIndex === -1) {
                if (isInitial) {
                    alert('الرقم غير موجود');
                    checkBtn.textContent = 'اعرض حالتي';
                    checkBtn.disabled = false;
                    queueInput.value = '';
                    currentNumber = null;
                } else {
                    // Queue deleted or not found anymore, reset screen
                    resetScreen();
                }
                return;
            }
            
            const targetQ = queues[targetQIndex];
            
            const storedTime = localStorage.getItem('avgTime') || 5;
            const avgTime = parseInt(storedTime, 10);
            
            let aheadCount = 0;
            let time = 0; // Total calculated time
            
            if (targetQ.status !== 'done' && targetQ.status !== 'working') {
                const now = Date.now();
                for (let i = 0; i < targetQIndex; i++) {
                    const qAhead = queues[i];
                    if (qAhead.status === 'working') {
                        aheadCount++;
                        let remaining = avgTime;
                        if (qAhead.startedAt) {
                            const diffMs = now - new Date(qAhead.startedAt).getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            remaining = Math.max(0, avgTime - diffMins);
                        }
                        time += remaining;
                    } else if (qAhead.status === 'waiting') {
                        aheadCount++;
                        time += avgTime;
                    }
                }
            }
            
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
            resAhead.textContent = targetQ.status === 'done' || targetQ.status === 'working' ? '0' : aheadCount;
            resTime.textContent = time > 0 ? formatTime(time) : 'جاهز';
            statusText.textContent = status;
            
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
        if(!numberInput) {
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
