class HashyTokenManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.refreshPromise = null;
    this.isRefreshing = false;
  }

  setTokens(accessToken, refreshToken, expiresIn = 3600) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + expiresIn * 1000;
  }

  getAccessToken() {
    return this.accessToken;
  }

  isTokenExpired() {
    if (!this.tokenExpiry) return false;
    return Date.now() >= this.tokenExpiry - 300000;
  }

  async refreshAccessToken() {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  async _performRefresh() {
    const data = await useFetch(
      '/hmx_api/ai/auth/refresh',
      {
        refreshToken: this.refreshToken,
      },
      {
        method: 'POST',
      }
    );

    if (data.status && data.data) {
      this.setTokens(
        data.data.accessToken || data.data.token,
        data.data.refreshToken || this.refreshToken,
        data.data.expiresIn || 3600
      );
      return data.data;
    }

    throw new Error('Invalid refresh response');
  }

  _getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return value;
      }
    }
    return '';
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }
}

class HashyAuthHelper {
  constructor() {
    this.tokenManager = new HashyTokenManager();
    this.pendingRequests = new Map();
  }

  async makeAuthenticatedRequest(url, options = {}) {
    let requestKey = `${options.method || 'GET'}_${url}`;

    let bodyObj = null;
    if (options.body) {
      if (typeof options.body === 'string') {
        try {
          bodyObj = JSON.parse(options.body);
        } catch (e) {
          bodyObj = null;
        }
      } else if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
        bodyObj = options.body;
      }
    }

    if (bodyObj && bodyObj.session_id) {
      requestKey += `_session_${bodyObj.session_id}`;
    }

    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }

    const requestPromise = this._executeRequest(url, options);
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  async _executeRequest(url, options, retryCount = 0) {
    if (this.tokenManager.isTokenExpired() && this.tokenManager.refreshToken) {
      try {
        await this.tokenManager.refreshAccessToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }

    const headers = { ...options.headers };
    if (this.tokenManager.getAccessToken()) {
      headers['Authorization'] = `Bearer ${this.tokenManager.getAccessToken()}`;
    }

    const requestOptions = {
      ...options,
      headers,
    };

    try {
      let response;
      const isFormData = requestOptions.body instanceof FormData;

      if (requestOptions.method?.toUpperCase() === 'GET') {
        response = await useFetch(url, requestOptions.body || {}, { method: 'GET' });
      } else if (isFormData) {
        const formDataObj = {};
        for (let [key, value] of requestOptions.body.entries()) {
          if (formDataObj[key]) {
            if (Array.isArray(formDataObj[key])) {
              formDataObj[key].push(value);
            } else {
              formDataObj[key] = [formDataObj[key], value];
            }
          } else {
            formDataObj[key] = value;
          }
        }
        response = await useFetchFormData(url, formDataObj, {
          method: requestOptions.method || 'POST',
        });
      } else {
        response = await useFetch(url, requestOptions.body || {}, {
          method: requestOptions.method || 'POST',
        });
      }

      return response;
    } catch (error) {
      if (this._isTokenError(error) && retryCount === 0 && this.tokenManager.refreshToken) {
        try {
          await this.tokenManager.refreshAccessToken();
          return this._executeRequest(url, options, retryCount + 1);
        } catch (refreshError) {
          this._handleAuthError(refreshError);
          throw refreshError;
        }
      }

      if (this._isTokenError(error)) {
        this._handleAuthError(error);
      }

      throw error;
    }
  }

  _isTokenError(error) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return true;
    }

    if (error?.status === 401 || error?.status === 403) {
      return true;
    }

    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('token') ||
      errorMessage.includes('expired')
    );
  }

  _handleAuthError(error) {
    this.tokenManager.clearTokens();

    if (typeof window !== 'undefined' && window.location) {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        console.warn('Authentication failed, redirecting to login');
      }
    }
  }

  setTokens(accessToken, refreshToken, expiresIn) {
    this.tokenManager.setTokens(accessToken, refreshToken, expiresIn);
  }

  getTokenManager() {
    return this.tokenManager;
  }

  clearAuth() {
    this.tokenManager.clearTokens();
    this.pendingRequests.clear();
  }
}

if (typeof window !== 'undefined') {
  window.HashyAuthHelper = new HashyAuthHelper();
}
