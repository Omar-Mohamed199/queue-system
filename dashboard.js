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

    // Set today's date as default for appointment-date input
    const appointmentDateInput = document.getElementById('appointment-date');
    if (appointmentDateInput) {
        const today = new Date().toISOString().split('T')[0];
        appointmentDateInput.value = today;
    }

    // Load Queues from API
    fetchQueues();
    setInterval(fetchQueues, 5000);

    // Average time settings — client-side arbitrary logic
    const avgTimeInput = document.getElementById('avg-time');
    const storedTime = localStorage.getItem('avgTime');
    if (storedTime) {
        avgTimeInput.value = storedTime;
    } else {
        localStorage.setItem('avgTime', '5');
        avgTimeInput.value = '5';
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

    // Setup input listeners for person inputs
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

        localStorage.setItem('avgTime', avgTimeInput.value);

        btn.textContent = 'تم الحفظ!';
        btn.style.backgroundColor = 'var(--success)';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = 'var(--secondary)';
        }, 2000);
    });

    // Update working-status elapsed times every minute
    setInterval(updateProgressTimes, 60000);
});

async function fetchQueues() {
    try {
        const res = await fetch(API_BASE);
        // Server returns queues already sorted by date ASC, time ASC
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

    if (!name) {
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
        if (p.phone) text += ` (${p.phone})`;

        li.innerHTML = `
            <span>${text}</span>
            <button type="button" class="person-item-remove" onclick="removePerson(${index})">&times;</button>
        `;
        listEl.appendChild(li);
    });
}

async function submitQueue() {
    const queueIdInput = document.getElementById('queue-id');
    const appointmentDateInput = document.getElementById('appointment-date');
    const appointmentTimeInput = document.getElementById('appointment-time');

    const queueId = queueIdInput.value.trim();
    const appointmentDate = appointmentDateInput.value;
    const appointmentTime = appointmentTimeInput.value;

    if (!queueId) return;

    if (!appointmentDate || !appointmentTime) {
        alert("يرجى تحديد اليوم والساعة للموعد");
        return;
    }

    if (currentPeople.length === 0) {
        alert("يرجى إضافة شخص واحد على الأقل قبل إضافة الدور");
        return;
    }

    const payload = {
        queueNumber: queueId,
        people: [...currentPeople],
        status: 'waiting',
        date: appointmentDate,
        time: appointmentTime
    };

    try {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const newQueue = await res.json();

        // Re-fetch from server so list is re-sorted by date+time
        await fetchQueues();

        // Clear form
        queueIdInput.value = '';
        const today = new Date().toISOString().split('T')[0];
        appointmentDateInput.value = today;
        appointmentTimeInput.value = '';
        currentPeople = [];
        renderPeopleList();
    } catch (e) {
        console.error('Error adding queue', e);
    }
}

async function changeStatus(id, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const updated = await res.json();

        const index = queues.findIndex(q => q._id === id);
        if (index !== -1) {
            queues[index] = updated;
            renderQueues();
        }
    } catch (e) {
        console.error('Error changing status', e);
    }
}

