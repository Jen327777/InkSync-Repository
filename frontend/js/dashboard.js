const adminSections = ['revenue', 'users'];

function setupNavigation(user) {
  const links = document.querySelectorAll('#sidebar [data-section]');
  const sections = document.querySelectorAll('main section');
  const pageTitle = document.getElementById('pageTitle');
  const sidebar = document.getElementById('sidebar');

  document.getElementById('userRole').textContent = user.role === 'admin' ? 'Admin' : 'Staff';

  if (user.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach((item) => item.classList.remove('d-none'));
  }

  function showSection(name) {
    if (adminSections.includes(name) && user.role !== 'admin') {
      return;
    }
    sections.forEach((section) => section.classList.toggle('d-none', section.id !== 'section-' + name));
    links.forEach((link) => link.classList.toggle('active', link.dataset.section === name));
    pageTitle.textContent = document.getElementById('section-' + name).dataset.title;
  }

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showSection(link.dataset.section);
      const panel = bootstrap.Offcanvas.getInstance(sidebar);
      if (panel) {
        panel.hide();
      }
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function initDashboard() {
  const user = await requireAuth();
  if (!user) {
    return;
  }
  setupNavigation(user);
  document.getElementById('app').classList.remove('invisible');
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

initDashboard();