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
    const queueWeightInput = document.getElementById('queue-weight');
    const appointmentDateInput = document.getElementById('appointment-date');
    const appointmentTimeInput = document.getElementById('appointment-time');

    const queueId = queueIdInput.value.trim();
    const queueWeight = queueWeightInput ? queueWeightInput.value.trim() : '';
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
        time: appointmentTime,
        weight: queueWeight
    };

    try {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await res.json();

        // Re-fetch from server so list is re-sorted by date+time
        await fetchQueues();

        // Clear form
        queueIdInput.value = '';
        if (queueWeightInput) queueWeightInput.value = '';
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

// ─── Manual Reorder ───────────────────────────────────────────────────────────
async function moveQueue(id, direction) {
    try {
        const res = await fetch(`${API_BASE}/reorder/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, direction })
        });
        if (res.ok) {
            queues = await res.json();
            renderQueues();
        }
    } catch (e) {
        console.error('Error reordering queue', e);
    }
}

// ─── Inline Appointment Edit ──────────────────────────────────────────────────
function toggleEditRow(id) {
    const editRow = document.getElementById(`edit-row-${id}`);
    if (!editRow) return;
    const isHidden = editRow.style.display === 'none' || editRow.style.display === '';
    editRow.style.display = isHidden ? 'table-row' : 'none';
}

async function saveAppointment(id) {
    const dateInput = document.getElementById(`edit-date-${id}`);
    const timeInput = document.getElementById(`edit-time-${id}`);
    const weightInput = document.getElementById(`edit-weight-${id}`);

    if (!dateInput || !timeInput) return;

    const newDate = dateInput.value;
    const newTime = timeInput.value;
    const newWeight = weightInput ? weightInput.value.trim() : '';

    if (!newDate || !newTime) {
        alert('يرجى تحديد التاريخ والوقت');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/${id}/appointment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: newDate, time: newTime, weight: newWeight })
        });
        if (res.ok) {
            await fetchQueues();
        }
    } catch (e) {
        console.error('Error saving appointment', e);
    }
}

// ─── Time Formatting ──────────────────────────────────────────────────────────
/**
 * Converts "HH:MM" (24-hour) to "H:MM AM/PM" (12-hour).
 * Returns '-' if input is falsy.
 */
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

/**
 * Formats duration in minutes to Arabic readable string.
 */
function formatDuration(totalMinutes) {
    if (totalMinutes <= 0) return 'جاهز';
    if (totalMinutes < 60) return `${totalMinutes} دقيقة`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} ساعة`;
    return `${hours} ساعة و ${minutes} دقيقة`;
}

/**
 * Converts "HH:MM" string to total minutes from midnight.
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

// ─── Improved Wait-Time Calculation ──────────────────────────────────────────
/**
 * Calculates realistic estimated wait time (in minutes) for a queue entry.
 *
 * Algorithm:
 *  1. Find all active (non-done) entries on the same date.
 *  2. Sort them by order.
 *  3. Simulate the timeline:
 *     - If working: starts at current time, takes remaining service duration (max 0, avgTime - elapsed).
 *     - If waiting: starts at Math.max(currentTime/simTime, appointmentTime), takes avgTime.
 *  4. Return the difference between simulated start time and current time.
 */
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
    
    // Determine the start time of the timeline
    let simTime = 0;
    let baseTime = 0;
    
    if (targetDate === todayStr) {
        // Today: simulation starts at the current time
        const currentMins = now.getHours() * 60 + now.getMinutes();
        simTime = currentMins;
        baseTime = currentMins;
    } else {
        // Future date: simulation starts at the time of the first appointment on that day
        const apptTimes = activeQueues
            .map(q => timeToMinutes(q.time))
            .filter(t => t !== null);
        const firstApptTime = apptTimes.length > 0 ? Math.min(...apptTimes) : 0;
        simTime = firstApptTime;
        baseTime = firstApptTime;
    }

    let targetStartSimTime = null;

    // Simulate service for each active queue entry in order
    for (const q of activeQueues) {
        const apptTime = timeToMinutes(q.time);
        if (apptTime === null) continue;

        let serviceStart = 0;
        let serviceDuration = avgTime;

        if (q.status === 'working') {
            // Already in progress
            serviceStart = simTime; // starts now
            if (q.startedAt && targetDate === todayStr) {
                const elapsedMs = now.getTime() - new Date(q.startedAt).getTime();
                const elapsedMins = Math.floor(elapsedMs / 60000);
                serviceDuration = Math.max(0, avgTime - elapsedMins);
            } else {
                serviceDuration = avgTime;
            }
        } else {
            // Waiting: must start at or after its appointment time, and at or after simTime
            serviceStart = Math.max(simTime, apptTime);
        }

        if (q._id.toString() === targetQueue._id.toString()) {
            targetStartSimTime = serviceStart;
            break;
        }

        // Advance simulation time to when this service finishes
        simTime = serviceStart + serviceDuration;
    }

    if (targetStartSimTime === null) {
        return 0;
    }

    const waitMinutes = targetStartSimTime - baseTime;
    return Math.max(0, waitMinutes);
}

/**
 * Returns the count of people/entries ahead of targetQueue (same date, sorted position, not done).
 */
function calcPeopleAhead(targetQueue, allQueues) {
    const targetDate = targetQueue.date;
    const targetIdx = allQueues.findIndex(q => q._id === targetQueue._id);
    if (targetIdx === -1) return 0;
    
    return allQueues.slice(0, targetIdx).filter(q => 
        q.date === targetDate && 
        q.status !== 'done'
    ).length;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderQueues() {
    const queueBody = document.getElementById('queue-body');
    queueBody.innerHTML = '';

    const avgTime = parseInt(localStorage.getItem('avgTime') || '5', 10);

    let displayedQueues = queues;
    if (currentFilter !== 'all') {
        displayedQueues = queues.filter(q => q.status === currentFilter);
    }

    displayedQueues.forEach((q, displayIndex) => {
        const globalRank = queues.findIndex(item => item._id === q._id) + 1;
        const isFirst = displayIndex === 0;
        const isLast = displayIndex === displayedQueues.length - 1;

        const namesString = q.people.map(p => p.name).join(' - ');

        // Format date: YYYY-MM-DD → DD/MM/YYYY
        let dateDisplay = '-';
        if (q.date) {
            const parts = q.date.split('-');
            if (parts.length === 3) {
                dateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }

        // 12-hour time display
        const timeDisplay = formatTo12Hour(q.time);

        // Status badge + working timer
        let statusHtml = '';
        let actionChangeHtml = '';

        if (q.status === 'waiting') {
            const waitMins = calcEstimatedWait(q, queues, avgTime);
            const waitLabel = waitMins > 0
                ? `<span class="appt-wait">وقت الانتظار المتوقع: ${formatDuration(waitMins)}</span>`
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

        // Reorder buttons: only show when filter is 'all' (otherwise positions are misleading)
        const reorderHtml = currentFilter === 'all' ? `
            <div class="reorder-btns">
                <button class="btn-reorder" title="تحريك للأعلى" onclick="moveQueue('${q._id}', 'up')" ${isFirst ? 'disabled' : ''}>▲</button>
                <button class="btn-reorder" title="تحريك للأسفل" onclick="moveQueue('${q._id}', 'down')" ${isLast ? 'disabled' : ''}>▼</button>
            </div>` : '';

        const tr = document.createElement('tr');
        if (rowClass) tr.className = rowClass;
        tr.setAttribute('data-id', q._id);

        tr.innerHTML = `
            <td>
                <div class="rank-cell">
                    ${reorderHtml}
                    <span style="font-weight:bold;">${globalRank}</span>
                </div>
            </td>
            <td>#${q.queueNumber}</td>
            <td class="appt-date-cell">${dateDisplay}</td>
            <td class="appt-time-cell">${timeDisplay}</td>
            <td><div class="people-display">${namesString}</div></td>
            <td>${q.weight || '-'}</td>
            <td class="status-cell">${statusHtml}</td>
            <td class="action-cell">
                <div class="action-group">
                    ${actionChangeHtml}
                    <button class="btn btn-edit" onclick="toggleEditRow('${q._id}')">تعديل</button>
                    <button class="btn btn-delete" onclick="deleteQueue('${q._id}')">حذف</button>
                </div>
            </td>
        `;
        queueBody.appendChild(tr);

        // Inline edit row (hidden by default)
        const editTr = document.createElement('tr');
        editTr.id = `edit-row-${q._id}`;
        editTr.className = 'inline-edit-row';
        editTr.style.display = 'none';
        editTr.innerHTML = `
            <td colspan="8">
                <div class="inline-edit-form">
                    <span class="inline-edit-label">تعديل الموعد:</span>
                    <div class="inline-edit-fields">
                        <div class="inline-edit-field">
                            <label for="edit-date-${q._id}">التاريخ</label>
                            <input type="date" id="edit-date-${q._id}" value="${q.date || ''}" />
                        </div>
                        <div class="inline-edit-field">
                            <label for="edit-time-${q._id}">الوقت</label>
                            <input type="time" id="edit-time-${q._id}" value="${q.time || ''}" />
                        </div>
                        <div class="inline-edit-field">
                            <label for="edit-weight-${q._id}">وزن العجل</label>
                            <input type="text" id="edit-weight-${q._id}" value="${q.weight || ''}" />
                        </div>
                        <button class="btn btn-save" onclick="saveAppointment('${q._id}')">حفظ</button>
                        <button class="btn btn-cancel" onclick="toggleEditRow('${q._id}')">إلغاء</button>
                    </div>
                </div>
            </td>
        `;
        queueBody.appendChild(editTr);
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
