const nodemailer = require('nodemailer');

const isConfigured = !!(process.env.GMAIL_USER && process.env.GMAIL_PASS);

function createTransporter() {
  if (!isConfigured) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

const BARBER_EMAIL = process.env.GMAIL_USER || 'Noamtene37@gmail.com';

// ── מייל ללקוח בעת קביעת תור ────────────────────────────────────────────
async function sendCustomerBookingEmail(appt) {
  if (!isConfigured || !appt.email) return { ok: false, reason: 'לא מוגדר או אין מייל ללקוח' };
  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: `"הגראז' של טנא ✂" <${BARBER_EMAIL}>`,
      to: appt.email,
      subject: '📋 קיבלנו את בקשת התור שלך!',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0d0a12;color:#d8cce8;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6c3483,#9b59b6);padding:2rem;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:1.6rem">✂ הגראז' של טנא</h1>
            <p style="color:#e8d5f5;margin:.4rem 0 0">NOAM TENE BARBER</p>
          </div>
          <div style="padding:2rem;">
            <h2 style="color:#b87fd4">היי ${appt.name}! 👋</h2>
            <p>קיבלנו את בקשת התור שלך. נועם יאשר בהקדם ותקבל עדכון.</p>
            <div style="background:#1e1628;border-right:4px solid #9b59b6;border-radius:8px;padding:1.2rem;margin:1.2rem 0;">
              <p style="margin:.3rem 0">📅 <strong>תאריך:</strong> ${appt.date}</p>
              <p style="margin:.3rem 0">🕐 <strong>שעה:</strong> ${appt.time}</p>
              <p style="margin:.3rem 0">✂ <strong>שירות:</strong> ${appt.service}</p>
              <p style="margin:.3rem 0">📞 <strong>טלפון:</strong> ${appt.phone}</p>
            </div>
            <p style="color:#9080a8;font-size:.9rem">⏳ הסטטוס כרגע: <strong style="color:#ffc107">ממתין לאישור</strong></p>
            <p style="color:#9080a8;font-size:.85rem;margin-top:1.5rem">📍 נצח ישראל 37, הוד השרון</p>
          </div>
          <div style="background:#0a0a0a;padding:1rem;text-align:center;font-size:.78rem;color:#555;">
            © הגראז' של טנא | <a href="https://www.instagram.com/tenes_garage" style="color:#9b59b6">@tenes_garage</a>
          </div>
        </div>`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── מייל לטנא על תור חדש ─────────────────────────────────────────────────
async function sendBarberAlertEmail(appt) {
  if (!isConfigured) return { ok: false, reason: 'לא מוגדר' };
  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: `"הגראז' של טנא – מערכת" <${BARBER_EMAIL}>`,
      to: BARBER_EMAIL,
      subject: `🔔 תור חדש – ${appt.name} ב-${appt.date} ${appt.time}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
          <div style="background:#6c3483;padding:1.5rem;text-align:center;">
            <h2 style="color:#fff;margin:0">✂ תור חדש!</h2>
          </div>
          <div style="padding:1.5rem;">
            <p style="margin:.4rem 0">👤 <strong>שם:</strong> ${appt.name}</p>
            <p style="margin:.4rem 0">📞 <strong>טלפון:</strong> <a href="tel:${appt.phone}">${appt.phone}</a></p>
            <p style="margin:.4rem 0">📅 <strong>תאריך:</strong> ${appt.date}</p>
            <p style="margin:.4rem 0">🕐 <strong>שעה:</strong> ${appt.time}</p>
            <p style="margin:.4rem 0">✂ <strong>שירות:</strong> ${appt.service}</p>
            ${appt.email ? `<p style="margin:.4rem 0">📧 <strong>מייל:</strong> ${appt.email}</p>` : ''}
            <a href="https://tenes-garage-production.up.railway.app/admin" style="display:inline-block;margin-top:1rem;background:#9b59b6;color:#fff;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:bold;">כניסה לפאנל ניהול →</a>
          </div>
        </div>`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── מייל ללקוח עם אישור תור ──────────────────────────────────────────────
async function sendApprovalEmail(appt) {
  if (!isConfigured || !appt.email) return { ok: false, reason: 'לא מוגדר או אין מייל ללקוח' };
  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: `"הגראז' של טנא ✂" <${BARBER_EMAIL}>`,
      to: appt.email,
      subject: '✅ התור שלך אושר!',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0d0a12;color:#d8cce8;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1e8449,#27ae60);padding:2rem;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:1.8rem">✅ התור אושר!</h1>
            <p style="color:#d5f5e3;margin:.4rem 0 0">הגראז' של טנא</p>
          </div>
          <div style="padding:2rem;">
            <h2 style="color:#b87fd4">היי ${appt.name}! 🎉</h2>
            <p>נועם מחכה לך! הנה פרטי התור המאושר:</p>
            <div style="background:#1e1628;border-right:4px solid #27ae60;border-radius:8px;padding:1.2rem;margin:1.2rem 0;">
              <p style="margin:.3rem 0">📅 <strong>תאריך:</strong> ${appt.date}</p>
              <p style="margin:.3rem 0">🕐 <strong>שעה:</strong> ${appt.time}</p>
              <p style="margin:.3rem 0">✂ <strong>שירות:</strong> ${appt.service}</p>
            </div>
            <a href="https://waze.com/ul?q=נצח+ישראל+37+הוד+השרון&navigate=yes" style="display:inline-block;background:#05C8F7;color:#000;padding:.7rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:.5rem">🗺 נווט בוויז</a>
            <p style="color:#9080a8;font-size:.85rem;margin-top:1.5rem">📍 נצח ישראל 37, הוד השרון | 📞 052-505-2028</p>
          </div>
          <div style="background:#0a0a0a;padding:1rem;text-align:center;font-size:.78rem;color:#555;">
            © הגראז' של טנא | <a href="https://www.instagram.com/tenes_garage" style="color:#9b59b6">@tenes_garage</a>
          </div>
        </div>`,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { isConfigured, sendCustomerBookingEmail, sendBarberAlertEmail, sendApprovalEmail };
