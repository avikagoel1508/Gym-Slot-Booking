// Gym Slot Booking - plain JavaScript client.
// Everything here talks to the JSON API with the cookie that was set at login.
// Live seat counts arrive via Socket.IO.

async function api(path, options = {}) {
  const opts = { method: options.method || 'GET', headers: {} };
  if (options.body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(options.body);
  }

  let res;
  try {
    res = await fetch('/api' + path, opts);
  } catch {
    const err = new Error('Could not reach the server. Please try again.');
    err.status = 0;
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(
      (data && data.error && data.error.message) || 'Something went wrong.'
    );
    err.status = res.status;
    err.code = data && data.error && data.error.code;
    throw err;
  }
  return data;
}

// --- Navigation / logout -----------------------------------
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout failure and still return to login.
    }
    window.location.href = '/login';
  });
}

// --- Login -------------------------------------------------
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(loginForm);
    setText('form-error', '', true);

    const email = value('login-form', 'email');
    const password = value('login-form', 'password');
    const errs = {};
    if (!email) errs.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    if (Object.keys(errs).length) {
      showFieldErrors(loginForm, errs);
      return;
    }

    const btn = loginForm.querySelector('button[type="submit"]');
    setBusy(btn, true);
    try {
      await api('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
      window.location.href = '/sessions';
    } catch (err) {
      setText('form-error', err.message, false);
    } finally {
      setBusy(btn, false);
    }
  });
}

// --- Register ---------------------------------------------
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(registerForm);
    setText('form-error', '', true);

    const name = value('register-form', 'name');
    const email = value('register-form', 'email');
    const password = value('register-form', 'password');
    const errs = {};
    if (!name || name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';
    if (!email) errs.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password || password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (Object.keys(errs).length) {
      showFieldErrors(registerForm, errs);
      return;
    }

    const btn = registerForm.querySelector('button[type="submit"]');
    setBusy(btn, true);
    try {
      await api('/auth/register', { method: 'POST', body: { name: name.trim(), email: email.trim().toLowerCase(), password } });
      window.location.href = '/sessions';
    } catch (err) {
      setText('form-error', err.message, false);
    } finally {
      setBusy(btn, false);
    }
  });
}

