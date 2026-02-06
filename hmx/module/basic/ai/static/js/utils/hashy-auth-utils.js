const hashyAuthUtils = {
  initializeAuth: function (credentials) {
    if (!window.HashyAPIClient) {
      console.error('HashyAPIClient not available');
      return Promise.reject(new Error('API client not available'));
    }

    if (credentials && credentials.phone && credentials.secret_key) {
      return window.HashyAPIClient.authenticateWithHashy(credentials);
    }

    return Promise.resolve();
  },

  ensureAuthenticated: function () {
    if (!window.HashyAuthHelper) {
      console.warn('HashyAuthHelper not available');
      return false;
    }

    const tokenManager = window.HashyAuthHelper.getTokenManager();
    return tokenManager.getAccessToken() && !tokenManager.isTokenExpired();
  },

  refreshTokenIfNeeded: function () {
    if (!window.HashyAuthHelper) {
      return Promise.resolve();
    }

    const tokenManager = window.HashyAuthHelper.getTokenManager();

    if (tokenManager.isTokenExpired() && tokenManager.refreshToken) {
      return tokenManager.refreshAccessToken().catch(function (error) {
        console.warn('Token refresh failed:', error);
        return null;
      });
    }

    return Promise.resolve();
  },

  clearAuthentication: function () {
    if (window.HashyAPIClient) {
      window.HashyAPIClient.clearAuthTokens();
    }
  },

  getAuthStatus: function () {
    if (!window.HashyAuthHelper) {
      return { authenticated: false, reason: 'Helper not available' };
    }

    const tokenManager = window.HashyAuthHelper.getTokenManager();
    const hasToken = !!tokenManager.getAccessToken();
    const isExpired = tokenManager.isTokenExpired();

    return {
      authenticated: hasToken && !isExpired,
      hasToken: hasToken,
      isExpired: isExpired,
      hasRefreshToken: !!tokenManager.refreshToken,
    };
  },

  handleAuthError: function (error, layout) {
    const authStatus = this.getAuthStatus();

    if (!authStatus.authenticated) {
      this.clearAuthentication();

      if (layout && typeof layout.showNotif === 'function') {
        layout.showNotif({
          type: 'error',
          message: 'Session expired. Please refresh the page.',
          timeout: 5000,
        });
      }
    }

    return authStatus;
  },
};

window.HashyAuthUtils = hashyAuthUtils;
