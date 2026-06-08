const GOOGLE_CLIENT_ID =
  '758097653129-i5cda00k5b73uudvmmalj2jdvk70t5jr.apps.googleusercontent.com';

const SHARED_AUTH_TOKEN_KEY = 'tools501_google_id_token';

const APPS = [
  {
    id: 'delivery',
    title: 'Delivery',
    description: 'Work requests and status dashboard',
    url: '/delivery/',
    apiUrl: 'https://script.google.com/macros/s/AKfycbz7tPrVsKyZ85-ga8iplEC7hZ-Uhg6cUIGjnEkO-aN6IAhtrrRyzU7CT8xlKrhInyal/exec'
  }
];

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

async function callAppAuth(app) {

  const formData = new URLSearchParams();

  formData.append(
    'payload',
    JSON.stringify({
      token: authToken,
      action: 'auth',
      data: {}
    })
  );

  const response = await fetch(app.apiUrl, {
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
          <p>${app.description}</p>
        </div>
        <span>Відкрити</span>
      </a>
    `)
    .join('');
}

async function loadAllowedApps() {

  showOnly('loader');

  const checks = await Promise.allSettled(
    APPS.map(async app => {
      const result = await callAppAuth(app);

      if (result.error === 'AUTH_REQUIRED') {
        throw new Error('AUTH_REQUIRED');
      }

      if (!result.success) {
        return null;
      }

      return app;
    })
  );

  const allowedApps = checks
    .filter(item => item.status === 'fulfilled' && item.value)
    .map(item => item.value);

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