// --- Sessions page ----------------------------------------
const sessionList = document.getElementById('session-list');
const sessionTpl = document.getElementById('session-template');
if (sessionList && sessionTpl) {
  let state = []; // sessions in display order
  const statusEl = document.getElementById('list-status');
  const errorEl = document.getElementById('list-error');
  const filterForm = document.getElementById('filter-form');
  const dateInput = document.getElementById('filter-date');
  const clearFilter = document.getElementById('clear-filter');

  if (clearFilter) {
    clearFilter.addEventListener('click', () => {
      dateInput.value = '';
      loadSessions();
    });
  }
  if (filterForm) {
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loadSessions();
    });
  }

  const userRole = document.body.dataset.role;
  const socket = setupSocket((evt) => onSessionUpdate(evt));

  async function loadSessions() {
    setText('list-status', 'Loading sessions…', false);
    setText('list-error', '', true);
    try {
      const date = dateInput && dateInput.value ? dateInput.value : '';
      const data = await api(date ? `/sessions?date=${date}` : '/sessions');
      state = data.sessions;
      render();
    } catch (err) {
      setText('list-status', '', true);
      setText('list-error', err.message, false);
    }
  }

  function render() {
    sessionList.innerHTML = '';
    if (!state.length) {
      setText('list-status', 'No sessions found.', false);
      return;
    }
    setText('list-status', '', true);
    for (const s of state) {
      const node = sessionTpl.content.firstElementChild.cloneNode(true);
      const when = node.querySelector('.when');
      const seats = node.querySelector('.seats');
      const actions = node.querySelector('.actions');
      when.textContent = `${s.date} · ${String(s.startHour).padStart(2,'0')}:00 (${s.seatsRemaining}/${s.capacity} seats left)`;
      if (s.seatsRemaining === 0) {
        const full = document.createElement('span');
        full.className = 'badge full';
        full.textContent = 'Full · waitlist ' + (s.waitlistCount || 0);
        seats.appendChild(full);
      } else {
        seats.textContent = `${s.seatsRemaining} seat${s.seatsRemaining === 1 ? '' : 's'} remaining · waitlist ${s.waitlistCount || 0}`;
      }

      if (s.isBooked) {
        const b = document.createElement('button');
        b.className = 'btn ghost small';
        b.textContent = 'Booked';
        b.disabled = true;
        actions.appendChild(b);
      } else if (s.seatsRemaining > 0) {
        const b = document.createElement('button');
        b.className = 'btn small';
        b.textContent = 'Book';
        b.onclick = () => book(s, b);
        actions.appendChild(b);
      } else if (!s.isWaiting) {
        const w = document.createElement('button');
        w.className = 'btn ghost small';
        w.textContent = 'Join waitlist';
        w.onclick = () => joinWaitlist(s, w);
        actions.appendChild(w);
      } else {
        const l = document.createElement('button');
        l.className = 'btn ghost small';
        l.textContent = 'Leave waitlist';
        l.onclick = () => leaveWaitlist(s, l);
        actions.appendChild(l);
      }
      sessionList.appendChild(node);
    }
  }

  async function book(s, btn) {
    const snapshot = findSession(s.id);
    if (snapshot) optimisticBook(snapshot);
    setBusy(btn, true);
    try {
      await api(`/sessions/${s.id}/book`, { method: 'POST' });
      await loadSessions();
    } catch (err) {
      if (snapshot) rollbackBook(snapshot);
      render();
      alert(err.message);
    } finally {
      setBusy(btn, false);
    }
  }

  async function joinWaitlist(s, btn) {
    const snapshot = findSession(s.id);
    if (snapshot) optimisticJoin(snapshot);
    setBusy(btn, true);
    try {
      await api(`/sessions/${s.id}/waitlist`, { method: 'POST' });
      await loadSessions();
    } catch (err) {
      if (snapshot) rollbackJoin(snapshot);
      render();
      alert(err.message);
    } finally {
      setBusy(btn, false);
    }
  }

  async function leaveWaitlist(s, btn) {
    const snapshot = findSession(s.id);
    if (snapshot) optimisticLeave(snapshot);
    setBusy(btn, true);
    try {
      await api(`/sessions/${s.id}/waitlist`, { method: 'DELETE' });
      await loadSessions();
    } catch (err) {
      if (snapshot) rollbackLeave(snapshot);
      render();
      alert(err.message);
    } finally {
      setBusy(btn, false);
    }
  }

  function findSession(id) { return state.find((x) => x.id === id); }
  function optimisticBook(s) { s.seatsRemaining--; s.isBooked = true; s.waitlistCount = Math.max(0, s.waitlistCount - 0); render(); }
  function rollbackBook(s) { s.seatsRemaining++; s.isBooked = false; render(); }
  function optimisticJoin(s) { s.waitlistCount++; s.isWaiting = true; render(); }
  function rollbackJoin(s) { s.waitlistCount--; s.isWaiting = false; render(); }
  function optimisticLeave(s) { s.waitlistCount = Math.max(0, s.waitlistCount - 1); s.isWaiting = false; render(); }
  function rollbackLeave(s) { s.waitlistCount++; s.isWaiting = true; render(); }

  function onSessionUpdate(evt) {
    for (const s of state) {
      if (s.id === evt.sessionId) {
        s.seatsRemaining = evt.seatsRemaining;
        s.confirmedCount = evt.confirmedCount;
        s.waitlistCount = evt.waitlistCount;
        break;
      }
    }
    render();
  }

  loadSessions();
}

