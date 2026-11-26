const adminBtn = document.getElementById('adminBtn');
const staffBtn = document.getElementById('staffBtn');
const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const errorBox = document.getElementById('loginError');
const submitBtn = form.querySelector('button[type="submit"]');

let selectedRole = null;

function selectRole(role) {
  selectedRole = role;
  adminBtn.classList.toggle('active', role === 'admin');
  staffBtn.classList.toggle('active', role === 'staff');
  adminBtn.setAttribute('aria-pressed', role === 'admin');
  staffBtn.setAttribute('aria-pressed', role === 'staff');
  errorBox.textContent = '';
}

function setFormBusy(busy) {
  [usernameInput, passwordInput, togglePassword, adminBtn, staffBtn].forEach((element) => {
    element.disabled = busy;
  });
  setButtonLoading(submitBtn, busy, 'Signing in...');
}

adminBtn.addEventListener('click', () => selectRole('admin'));
staffBtn.addEventListener('click', () => selectRole('staff'));

togglePassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  togglePassword.textContent = showing ? 'Show' : 'Hide';
  togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

[usernameInput, passwordInput].forEach((input) => {
  input.addEventListener('input', () => {
    input.classList.remove('is-invalid');
    errorBox.textContent = '';
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  usernameInput.classList.toggle('is-invalid', !username);
  passwordInput.classList.toggle('is-invalid', !password);

  if (!selectedRole) {
    errorBox.textContent = 'Choose Admin Access or Staff Access first.';
    return;
  }

  if (!username || !password) {
    errorBox.textContent = 'Enter your username and password.';
    return;
  }

  setFormBusy(true);

  try {
    const data = await api.post('/authentication/login.php', { username, password });
    const actualRole = data.user.role;

    if (actualRole !== selectedRole) {
      await api.post('/authentication/logout.php', {}).catch(() => {});
      const label = actualRole === 'admin' ? 'Admin' : 'Staff';
      throw new ApiError('This account has ' + label + ' access. Choose ' + label + ' Access instead.', 403, null);
    }

    window.location.href = 'dashboard.html';
  } catch (error) {
    errorBox.textContent = error.status === 401 ? 'Invalid username or password.' : error.message;
    setFormBusy(false);
    passwordInput.value = '';
    passwordInput.focus();
  }
});

fetchCurrentUser()
  .then((user) => {
    if (user) {
      window.location.replace('dashboard.html');
    }
  })
  .catch(() => {});

const loginNotice = document.getElementById('loginNotice');
const pendingNotice = sessionStorage.getItem('inksyncLoginNotice');

if (pendingNotice) {
  sessionStorage.removeItem('inksyncLoginNotice');
  loginNotice.textContent = pendingNotice;
  loginNotice.classList.remove('d-none');
}