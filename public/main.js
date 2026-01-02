let token = null;

const out = document.getElementById('out');

function show(obj) {
  out.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers || {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (!res.ok) throw json;
    return json;
  } catch {
    if (!res.ok) throw new Error(text);
    return text;
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ provider: 'password', email, password }),
    });
    token = data.token;
    show(data);
  } catch (e) {
    show(e);
  }
});

document.getElementById('meBtn').addEventListener('click', async () => {
  try {
    show(await api('/auth/user'));
  } catch (e) {
    show(e);
  }
});

document.getElementById('booksBtn').addEventListener('click', async () => {
  try {
    show(await api('/books'));
  } catch (e) {
    show(e);
  }
});

document.getElementById('printHistoryBtn').addEventListener('click', async () => {
  try {
    show(await api('/print/history'));
  } catch (e) {
    show(e);
  }
});