// --- Bookings page ---------------------------------------
const bookingList = document.getElementById('booking-list');
const bookingTpl = document.getElementById('booking-template');
if (bookingList && bookingTpl) {
  let state = [];
  const statusEl = document.getElementById('list-status');
  const errorEl = document.getElementById('list-error');

  async function load() {
    setText('list-status', 'Loading your bookings…', false);
    setText('list-error', '', true);
    try {
      const data = await api('/bookings/me');
      state = data.bookings;
      render();
    } catch (err) {
      setText('list-status', '', true);
      setText('list-error', err.message, false);
    }
  }

  function render() {
    bookingList.innerHTML = '';
    if (!state.length) {
      setText('list-status', 'You have no confirmed bookings.', false);
      return;
    }
    setText('list-status', '', true);
    for (const b of state) {
      const node = bookingTpl.content.firstElementChild.cloneNode(true);
      const when = node.querySelector('.when');
      const status = node.querySelector('.status');
      const code = node.querySelector('.code');
      const actions = node.querySelector('.actions');
      when.textContent = b.session ? `${b.session.date} · ${String(b.session.startHour).padStart(2,'0')}:00` : 'Session';
      status.textContent = `Status: ${b.status}`;
      code.textContent = b.code ? `Code: ${b.code}` : '';

      const cancel = document.createElement('button');
      cancel.className = 'btn ghost small';
      cancel.textContent = 'Cancel booking';
      cancel.onclick = () => cancelBooking(b, cancel);
      actions.appendChild(cancel);
      bookingList.appendChild(node);
    }
  }

  async function cancelBooking(b, btn) {
    const idx = state.findIndex((x) => x.id === b.id);
    const snapshot = state[idx];
    if (idx >= 0) { state.splice(idx, 1); render(); }
    setBusy(btn, true);
    try {
      await api(`/bookings/${b.id}`, { method: 'DELETE' });
      await load(); // reflect any promotion message, seats update via socket
    } catch (err) {
      if (idx >= 0 && snapshot) { state.splice(idx, 0, snapshot); }
      render();
      alert(err.message);
    } finally {
      setBusy(btn, false);
    }
  }

  setupSocket();
  load();
}

