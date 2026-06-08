const GOOGLE_CLIENT_ID =
  '758097653129-i5cda00k5b73uudvmmalj2jdvk70t5jr.apps.googleusercontent.com';

const HUB_API_URL =
  'https://script.google.com/macros/s/AKfycbyAHpUfM1RrPJbamCVcc5rGhUgRKoLRKSULBGnCNGLyCSaFU5lp7SX2Ge1Wwv9YEV5-Sg/exec';

const SHARED_AUTH_TOKEN_KEY = 'tools501_google_id_token';

let authToken = null;
let uiText = {
  openApp: 'Open',
  subtitle: '',
  accessError: 'Access check failed'
};
let headerClockTimer = null;
let sessionTimer = null;
let sessionExpireTimer = null;
let sessionCountdownTimer = null;
let sessionExpiresAt = 0;
let sessionExpired = false;

function formatHeaderMeta() {

  const now = new Date();

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now);
}

function updateHeaderMeta() {

  document.getElementById('hubSubtitle').innerText =
    uiText.subtitle || formatHeaderMeta();
}

function startHeaderClock() {

  clearInterval(headerClockTimer);
  updateHeaderMeta();

  headerClockTimer = setInterval(
    updateHeaderMeta,
    1000
  );
}

function getTokenExpirationMs(token) {

  try {
    const payload = JSON.parse(
      atob(
        String(token || '')
          .split('.')[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/')
      )
    );

    return Number(payload.exp) * 1000;

  } catch (e) {
    return 0;
  }
}

function formatSessionCountdown(ms) {

  const totalSeconds = Math.max(
    0,
    Math.ceil(ms / 1000)
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateSessionWarningText() {

  const remaining =
    sessionExpiresAt - Date.now();

  document
    .getElementById('sessionWarningText')
    .innerText =
      `Сесія завершиться через ${formatSessionCountdown(remaining)}`;
}

function clearSessionTimers() {

  clearTimeout(sessionTimer);
  clearTimeout(sessionExpireTimer);
  clearInterval(sessionCountdownTimer);
}

function expireSession() {

  sessionExpired = true;
  authToken = null;

  clearSessionTimers();
  clearSharedAuthToken();

  document
    .getElementById('sessionWarning')
    .classList.add('hidden');

  document
    .getElementById('sessionExpired')
    .classList.remove('hidden');

  document.body.classList.add('session-locked');
}

function startSessionTimer(token) {

  clearSessionTimers();

  sessionExpired = false;
  sessionExpiresAt =
    getTokenExpirationMs(token) ||
    Date.now() + 55 * 60 * 1000;

  document.body.classList.remove('session-locked');

  document
    .getElementById('sessionWarning')
    .classList.add('hidden');

  document
    .getElementById('sessionExpired')
    .classList.add('hidden');

  updateSessionWarningText();

  const remainingMs =
    sessionExpiresAt - Date.now();

  if (remainingMs <= 0) {
    expireSession();
    return;
  }

  sessionTimer = setTimeout(() => {

    updateSessionWarningText();

    document
      .getElementById('sessionWarning')
      .classList.remove('hidden');

    sessionCountdownTimer = setInterval(
      updateSessionWarningText,
      1000
    );

  }, Math.max(0, remainingMs - 5 * 60 * 1000));

  sessionExpireTimer = setTimeout(
    expireSession,
    remainingMs
  );
}

function renewSession() {

  authToken = null;
  sessionExpired = false;

  clearSessionTimers();
  clearSharedAuthToken();

  document.body.classList.remove('session-locked');

  document
    .getElementById('sessionWarning')
    .classList.add('hidden');

  document
    .getElementById('sessionExpired')
    .classList.add('hidden');

  document
    .getElementById('logoutBtn')
    .classList.add('hidden');

  showOnly('loginBlock');
}

function resetSessionUi() {

  sessionExpired = false;

  clearSessionTimers();

  document.body.classList.remove('session-locked');

  document
    .getElementById('sessionWarning')
    .classList.add('hidden');

  document
    .getElementById('sessionExpired')
    .classList.add('hidden');
}

function escapeHtml(value) {

  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSharedAuthToken() {

  try {
    return sessionStorage.getItem(SHARED_AUTH_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

function setSharedAuthToken(token) {

  try {
    sessionStorage.setItem(SHARED_AUTH_TOKEN_KEY, token);
  } catch (e) {
    console.error(e);
  }
}

function clearSharedAuthToken() {

  try {
    sessionStorage.removeItem(SHARED_AUTH_TOKEN_KEY);
  } catch (e) {
    console.error(e);
  }
}

function showOnly(blockId) {

  [
    'loginBlock',
    'loader',
    'appsBlock',
    'emptyBlock'
  ].forEach(id => {
    document
      .getElementById(id)
      .classList.toggle('hidden', id !== blockId);
  });
}

function applyUi(ui) {

  if (!ui) {
    return;
  }

  uiText = {
    ...uiText,
    ...ui
  };

  document.title = ui.title || 'Hub';

  document.getElementById('hubTitle').innerText =
    ui.title || 'Hub';

  startHeaderClock();

  document.getElementById('loginTitle').innerText =
    ui.loginTitle || 'Sign in';

  document.querySelector('.section-title').innerText =
    ui.appsTitle || 'Apps';

  document.getElementById('emptyTitle').innerText =
    ui.emptyTitle || 'No access';

  document.getElementById('emptyIcon').innerText =
    ui.emptyIcon || '';

  document.getElementById('emptyText').innerText =
    ui.emptyText || '';

  document.getElementById('logoutBtn').innerText =
    ui.logout || 'Exit';
}

function showToast(message) {

  const toast = document.getElementById('toast');

  toast.innerText = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

async function hubApi(action, data = {}) {

  if (sessionExpired) {
    throw new Error('AUTH_REQUIRED');
  }

  const formData = new URLSearchParams();

  formData.append(
    'payload',
    JSON.stringify({
      token: authToken,
      action,
      data
    })
  );

  const response = await fetch(HUB_API_URL, {
    method: 'POST',
    body: formData
  });

  return response.json();
}

function renderApps(apps) {

  const appsList = document.getElementById('appsList');

  appsList.innerHTML = apps
    .map(app => `
      <a class="app-card" href="${escapeHtml(app.url)}">
        <div>
          <h2>${escapeHtml(app.title)}</h2>
        </div>
      </a>
    `)
    .join('');
}

async function loadAllowedApps() {

  showOnly('loader');

  const result = await hubApi('getApps');

  if (result.error === 'AUTH_REQUIRED') {
    throw new Error('AUTH_REQUIRED');
  }

  if (!result.success) {
    throw new Error(result.error || 'ACCESS_CHECK_FAILED');
  }

  applyUi(result.data.ui);

  const allowedApps = result.data.apps || [];

  document
    .getElementById('logoutBtn')
    .classList.remove('hidden');

  if (!allowedApps.length) {
    showOnly('emptyBlock');
    return;
  }

  renderApps(allowedApps);
  showOnly('appsBlock');
}

async function handleCredentialResponse(response) {

  authToken = response.credential;
  setSharedAuthToken(authToken);
  startSessionTimer(authToken);

  try {
    await loadAllowedApps();
  } catch (e) {
    console.error(e);
    resetSessionUi();
    clearSharedAuthToken();
    showOnly('loginBlock');
    showToast(uiText.accessError);
  }
}

async function tryExistingSession() {

  const token = getSharedAuthToken();

  if (!token) {
    showOnly('loginBlock');
    return;
  }

  authToken = token;
  startSessionTimer(authToken);

  try {
    await loadAllowedApps();
  } catch (e) {
    console.error(e);
    authToken = null;
    resetSessionUi();
    clearSharedAuthToken();
    showOnly('loginBlock');
  }
}

document
  .getElementById('logoutBtn')
  .addEventListener('click', () => {
    authToken = null;
    sessionExpired = false;
    clearSessionTimers();
    clearSharedAuthToken();

    document
      .getElementById('logoutBtn')
      .classList.add('hidden');

    showOnly('loginBlock');
  });

document
  .getElementById('renewWarningBtn')
  .addEventListener('click', renewSession);

document
  .getElementById('renewSessionBtn')
  .addEventListener('click', renewSession);

startHeaderClock();
tryExistingSession();
