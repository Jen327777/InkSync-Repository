const role = sessionStorage.getItem('inksyncRole');

if (!role) {
  window.location.replace('login.html');
} else {
  document.getElementById('userRole').textContent = role === 'admin' ? 'Admin' : 'Staff';

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('inksyncRole');
    sessionStorage.removeItem('inksyncUser');
    window.location.href = 'login.html';
  });
}