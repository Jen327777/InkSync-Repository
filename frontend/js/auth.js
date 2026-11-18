let currentUser = null;

async function fetchCurrentUser() {
  try {
    const data = await api.get('/authentication/me.php');
    currentUser = data.user;
    return currentUser;
  } catch (error) {
    if (error.status === 401) {
      currentUser = null;
      return null;
    }
    throw error;
  }
}

async function requireAuth() {
  try {
    const user = await fetchCurrentUser();
    if (!user) {
      window.location.replace('login.html');
      return null;
    }
    return user;
  } catch (error) {
    const box = document.getElementById('pageError');
    box.textContent = error.message;
    box.classList.remove('d-none');
    return null;
  }
}

async function logout() {
  try {
    await api.post('/authentication/logout.php', {});
  } catch (error) {
    currentUser = null;
  }
  window.location.replace('login.html');
}