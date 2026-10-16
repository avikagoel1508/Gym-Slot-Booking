// Helpers for turning a session's `date` + `startHour` into real Dates.
// We build times in the server's local timezone so what an admin picks is
// what members see.

function sessionStart(date, startHour) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, startHour, 0, 0, 0);
}

function sessionEnd(date, startHour) {
  const start = sessionStart(date, startHour);
  return new Date(start.getTime() + 60 * 60 * 1000);
}

// A session can only be booked or cancelled BEFORE it starts.
function hasStarted(session, now = new Date()) {
  return now.getTime() >= sessionStart(session.date, session.startHour).getTime();
}

// A check-in code only works during the session's one-hour window.
function isWithinSessionHour(session, now = new Date()) {
  const start = sessionStart(session.date, session.startHour).getTime();
  const end = sessionEnd(session.date, session.startHour).getTime();
  const t = now.getTime();
  return t >= start && t < end;
}

// "YYYY-MM-DD" for today, used by the client and by the seed script.
function todayStr(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Real calendar check, so "2026-02-31" is rejected.
function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
  );
}

module.exports = {
  sessionStart,
  sessionEnd,
  hasStarted,
  isWithinSessionHour,
  todayStr,
  isValidDateString,
};
