const POSITION_BY_ROLE = { admin: 'Business Owner', staff: 'Station Staff' };

function setupProfile(user) {
  const name = user.full_name || user.username;
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Staff';
  const initial = name.trim().charAt(0).toUpperCase();

  document.getElementById('profileAvatar').textContent = initial;
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRoleBadge').textContent = roleLabel;
  document.getElementById('profileModalAvatar').textContent = initial;
  document.getElementById('profileModalName').textContent = name;
  document.getElementById('profileAccountType').textContent = roleLabel;
  document.getElementById('profilePosition').textContent = POSITION_BY_ROLE[user.role] || roleLabel;
  document.getElementById('profileUsername').textContent = user.username;

  document.getElementById('profileOpenBtn').addEventListener('click', () => {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('profileModal')).show();
  });

  document.getElementById('profileLogoutBtn').addEventListener('click', logout);
}