const adminBtn = document.getElementById('adminBtn');
const staffBtn = document.getElementById('staffBtn');
const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const errorBox = document.getElementById('loginError');

let selectedRole = null;

function selectRole(role) {
  selectedRole = role;
  adminBtn.classList.toggle('active', role === 'admin');
  staffBtn.classList.toggle('active', role === 'staff');
  adminBtn.setAttribute('aria-pressed', role === 'admin');
  staffBtn.setAttribute('aria-pressed', role === 'staff');
  errorBox.textContent = '';
}

adminBtn.addEventListener('click', () => selectRole('admin'));
staffBtn.addEventListener('click', () => selectRole('staff'));

togglePassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  togglePassword.textContent = showing ? 'Show' : 'Hide';
  togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  errorBox.textContent = '';

  if (!selectedRole) {
    errorBox.textContent = 'Choose Admin Access or Staff Access first.';
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    errorBox.textContent = 'Enter your username and password.';
    return;
  }

  sessionStorage.setItem('inksyncRole', selectedRole);
  sessionStorage.setItem('inksyncUser', username);
  window.location.href = 'dashboard.html';
});