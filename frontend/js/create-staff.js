const staffForm = document.getElementById('staffForm');
const staffFormError = document.getElementById('staffFormError');
const staffSaveBtn = document.getElementById('staffSaveBtn');
const togglePassword = document.getElementById('togglePassword');

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;

const BACKEND_FIELD_HINTS = [
  [/passwords do not match/i, 'confirm_password'],
  [/password/i, 'password'],
  [/full name/i, 'full_name'],
  [/username/i, 'username'],
  [/account status/i, 'account_status']
];

function setError(name, message) {
  const holder = staffForm.querySelector('[data-error-for="' + name + '"]');
  if (holder) {
    holder.textContent = message || '';
    holder.classList.toggle('d-block', Boolean(message));
  }
  const control = staffForm.elements[name];
  if (control && control.classList) {
    control.classList.toggle('is-invalid', Boolean(message));
  }
}

function clearErrors() {
  staffForm.querySelectorAll('[data-error-for]').forEach((holder) => setError(holder.dataset.errorFor, ''));
  staffFormError.classList.add('d-none');
}

function readStaffForm() {
  const f = staffForm.elements;
  return {
    full_name: f.full_name.value.trim(),
    username: f.username.value.trim(),
    password: f.password.value,
    confirm_password: f.confirm_password.value,
    account_status: f.account_status.value
  };
}

function validateStaff(values) {
  const errors = {};

  if (!values.full_name) {
    errors.full_name = 'Enter the full name.';
  } else if (values.full_name.length > 120) {
    errors.full_name = 'The name must be 120 characters or fewer.';
  }

  if (!USERNAME_PATTERN.test(values.username)) {
    errors.username = 'Use 3 to 50 letters, numbers or underscores.';
  }

  const passwordBytes = new TextEncoder().encode(values.password).length;
  if (passwordBytes < 8 || passwordBytes > 72) {
    errors.password = 'The password must be 8 to 72 characters.';
  }

  if (values.confirm_password !== values.password) {
    errors.confirm_password = 'The passwords do not match.';
  }

  return errors;
}

function showErrors(errors) {
  const names = Object.keys(errors);
  names.forEach((name) => setError(name, errors[name]));
  staffForm.elements[names[0]].focus();
}

function showBackendError(error) {
  if (error.status === 401) {
    window.location.replace('login.html');
    return;
  }

  const hint = BACKEND_FIELD_HINTS.find(([pattern]) => pattern.test(error.message));
  if (hint) {
    setError(hint[1], error.message);
    return;
  }

  staffFormError.textContent = error.message;
  staffFormError.classList.remove('d-none');
}

togglePassword.addEventListener('click', () => {
  const showing = staffForm.elements.password.type === 'text';
  const type = showing ? 'password' : 'text';
  staffForm.elements.password.type = type;
  staffForm.elements.confirm_password.type = type;
  togglePassword.textContent = showing ? 'Show' : 'Hide';
  togglePassword.setAttribute('aria-label', showing ? 'Show passwords' : 'Hide passwords');
});

staffForm.addEventListener('input', (event) => {
  if (event.target.name) {
    setError(event.target.name, '');
  }
});

staffForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const values = readStaffForm();
  const errors = validateStaff(values);

  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    return;
  }

  setButtonLoading(staffSaveBtn, true, 'Creating...');

  try {
    await api.post('/users/create-staff.php', values);
    sessionStorage.setItem('inksyncFlash', 'Staff account created for ' + values.full_name + '.');
    window.location.href = 'dashboard.html#users';
  } catch (error) {
    showBackendError(error);
    setButtonLoading(staffSaveBtn, false);
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

async function initCreateStaff() {
  const user = await requireAuth();
  if (!user) {
    return;
  }
  if (user.role !== 'admin') {
    window.location.replace('dashboard.html');
    return;
  }
  document.getElementById('app').classList.remove('invisible');
  staffForm.elements.full_name.focus();
}

initCreateStaff();