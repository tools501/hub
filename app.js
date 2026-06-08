const GOOGLE_CLIENT_ID =
  '758097653129-i5cda00k5b73uudvmmalj2jdvk70t5jr.apps.googleusercontent.com';

const HUB_API_URL =
  'https://script.google.com/macros/s/AKfycbyAHpUfM1RrPJbamCVcc5rGhUgRKoLRKSULBGnCNGLyCSaFU5lp7SX2Ge1Wwv9YEV5-Sg/exec';

const SHARED_AUTH_TOKEN_KEY = 'tools501_google_id_token';

let authToken = null;

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

function showToast(message) {

  const toast = document.getElementById('toast');

  toast.innerText = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

async function hubApi(action, data = {}) {

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
      <a class="app-card" href="${app.url}">
        <div>
          <h2>${app.title}</h2>
        </div>
        <span>Відкрити</span>
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

  try {
    await loadAllowedApps();
  } catch (e) {
    console.error(e);
    clearSharedAuthToken();
    showOnly('loginBlock');
    showToast('Не вдалося перевірити доступ');
  }
}

async function tryExistingSession() {

  const token = getSharedAuthToken();

  if (!token) {
    showOnly('loginBlock');
    return;
  }

  authToken = token;

  try {
    await loadAllowedApps();
  } catch (e) {
    console.error(e);
    authToken = null;
    clearSharedAuthToken();
    showOnly('loginBlock');
  }
}

document
  .getElementById('logoutBtn')
  .addEventListener('click', () => {
    authToken = null;
    clearSharedAuthToken();

    document
      .getElementById('logoutBtn')
      .classList.add('hidden');

    showOnly('loginBlock');
  });

tryExistingSession();
