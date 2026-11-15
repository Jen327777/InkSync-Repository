const API_TIMEOUT_MS = 10000;

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiRequest(path, options = {}) {
  const { method = 'GET', body, headers = {}, onLoading } = options;

  const config = {
    method,
    headers: { Accept: 'application/json', ...headers },
    credentials: 'include'
  };

  if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  config.signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  if (onLoading) {
    onLoading(true);
  }

  try {
    const response = await fetch(API_BASE_URL + path, config);
    const text = await response.text();

    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new ApiError('The server sent an invalid response.', response.status, null);
      }
    }

    if (!response.ok) {
      const message = (data && data.message) || 'Request failed (' + response.status + ').';
      throw new ApiError(message, response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please try again.', 0, null);
    }
    throw new ApiError('Cannot reach the server. Check that XAMPP is running.', 0, null);
  } finally {
    clearTimeout(timer);
    if (onLoading) {
      onLoading(false);
    }
  }
}

const api = {
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiRequest(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => apiRequest(path, { ...options, method: 'DELETE' })
};

function setButtonLoading(button, isLoading, loadingText = 'Please wait...') {
  if (isLoading) {
    button.dataset.label = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}