// --- Admin page -------------------------------------------
const adminGrid = document.getElementById('create-session-form');
if (adminGrid) {
  // create session
  const createForm = document.getElementById('create-session-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(createForm);
      setText('create-error', '', true);
      setText('create-ok', '', true);
      const date = value('create-session-form', 'date');
      const hour = parseInt(value('create-session-form', 'startHour'), 10);
      const cap = value('create-session-form', 'capacity');
      const errs = {};
      if (!date) errs.date = 'Date is required.';
      if (Number.isNaN(hour) || hour < 0 || hour > 23) errs.startHour = 'Start hour must be 0–23.';
      const capacity = cap ? parseInt(cap, 10) : 20;
      if (Number.isNaN(capacity) || capacity < 1) errs.capacity = 'Capacity must be a positive whole number.';
      if (Object.keys(errs).length) { showFieldErrors(createForm, errs); return; }
      const btn = createForm.querySelector('button[type="submit"]');
      setBusy(btn, true);
      try {
        await api('/sessions', { method: 'POST', body: { date, startHour: hour, capacity } });
        setText('create-ok', 'Session created.', false);
        createForm.reset();
      } catch (err) {
        setText('create-error', err.message, false);
      } finally {
        setBusy(btn, false);
      }
    });
  }

  // check-in
  const checkinForm = document.getElementById('checkin-form');
  if (checkinForm) {
    checkinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(checkinForm);
      setText('checkin-error', '', true);
      setText('checkin-ok', '', true);
      const code = value('checkin-form', 'code');
      if (!code || code.trim().length < 3) {
        showFieldErrors(checkinForm, { code: 'Enter the member\'s check-in code.' });
        return;
      }
      const btn = checkinForm.querySelector('button[type="submit"]');
      setBusy(btn, true);
      try {
        const r = await api('/checkin', { method: 'POST', body: { code: code.trim().toUpperCase() } });
        setText('checkin-ok', r.booking && r.booking.member ? `Marked ${r.booking.member.name} as present.` : 'Marked present.', false);
        checkinForm.reset();
      } catch (err) {
        setText('checkin-error', err.message, false);
      } finally {
        setBusy(btn, false);
      }
    });
  }

  // session picker
  const pickerForm = document.getElementById('session-picker');
  const pickDate = document.getElementById('pick-date');
  const sessionSelect = document.getElementById('session-select');
  const bookingsStatus = document.getElementById('bookings-status');
  const bookingsError = document.getElementById('bookings-error');
  const bookList = document.getElementById('admin-booking-list');
  const waitList = document.getElementById('admin-waitlist');
  if (pickerForm && pickDate && sessionSelect) {
    pickerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setText('picker-error', '', true);
      setText('picker-status', 'Loading sessions…', false);
      sessionSelect.innerHTML = '<option value="">Choose a session…</option>';
      bookList.innerHTML = ''; waitList.innerHTML='';
      try {
        const d = pickDate.value;
        const data = await api(d ? `/sessions?date=${d}` : '/sessions');
        setText('picker-status', '', true);
        for (const s of data.sessions) {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.date} · ${String(s.startHour).padStart(2,'0')}:00 (seats ${s.seatsRemaining}/${s.capacity})`;
          sessionSelect.appendChild(opt);
        }
      } catch (err) {
        setText('picker-status', '', true);
        setText('picker-error', err.message, false);
      }
    });

    sessionSelect.addEventListener('change', async () => {
      const id = sessionSelect.value;
      bookList.innerHTML=''; waitList.innerHTML='';
      if (!id) return;
      setText('bookings-status', 'Loading bookings…', false);
      setText('bookings-error', '', true);
      try {
        const data = await api(`/sessions/${id}/bookings`);
        setText('bookings-status', '', true);
        for (const b of data.bookings) {
          const li = document.createElement('li');
          li.className = 'list-item';
          li.innerHTML = `<div><strong>${b.member ? b.member.name : 'Member'} (${b.member ? b.member.email : ''})</strong><span class="status">Status: ${b.status}${b.code ? ' · Code: ' + b.code : ''}</span></div>`;
          bookList.appendChild(li);
        }
        if (!data.bookings.length) {
          const li = document.createElement('li'); li.className='list-item'; li.textContent='No confirmed bookings.'; bookList.appendChild(li);
        }
        for (const w of data.waitlist) {
          const li = document.createElement('li');
          li.className='list-item';
          li.innerHTML = `<div><strong>${w.member ? w.member.name : 'Member'}</strong><span class="status">Joined waitlist</span></div>`;
          waitList.appendChild(li);
        }
        if (!data.waitlist.length) {
          const li = document.createElement('li'); li.className='list-item'; li.textContent='No one waiting.'; waitList.appendChild(li);
        }
      } catch (err) {
        setText('bookings-status', '', true);
        setText('bookings-error', err.message, false);
      }
    });
  }
}

// --- Helpers ------------------------------------------------
function value(formId, name) {
  const form = document.getElementById(formId);
  if (!form) return '';
  const el = form.elements.namedItem(name);
  return el ? el.value : '';
}

function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; el.previousElementSibling.setAttribute('aria-invalid', 'false'); });
}

function showFieldErrors(form, errs) {
  for (const key of Object.keys(errs)) {
    const el = form.elements.namedItem(key);
    if (el) el.setAttribute('aria-invalid', 'true');
    const small = form.querySelector(`.field-error[data-error-for="${key}"]`);
    if (small) small.textContent = errs[key];
  }
}

function setText(id, txt, hidden) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = txt;
  el.hidden = hidden;
}

function setBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = busy;
  if (busy && btn.dataset.label === undefined) btn.dataset.label = btn.textContent;
  btn.textContent = busy ? (btn.dataset.busy || 'Saving…') : btn.dataset.label;
}

function setupSocket(onUpdate) {
  const authed = document.body.dataset.authed === '1';
  if (!authed || typeof io === 'undefined') return null;
  const socket = io('/', { withCredentials: true });
  socket.on('session:update', (evt) => {
    if (typeof onUpdate === 'function') onUpdate(evt);
  });
  return socket;
}