async function deleteQueue(id) {
    if (confirm('هل أنت متأكد من حذف هذا الموعد؟')) {
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

// ─── Appointment-aware waiting time calculation ───────────────────────────────
/**
 * Returns the estimated wait time (in minutes) for a queue entry.
 * Only counts entries on the SAME date with EARLIER appointment time
 * that are still waiting or working.
 */
function calcEstimatedWait(targetQueue, allQueues, avgTime) {
    const targetDate = targetQueue.date;
    const targetTime = targetQueue.time;

    const now = Date.now();
    let time = 0;

    // Only consider queues on the same date with an earlier appointment time
    const earlier = allQueues.filter(q =>
        q._id !== targetQueue._id &&
        q.date === targetDate &&
        q.time < targetTime &&
        q.status !== 'done'
    );

    earlier.forEach(q => {
        if (q.status === 'working') {
            let remaining = avgTime;
            if (q.startedAt) {
                const diffMs = now - new Date(q.startedAt).getTime();
                const diffMins = Math.floor(diffMs / 60000);
                remaining = Math.max(0, avgTime - diffMins);
            }
            time += remaining;
        } else if (q.status === 'waiting') {
            time += avgTime;
        }
    });

    return time;
}

/**
 * Returns the count of people ahead of targetQueue on the same date
 * with earlier appointment times that are still waiting or working.
 */
function calcPeopleAhead(targetQueue, allQueues) {
    const targetDate = targetQueue.date;
    const targetTime = targetQueue.time;

    return allQueues.filter(q =>
        q._id !== targetQueue._id &&
        q.date === targetDate &&
        q.time < targetTime &&
        q.status !== 'done'
    ).length;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderQueues() {
    const queueBody = document.getElementById('queue-body');
    queueBody.innerHTML = '';

    const avgTime = parseInt(localStorage.getItem('avgTime') || '5', 10);

    // queues already sorted by date+time from server
    let displayedQueues = queues;
    if (currentFilter !== 'all') {
        displayedQueues = queues.filter(q => q.status === currentFilter);
    }

    displayedQueues.forEach((q, displayIndex) => {
        // Overall rank in the full (unfiltered, date+time sorted) list
        const globalRank = queues.findIndex(item => item._id === q._id) + 1;

        const namesString = q.people.map(p => p.name).join(' - ');

        // Format date for display (YYYY-MM-DD → DD/MM/YYYY)
        let dateDisplay = '-';
        if (q.date) {
            const parts = q.date.split('-');
            if (parts.length === 3) {
                dateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }

        const timeDisplay = q.time || '-';

        // Status badge + working timer
        let statusHtml = '';
        let actionChangeHtml = '';

        if (q.status === 'waiting') {
            // Show estimated wait for this appointment
            const waitMins = calcEstimatedWait(q, queues, avgTime);
            const waitLabel = waitMins > 0
                ? `<span class="appt-wait">وقت الانتظار المتوقع: ${formatTime(waitMins)}</span>`
                : '';

            statusHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span class="badge badge-waiting">منتظر</span>
                ${waitLabel}
            </div>`;
            actionChangeHtml = `<button class="btn btn-action" onclick="changeStatus('${q._id}', 'working')">تغيير الحالة</button>`;

        } else if (q.status === 'working') {
            const timeStr = getProgressTimeStr(q.startedAt);
            statusHtml = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span class="badge badge-working">قيد العمل</span>
                ${q.startedAt ? `<span class="working-time-display" data-start="${q.startedAt}" style="font-size:0.85rem;color:var(--text-light);text-wrap:nowrap;">${timeStr}</span>` : ''}
            </div>`;
            actionChangeHtml = `<button class="btn btn-action" onclick="changeStatus('${q._id}', 'done')">تغيير الحالة</button>`;

        } else {
            statusHtml = '<span class="badge badge-done">تم</span>';
            actionChangeHtml = `<button class="btn btn-disabled" disabled>تغيير الحالة</button>`;
        }

        const rowClass = q.status === 'working' ? 'row-working' : '';

        const tr = document.createElement('tr');
        if (rowClass) tr.className = rowClass;

        tr.innerHTML = `
            <td>
                <span style="font-weight:bold;">${globalRank}</span>
            </td>
            <td>#${q.queueNumber}</td>
            <td class="appt-date-cell">${dateDisplay}</td>
            <td class="appt-time-cell">${timeDisplay}</td>
            <td><div class="people-display">${namesString}</div></td>
            <td class="status-cell">${statusHtml}</td>
            <td class="action-cell">
                <div class="action-group">
                    ${actionChangeHtml}
                    <button class="btn btn-delete" onclick="deleteQueue('${q._id}')">حذف</button>
                </div>
            </td>
        `;
        queueBody.appendChild(tr);
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(totalMinutes) {
    if (totalMinutes < 60) return `${totalMinutes} دقيقة`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} ساعة`;
    return `${hours} ساعة و ${minutes} دقيقة`;
}

function getProgressTimeStr(startedAt) {
    if (!startedAt) return '';
    const diffMs = Date.now() - new Date(startedAt).getTime();
    if (diffMs < 0) return 'لمدة 0 دقيقة';
    const diffMins = Math.floor(diffMs / 60000);
    return `لمدة ${formatTime(diffMins)}`;
}

function updateProgressTimes() {
    const timeElements = document.querySelectorAll('.working-time-display');
    timeElements.forEach(el => {
        const start = el.getAttribute('data-start');
        if (start) {
            el.textContent = getProgressTimeStr(start);
        }
    });
}
