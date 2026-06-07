require('dotenv').config();
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const QRCode   = require('qrcode');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const sms      = require('./services/sms');
const calendar = require('./services/calendar');
const schedule = require('./services/schedule');

// ── Auth credentials (מה-.env או ברירת מחדל) ──────────────────────────────
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH ||
  bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'avi1234', 10);

// מצא את ה-IP המקומי אוטומטית
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return 'localhost';
}
const LOCAL_IP = getLocalIP();

const app  = express();
const PORT = process.env.PORT || 3000;
const DB   = path.join(__dirname, 'appointments.json');

// ── helpers ────────────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB)) return [];
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; }
}
function writeDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2), 'utf8');
}

// ── middleware ─────────────────────────────────────────────────────────────
app.use(express.json());

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'avi-barbershop-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }, // 8 שעות
}));

// Static files – אבל לא חוסמים ישירות
app.use(express.static(path.join(__dirname)));

// ── Auth middleware ────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}

// ── Login routes ───────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session?.loggedIn) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'חסרים פרטים' });

  const userOk = username === ADMIN_USER;
  const passOk = await bcrypt.compare(password, ADMIN_HASH);

  if (userOk && passOk) {
    req.session.loggedIn = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'שגיאה' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR AUTH
// ══════════════════════════════════════════════════════════════════════════

/** שלב 1 – redirect לגוגל */
app.get('/auth/google', (req, res) => {
  if (!calendar.isConfigured) {
    return res.send(`
      <h2 style="font-family:Arial;color:#721c24;padding:2rem">
        ❗ יש להגדיר GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET ב-.env תחילה
      </h2>`);
  }
  res.redirect(calendar.getAuthUrl());
});

/** שלב 2 – callback מגוגל */
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    await calendar.saveToken(code);
    res.send(`
      <div style="font-family:Arial;text-align:center;padding:4rem">
        <h1 style="color:#155724">✅ גוגל קלנדר חובר בהצלחה!</h1>
        <p>מעכשיו כל תור יתווסף אוטומטית ליומן שלך.</p>
        <a href="/admin" style="color:#7b4a1e;font-weight:bold">← חזור לפאנל הניהול</a>
      </div>`);
  } catch (err) {
    res.status(500).send('שגיאה: ' + err.message);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  בדיקת סטטוס תור – ציבורי (ללקוחות)
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/check-status', (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'נדרש מספר טלפון' });
  const clean = phone.replace(/[-\s]/g, '');
  const list  = readDB();
  // מצא את כל התורים של הטלפון, מהאחרון לראשון
  const appts = list
    .filter(a => a.phone.replace(/[-\s]/g, '') === clean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!appts.length)
    return res.json({ found: false });
  // החזר את הפרטים בלי מידע רגיש
  res.json({
    found: true,
    appointments: appts.map(a => ({
      date:    a.date,
      time:    a.time,
      name:    a.name,
      service: a.service,
      status:  a.status,
    })),
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  כל ה-API מכאן והלאה – מוגן בהתחברות
// ══════════════════════════════════════════════════════════════════════════
app.use('/api/appointments', requireAuth);
app.use('/api/schedule',     requireAuth);
app.use('/api/status',       requireAuth);
app.use('/api/network',      requireAuth);

// ══════════════════════════════════════════════════════════════════════════
//  STATUS API – מצב חיבורים
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/status', (req, res) => {
  res.json({
    twilio:   { configured: sms.isConfigured },
    calendar: {
      configured:  calendar.isConfigured,
      authorized:  calendar.isAuthorized(),
      authUrl:     calendar.isConfigured ? '/auth/google' : null,
    },
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  APPOINTMENTS API
// ══════════════════════════════════════════════════════════════════════════

// ── API: מידע רשת + QR ────────────────────────────────────────────────────
app.get('/api/network', async (req, res) => {
  const url      = `http://${LOCAL_IP}:${PORT}`;
  const adminUrl = `http://${LOCAL_IP}:${PORT}/admin`;
  const opts     = { width: 200, margin: 1, color: { dark: '#3b1f0e', light: '#fdf6ee' } };
  const [qr, qrAdmin] = await Promise.all([
    QRCode.toDataURL(url,      opts),
    QRCode.toDataURL(adminUrl, opts),
  ]);
  res.json({ ip: LOCAL_IP, port: PORT, url, qr, adminUrl, qrAdmin });
});

/** קבל את כל התורים */
app.get('/api/appointments', (req, res) => {
  const list = readDB();
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

/** צור תור חדש */
app.post('/api/appointments', async (req, res) => {
  const { date, time, name, phone, service } = req.body;
  if (!date || !time || !name || !phone)
    return res.status(400).json({ error: 'יש למלא את כל השדות הנדרשים' });

  const list  = readDB();
  const clash = list.find(a => a.date === date && a.time === time && a.status !== 'cancelled');
  if (clash)
    return res.status(409).json({ error: 'השעה הזאת כבר תפוסה – אנא בחר שעה אחרת' });

  const appt = {
    id:        Date.now().toString(),
    date, time, name, phone,
    service:   service || 'תספורת',
    status:    'pending',
    createdAt: new Date().toISOString(),
    smsCustomer: null,
    smsBarber:   null,
    calendarEventId: null,
  };

  list.push(appt);
  writeDB(list);

  // ── שלח SMS ────────────────────────────────────────────────────────────
  const [smsC, smsB] = await Promise.all([
    sms.sendCustomerConfirmation(appt),
    sms.sendBarberAlert(appt),
  ]);
  appt.smsCustomer = smsC.ok ? 'sent' : ('failed: ' + smsC.reason);
  appt.smsBarber   = smsB.ok ? 'sent' : ('failed: ' + smsB.reason);

  // ── הוסף ל-Google Calendar ─────────────────────────────────────────────
  const calRes = await calendar.addToCalendar(appt);
  if (calRes.ok) appt.calendarEventId = calRes.eventId;

  // עדכן DB עם תוצאות
  const idx = list.findIndex(a => a.id === appt.id);
  if (idx !== -1) { list[idx] = appt; writeDB(list); }

  res.status(201).json({
    ok: true,
    appointment: appt,
    integrations: {
      smsCustomer: smsC,
      smsBarber:   smsB,
      calendar:    calRes,
    },
  });
});

/** עדכן סטטוס תור */
app.patch('/api/appointments/:id', async (req, res) => {
  const list = readDB();
  const idx  = list.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'תור לא נמצא' });

  const { status } = req.body;
  if (!['pending', 'confirmed', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'סטטוס לא חוקי' });

  list[idx].status = status;

  // אם אישרו – שלח SMS אישור ללקוח
  if (status === 'confirmed') {
    const smsRes = await sms.sendApprovalSms(list[idx]);
    list[idx].smsApproval = smsRes.ok ? 'sent' : ('failed: ' + smsRes.reason);
  }

  // אם בוטל – מחק מ-Google Calendar
  if (status === 'cancelled' && list[idx].calendarEventId) {
    await calendar.deleteFromCalendar(list[idx].calendarEventId);
    list[idx].calendarEventId = null;
  }

  writeDB(list);
  res.json({ ok: true, appointment: list[idx] });
});

/** שלח SMS ידני מהאדמין */
app.post('/api/appointments/:id/sms', async (req, res) => {
  const list = readDB();
  const appt = list.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: 'תור לא נמצא' });

  const result = await sms.sendApprovalSms(appt);
  res.json(result);
});

/** מחק תור */
app.delete('/api/appointments/:id', async (req, res) => {
  let list = readDB();
  const appt = list.find(a => a.id === req.params.id);

  if (!appt) return res.status(404).json({ error: 'תור לא נמצא' });

  // מחק מ-Calendar אם קיים
  if (appt.calendarEventId)
    await calendar.deleteFromCalendar(appt.calendarEventId);

  list = list.filter(a => a.id !== req.params.id);
  writeDB(list);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  SCHEDULE EXCEPTIONS API
// ══════════════════════════════════════════════════════════════════════════

/** קבל את כל החריגים (ציבורי – ללקוחות ביומן) */
app.get('/api/schedule', (req, res) => {
  res.json(schedule.getAll());
});

/** קבל חריג לתאריך ספציפי */
app.get('/api/schedule/:date', (req, res) => {
  const entry = schedule.getByDate(req.params.date);
  if (!entry) return res.json(null);
  res.json(entry);
});

/** הוסף / עדכן חריג */
app.post('/api/schedule', (req, res) => {
  const { date, type, note, slots } = req.body;
  if (!date || !type) return res.status(400).json({ error: 'date ו-type נדרשים' });
  if (!['closed', 'custom'].includes(type))
    return res.status(400).json({ error: 'type חייב להיות closed או custom' });
  const entry = schedule.upsert({ date, type, note, slots });
  res.status(201).json({ ok: true, entry });
});

/** מחק חריג */
app.delete('/api/schedule/:id', (req, res) => {
  const ok = schedule.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'לא נמצא' });
  res.json({ ok: true });
});

// ── Serve admin page (מוגן!) ───────────────────────────────────────────────
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✂  מספרת אבי – שרת פעיל`);
  console.log(`   http://localhost:${PORT}             ← אתר לקוחות`);
  console.log(`   http://localhost:${PORT}/admin       ← פאנל ניהול`);
  console.log(`   http://localhost:${PORT}/auth/google ← חיבור Google Calendar\n`);
  console.log(`   Twilio SMS:      ${sms.isConfigured      ? '✅ מוגדר' : '⚠️  לא מוגדר (.env)'}`);
  console.log(`   Google Calendar: ${calendar.isConfigured  ? (calendar.isAuthorized() ? '✅ מחובר' : '⚠️  מוגדר, לא מורשה – /auth/google') : '⚠️  לא מוגדר (.env)'}\n`);
});
