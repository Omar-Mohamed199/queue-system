let currentPeople = [];
let queues = [];
let currentFilter = 'all';
const API_BASE = '/api/queue';

document.addEventListener('DOMContentLoaded', () => {
    // Logout Logic
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isLoggedIn');
            window.location.href = 'login.html';
        });
    }

    // Load Queues from API
    fetchQueues();
    
    // Average time settings still use localStorage as it's client-side arbitrary logic.
    const timeInput = document.getElementById('avg-time');
    const storedTime = localStorage.getItem('avgTime');
    if (storedTime) {
        timeInput.value = storedTime;
    } else {
        localStorage.setItem('avgTime', '5');
        timeInput.value = '5';
    }

    // Filter Listeners
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentFilter = target.getAttribute('data-filter');
            renderQueues();
        });
    });

    // Setup input listeners
    const personNameInput = document.getElementById('person-name');
    const personPhoneInput = document.getElementById('person-phone');
    const settingsForm = document.getElementById('settings-form');

    [personNameInput, personPhoneInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPerson();
            }
        });
    });

    // Save Settings
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = settingsForm.querySelector('button');
        const originalText = btn.textContent;
        
        localStorage.setItem('avgTime', timeInput.value);
        
        btn.textContent = 'تم الحفظ!';
        btn.style.backgroundColor = 'var(--success)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = 'var(--secondary)';
        }, 2000);
    });
});

async function fetchQueues() {
    try {
        const res = await fetch(API_BASE);
        queues = await res.json();
        renderQueues();
    } catch (e) {
        console.error("Failed to fetch queues", e);
    }
}

function addPerson() {
    const personNameInput = document.getElementById('person-name');
    const personPhoneInput = document.getElementById('person-phone');
    
    const name = personNameInput.value.trim();
    const phone = personPhoneInput.value.trim();
    
    if(!name) {
        alert("يرجى إدخال اسم الشخص على الأقل");
        personNameInput.focus();
        return;
    }
    
    currentPeople.push({ name, phone });
    renderPeopleList();
    
    personNameInput.value = '';
    personPhoneInput.value = '';
    personNameInput.focus();
}

function removePerson(index) {
    currentPeople.splice(index, 1);
    renderPeopleList();
}

function renderPeopleList() {
    const listEl = document.getElementById('people-list');
    listEl.innerHTML = '';
    
    currentPeople.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = 'person-item';
        
        let text = p.name;
        if(p.phone) text += ` (${p.phone})`;
        
        li.innerHTML = `
            <span>${text}</span>
            <button type="button" class="person-item-remove" onclick="removePerson(${index})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

async function submitQueue() {
    const queueIdInput = document.getElementById('queue-id');
    const queueId = queueIdInput.value.trim();
    
    if(!queueId) return;
    
    if(currentPeople.length === 0) {
        alert("يرجى إضافة شخص واحد على الأقل قبل إضافة الدور");
        return;
    }
    
    const payload = {
        queueNumber: queueId,
        people: [...currentPeople],
        status: 'waiting'
    };

    try {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const newQueue = await res.json();
        queues.push(newQueue);
        renderQueues();
        
        queueIdInput.value = '';
        currentPeople = [];
        renderPeopleList();
    } catch (e) {
        console.error('Error adding queue', e);
    }
}

async function changeStatus(id, newStatus) {
    try {
        await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const index = queues.findIndex(q => q._id === id);
        if(index !== -1) {
            queues[index].status = newStatus;
            renderQueues();
        }
    } catch (e) {
        console.error('Error changing status', e);
    }
}

async function deleteQueue(id) {
    if(confirm('هل أنت متأكد من حذف هذا الدور؟')) {
        try {
            await fetch(`${API_BASE}/${id}`, {
                method: 'DELETE'
            });
            queues = queues.filter(q => q._id !== id);
            renderQueues();
        } catch (e) {
            console.error('Error deleting queue', e);
        }
    }
}

async function moveQueueUp(id) {
    const idx = queues.findIndex(q => q._id === id);
    if (idx > 0) {
        const temp = queues[idx];
        queues[idx] = queues[idx - 1];
        queues[idx - 1] = temp;
        renderQueues(); // Optimistic update
        await syncOrder();
    }
}

async function moveQueueDown(id) {
    const idx = queues.findIndex(q => q._id === id);
    if (idx !== -1 && idx < queues.length - 1) {
        const temp = queues[idx];
        queues[idx] = queues[idx + 1];
        queues[idx + 1] = temp;
        renderQueues(); // Optimistic update
        await syncOrder();
    }
}

async function syncOrder() {
    const orderedIds = queues.map(q => q._id);
    try {
        await fetch(`${API_BASE}/reorder/bulk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds })
        });
    } catch (e) {
        console.error('Error syncing order', e);
    }
}

function renderQueues() {
    const queueBody = document.getElementById('queue-body');
    queueBody.innerHTML = '';
    
    let displayedQueues = queues;
    if (currentFilter !== 'all') {
        displayedQueues = queues.filter(q => q.status === currentFilter);
    }
    
    displayedQueues.forEach((q, displayIndex) => {
        // Use real array index for reorder boundaries regardless of visual filter state
        const realIndex = queues.findIndex(item => item._id === q._id);
        
        const namesString = q.people.map(p => p.name).join(' - ');
        
        let statusHtml = '';
        let actionChangeHtml = '';
        
        if (q.status === 'waiting') {
            statusHtml = '<span class="badge badge-waiting">منتظر</span>';
            actionChangeHtml = `<button class="btn btn-action" onclick="changeStatus('${q._id}', 'working')">تغيير الحالة</button>`;
        } else if (q.status === 'working') {
            statusHtml = '<span class="badge badge-working">قيد العمل</span>';
            actionChangeHtml = `<button class="btn btn-action" onclick="changeStatus('${q._id}', 'done')">تغيير الحالة</button>`;
        } else {
            statusHtml = '<span class="badge badge-done">تم</span>';
            actionChangeHtml = `<button class="btn btn-disabled" disabled>تغيير الحالة</button>`;
        }
        
        const isUpDisabled = realIndex === 0 ? 'disabled' : '';
        const isDownDisabled = realIndex === queues.length - 1 ? 'disabled' : '';
        
        const rowClass = q.status === 'working' ? 'row-working' : '';
        
        const tr = document.createElement('tr');
        if(rowClass) tr.className = rowClass;
        
        tr.innerHTML = `
            <td>
                <div class="rank-cell">
                    <span style="font-weight: bold; width: 24px;">${realIndex + 1}</span>
                    <div class="reorder-btns">
                        <button class="btn-icon" onclick="moveQueueUp('${q._id}')" ${isUpDisabled} title="تحريك لأعلى">⬆️</button>
                        <button class="btn-icon" onclick="moveQueueDown('${q._id}')" ${isDownDisabled} title="تحريك لأسفل">⬇️</button>
                    </div>
                </div>
            </td>
            <td>#${q.queueNumber}</td>
            <td><div class="people-display">${namesString}</div></td>
            <td class="status-cell">${statusHtml}</td>
            <td class="action-cell">
                <div class="action-group">
                    ${actionChangeHtml}
                    <button class="btn btn-delete" onclick="deleteQueue('${q._id}')">حذف الدور</button>
                </div>
            </td>
        `;
        queueBody.appendChild(tr);
    });
}
