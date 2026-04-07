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
    
    // Check Status
    checkBtn.addEventListener('click', async () => {
        const numberInput = queueInput.value.trim();
        if(!numberInput) {
            queueInput.focus();
            return;
        }
        
        checkBtn.textContent = 'جاري التحميل...';
        checkBtn.disabled = true;

        try {
            const res = await fetch(API_BASE);
            const queues = await res.json();
            
            // Find user by Queue Number (note: db field is queueNumber)
            const targetQIndex = queues.findIndex(q => q.queueNumber === numberInput);
            if (targetQIndex === -1) {
                alert('الرقم غير موجود');
                checkBtn.textContent = 'اعرض حالتي';
                checkBtn.disabled = false;
                queueInput.value = '';
                return;
            }
            
            const targetQ = queues[targetQIndex];
            
            let aheadCount = 0;
            // With arrays coming natively from server based on created/sorting order correctly
            // Index 0 sits at the front.
            // People ahead are previous unserved instances
            if (targetQ.status !== 'done' && targetQ.status !== 'working') {
                for (let i = 0; i < targetQIndex; i++) {
                    if (queues[i].status !== 'done') {
                        aheadCount++;
                    }
                }
            }
            
            // User-side still keeps arbitrary time setting (or we could fetch if we created a settings API)
            // But preserving scope, localStorage for avgTime fits the instructions which heavily prioritized replacing table data
            const storedTime = localStorage.getItem('avgTime') || 5;
            const avgTime = parseInt(storedTime, 10);
            const time = aheadCount * avgTime; 
            
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
            
            resNumber.textContent = `#${numberInput}`;
            resAhead.textContent = targetQ.status === 'done' || targetQ.status === 'working' ? '0' : aheadCount;
            resTime.textContent = time > 0 ? formatTime(time) : 'جاهز';
            statusText.textContent = status;
            
            inputSection.classList.remove('active');
            inputSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
            resultSection.classList.add('active');
            
            setTimeout(() => {
                progressBar.style.width = `${progress}%`;
            }, 100);
            
        } catch (e) {
            console.error('Failed to connect to API', e);
            alert('يوجد خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً');
        } finally {
            checkBtn.textContent = 'اعرض حالتي';
            checkBtn.disabled = false;
        }
    });
    
    resetBtn.addEventListener('click', () => {
        queueInput.value = '';
        progressBar.style.width = '0%';
        
        resultSection.classList.remove('active');
        resultSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
        inputSection.classList.add('active');
    });
    
    queueInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkBtn.click();
        }
    });
});
