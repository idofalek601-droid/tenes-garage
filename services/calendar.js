// ── Google Calendar Service ─────────────────────────────────────────────────
const { google } = require('googleapis');
const fs          = require('fs');
const path        = require('path');

const TOKEN_PATH = path.join(__dirname, '..', 'google_token.json');

const isConfigured =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_client_id_here';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * כתובת ל-OAuth – שלב 1
 */
function getAuthUrl() {
  const auth = getOAuthClient();
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       ['https://www.googleapis.com/auth/calendar.events'],
  });
}

/**
 * שמור token לאחר redirect – שלב 2
 */
async function saveToken(code) {
  const auth = getOAuthClient();
  const { tokens } = await auth.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  return tokens;
}

/**
 * טעינת token שמור
 */
function loadAuth() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  const auth = getOAuthClient();
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  auth.setCredentials(tokens);
  return auth;
}

function isAuthorized() {
  return isConfigured && fs.existsSync(TOKEN_PATH);
}

/**
 * המרת תאריך בעברית ל-Date object
 * פורמט: "יום חמישי, 12 יוני 2025"
 */
function parseHebrewDate(dateStr, timeStr) {
  const MONTHS = {
    'ינואר':1,'פברואר':2,'מרץ':3,'אפריל':4,'מאי':5,'יוני':6,
    'יולי':7,'אוגוסט':8,'ספטמבר':9,'אוקטובר':10,'נובמבר':11,'דצמבר':12
  };
  // "יום חמישי, 12 יוני 2025"
  const m = dateStr.match(/(\d+)\s+(\S+)\s+(\d{4})/);
  if (!m) return null;
  const day   = parseInt(m[1]);
  const month = MONTHS[m[2]];
  const year  = parseInt(m[3]);
  if (!month) return null;

  const [h, min] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, h, min, 0);
}

/**
 * הוסף אירוע ליומן גוגל
 */
async function addToCalendar(appt) {
  if (!isAuthorized()) return { ok: false, reason: 'Google not authorized' };

  const auth     = loadAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const start = parseHebrewDate(appt.date, appt.time);
  if (!start) return { ok: false, reason: 'Could not parse date' };
  const end = new Date(start.getTime() + 30 * 60 * 1000); // +30 דקות

  const event = {
    summary:     `✂ ${appt.service} – ${appt.name}`,
    description: `לקוח: ${appt.name}\nטלפון: ${appt.phone}\nשירות: ${appt.service}`,
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Jerusalem' },
    end:   { dateTime: end.toISOString(),   timeZone: 'Asia/Jerusalem' },
    reminders: {
      useDefault: false,
      overrides:  [{ method: 'popup', minutes: 30 }],
    },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      resource:   event,
    });
    console.log(`[Calendar] אירוע נוסף: ${res.data.id}`);
    return { ok: true, eventId: res.data.id, link: res.data.htmlLink };
  } catch (err) {
    console.error('[Calendar] שגיאה:', err.message);
    return { ok: false, reason: err.message };
  }
}

/**
 * מחק אירוע (כשמבטלים תור)
 */
async function deleteFromCalendar(eventId) {
  if (!isAuthorized() || !eventId) return { ok: false };
  const auth     = loadAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = {
  isConfigured,
  isAuthorized,
  getAuthUrl,
  saveToken,
  addToCalendar,
  deleteFromCalendar,
};
