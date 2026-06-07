// ===== HAMBURGER =====
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');
if (hamburger) {
  hamburger.addEventListener('click', () => navMobile.classList.toggle('open'));
  document.querySelectorAll('.nav-mobile a').forEach(a =>
    a.addEventListener('click', () => navMobile.classList.remove('open'))
  );
}

// ===== SCHEDULE – שעות פתיחה של הגראז' =====
// JS day: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const JS_OPEN = {
  0: { start: 13,   end: 18.5  }, // ראשון  13:00–18:30
  1: { start: 15.5, end: 19    }, // שני    15:30–19:00
  2: { start: 15,   end: 18    }, // שלישי  15:00–18:00
  3: { start: 16.5, end: 17.5  }, // רביעי  16:30–17:30
  4: { start: 15,   end: 19.5  }, // חמישי  15:00–19:30
  5: { start: 12,   end: 15    }, // שישי   12:00–15:00
  6: null                          // שבת    סגור
};

const SLOT_DURATION = 30;
let exceptions = {};

async function loadExceptions() {
  try {
    const list = await fetch('/api/schedule').then(r => r.json());
    exceptions = {};
    list.forEach(e => { exceptions[e.date] = e; });
  } catch { exceptions = {}; }
}

// ===== CALENDAR =====
let currentYear, currentMonth, selectedDate;

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function isDayOpen(date) {
  const exc = exceptions[isoDate(date)];
  if (exc) return exc.type === 'custom' && exc.slots?.length > 0;
  if (exc?.type === 'closed') return false;
  return JS_OPEN[date.getDay()] !== null;
}

function initCalendar() {
  const t = new Date();
  currentYear = t.getFullYear(); currentMonth = t.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('calTitle');
  const grid    = document.getElementById('calGrid');
  if (!titleEl || !grid) return;

  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  titleEl.textContent = `${months[currentMonth]} ${currentYear}`;
  grid.innerHTML = '';

  const today     = new Date(); today.setHours(0,0,0,0);
  const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
  const daysCount = new Date(currentYear, currentMonth+1, 0).getDate();

  for (let i=0; i<firstDay; i++) {
    const b = document.createElement('div'); b.className='cal-cell empty'; grid.appendChild(b);
  }

  for (let d=1; d<=daysCount; d++) {
    const date   = new Date(currentYear, currentMonth, d);
    const isPast = date < today;
    const key    = isoDate(date);
    const exc    = exceptions[key];

    let isOpen;
    if (exc?.type === 'closed') isOpen = false;
    else if (exc?.type === 'custom') isOpen = exc.slots?.length > 0;
    else isOpen = JS_OPEN[date.getDay()] !== null;

    const cell = document.createElement('div');
    cell.textContent = d; cell.className = 'cal-cell';

    if (isPast)       cell.classList.add('past');
    else if (!isOpen) cell.classList.add('closed');
    else {
      cell.classList.add('available');
      if (exc?.type === 'custom') cell.classList.add('custom-hours');
    }

    if (date.getTime() === today.getTime()) cell.classList.add('today');
    if (selectedDate && date.toDateString() === selectedDate.toDateString()) cell.classList.add('selected');
    if (exc) cell.title = exc.type === 'closed' ? 'סגור' : 'שעות מיוחדות';

    if (!isPast && isOpen) cell.addEventListener('click', () => selectDate(date));
    grid.appendChild(cell);
  }
}

function selectDate(date) {
  selectedDate = date;
  renderCalendar();

  const days   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const input  = document.getElementById('selectedDate');
  if (input) input.value = `יום ${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;

  buildTimeSlots(date);
}

function buildTimeSlots(date) {
  const sel = document.getElementById('timeSlot');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- בחר שעה --</option>';

  const key = isoDate(date);
  const exc = exceptions[key];

  if (exc?.type === 'custom') {
    exc.slots.forEach(s => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = s;
      sel.appendChild(opt);
    });
    return;
  }

  const schedule = JS_OPEN[date.getDay()];
  if (!schedule) return;

  let cur = schedule.start * 60, end = schedule.end * 60;
  while (cur < end) {
    const h = Math.floor(cur/60), m = cur%60;
    const label = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const opt = document.createElement('option');
    opt.value = opt.textContent = label;
    sel.appendChild(opt);
    cur += SLOT_DURATION;
  }
}

document.getElementById('prevMonth')?.addEventListener('click', () => {
  if (--currentMonth < 0) { currentMonth=11; currentYear--; } renderCalendar();
});
document.getElementById('nextMonth')?.addEventListener('click', () => {
  if (++currentMonth > 11) { currentMonth=0; currentYear++; } renderCalendar();
});

// ===== BOOKING FORM =====
document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    date:    document.getElementById('selectedDate').value,
    time:    document.getElementById('timeSlot').value,
    name:    document.getElementById('fullName').value,
    phone:   document.getElementById('phone').value,
    email:   document.getElementById('emailInput')?.value || '',
    service: document.getElementById('service').value,
  };
  if (!data.date) { showToast('❗ אנא בחר תאריך ביומן'); return; }
  if (!data.time) { showToast('❗ אנא בחר שעה'); return; }

  try {
    const res  = await fetch('/api/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const json = await res.json();
    if (res.ok) {
      document.getElementById('bookingForm').style.display = 'none';
      document.getElementById('successMsg').style.display = 'block';
      showToast('✅ התור נקלט!');
    } else {
      showToast('❗ ' + (json.error || 'שגיאה'));
    }
  } catch { showToast('❗ שגיאת חיבור'); }
});

// ===== TOAST =====
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t=document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3200);
}

// ===== INIT =====
loadExceptions().then(initCalendar);
