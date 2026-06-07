// ── Twilio SMS Service ──────────────────────────────────────────────────────
const isConfigured =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here' &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_AUTH_TOKEN !== 'your_auth_token_here';

let client;
if (isConfigured) {
  try {
    const twilio = require('twilio');
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch { client = null; }
}

/**
 * שלח SMS ללקוח – אישור בקשת תור
 */
async function sendCustomerConfirmation(appt) {
  if (!isConfigured) return { ok: false, reason: 'Twilio not configured' };

  const msg =
    `✂ מספרת אבי – קיבלנו את בקשת התור שלך!\n` +
    `📅 ${appt.date} בשעה ${appt.time}\n` +
    `✂ שירות: ${appt.service}\n` +
    `ניצור איתך קשר לאישור סופי. לביטול: 09-740-6435`;

  try {
    const result = await client.messages.create({
      body: msg,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   normalizePhone(appt.phone),
    });
    console.log(`[SMS] נשלח ללקוח ${appt.name} – SID: ${result.sid}`);
    return { ok: true, sid: result.sid };
  } catch (err) {
    console.error('[SMS] שגיאה בשליחה ללקוח:', err.message);
    return { ok: false, reason: err.message };
  }
}

/**
 * שלח SMS לספר – התראה על תור חדש
 */
async function sendBarberAlert(appt) {
  if (!isConfigured) return { ok: false, reason: 'Twilio not configured' };
  if (!process.env.BARBERSHOP_PHONE || process.env.BARBERSHOP_PHONE.includes('X'))
    return { ok: false, reason: 'Barbershop phone not set' };

  const msg =
    `🔔 תור חדש!\n` +
    `👤 ${appt.name} | 📱 ${appt.phone}\n` +
    `📅 ${appt.date} | 🕐 ${appt.time}\n` +
    `✂ ${appt.service}`;

  try {
    const result = await client.messages.create({
      body: msg,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   process.env.BARBERSHOP_PHONE,
    });
    console.log(`[SMS] התראה נשלחה לספר – SID: ${result.sid}`);
    return { ok: true, sid: result.sid };
  } catch (err) {
    console.error('[SMS] שגיאה בשליחה לספר:', err.message);
    return { ok: false, reason: err.message };
  }
}

/**
 * SMS לאישור תור (מפאנל הניהול)
 */
async function sendApprovalSms(appt) {
  if (!isConfigured) return { ok: false, reason: 'Twilio not configured' };

  const msg =
    `✅ מספרת אבי – התור שלך אושר!\n` +
    `📅 ${appt.date} בשעה ${appt.time}\n` +
    `✂ ${appt.service}\n` +
    `נתראה! לביטול: 09-740-6435`;

  try {
    const result = await client.messages.create({
      body: msg,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   normalizePhone(appt.phone),
    });
    return { ok: true, sid: result.sid };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * המר מספר ישראלי לפורמט E.164
 */
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0'))   return '+972' + digits.slice(1);
  return '+972' + digits;
}

module.exports = {
  isConfigured,
  sendCustomerConfirmation,
  sendBarberAlert,
  sendApprovalSms,
};
