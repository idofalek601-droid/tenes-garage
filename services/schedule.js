// ── Schedule Exceptions Service ─────────────────────────────────────────────
// מנהל חריגים לשעות הרגילות:
//   type "closed"  – היום סגור לחלוטין
//   type "custom"  – שעות מותאמות אישית לאותו יום
// ──────────────────────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

const DB = path.join(__dirname, '..', 'schedule_exceptions.json');

function readDB() {
  if (!fs.existsSync(DB)) return [];
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; }
}
function writeDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2), 'utf8');
}

/** החזר את כל החריגים */
function getAll() { return readDB(); }

/** החזר חריג ליום ספציפי (YYYY-MM-DD) */
function getByDate(dateStr) {
  return readDB().find(e => e.date === dateStr) || null;
}

/** הוסף / עדכן חריג */
function upsert({ date, type, note, slots }) {
  const list = readDB();
  const idx  = list.findIndex(e => e.date === date);
  const entry = {
    id:   idx === -1 ? Date.now().toString() : list[idx].id,
    date,          // "YYYY-MM-DD"
    type,          // "closed" | "custom"
    note:  note  || '',
    slots: slots || [],  // ["10:00","10:30",...] – רק עבור type=custom
    updatedAt: new Date().toISOString(),
  };
  if (idx === -1) list.push(entry);
  else            list[idx] = entry;
  writeDB(list);
  return entry;
}

/** מחק חריג */
function remove(id) {
  let list = readDB();
  const before = list.length;
  list = list.filter(e => e.id !== id);
  if (list.length === before) return false;
  writeDB(list);
  return true;
}

module.exports = { getAll, getByDate, upsert, remove };
