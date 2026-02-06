class HashyApiClient {
  constructor() {
    this.baseURL = '/hmx_api/ai';
    this._initializeAuth();
  }

  _initializeAuth() {
    if (typeof window !== 'undefined' && window.HashyAuthHelper) {
      const storedTokens = this._getStoredTokens();
      if (storedTokens.accessToken && storedTokens.refreshToken) {
        window.HashyAuthHelper.setTokens(
          storedTokens.accessToken,
          storedTokens.refreshToken,
          storedTokens.expiresIn
        );
      }
    }
  }

  _getStoredTokens() {
    try {
      const tokens = sessionStorage.getItem('hashy_tokens');
      return tokens ? JSON.parse(tokens) : {};
    } catch {
      return {};
    }
  }

  _storeTokens(accessToken, refreshToken, expiresIn) {
    try {
      sessionStorage.setItem(
        'hashy_tokens',
        JSON.stringify({
          accessToken,
          refreshToken,
          expiresIn,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn('Failed to store tokens:', error);
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';

    if (method.toUpperCase() === 'GET') {
      const params = options.params || {};

      if (!params.context) {
        params.context = {
          allowed_company_ids: [1],
          company_id: 1,
        };
      }

      try {
        const response = await window.HashyAuthHelper.makeAuthenticatedRequest(url, {
          method: 'GET',
          body: params,
          headers: {
            'X-CSRFToken': this.getCSRFToken(),
          },
        });
        return response;
      } catch (error) {
        console.error('API request failed:', error);
        this._handleApiError(error);
        throw error;
      }
    } else if (method.toUpperCase() === 'DELETE') {
      try {
        const response = await window.HashyAuthHelper.makeAuthenticatedRequest(url, {
          method: 'DELETE',
          body: {},
          headers: {
            'X-CSRFToken': this.getCSRFToken(),
          },
        });
        return response;
      } catch (error) {
        console.error('API request failed:', error);
        this._handleApiError(error);
        throw error;
      }
    } else {
      const isFormData = options.body instanceof FormData;

      const defaultOptions = {
        headers: isFormData
          ? {
              'X-CSRFToken': this.getCSRFToken(),
            }
          : {
              'Content-Type': 'application/json',
              'X-CSRFToken': this.getCSRFToken(),
            },
        credentials: 'same-origin',
      };

      const finalOptions = { ...defaultOptions, ...options };

      if (!isFormData && finalOptions.body && typeof finalOptions.body === 'object') {
        finalOptions.body = JSON.stringify(finalOptions.body);
      }

      try {
        const response = await window.HashyAuthHelper.makeAuthenticatedRequest(url, {
          method: method,
          body: finalOptions.body || {},
          headers: finalOptions.headers,
        });

        if (!response) {
          throw new Error('Request failed');
        }

        return response;
      } catch (error) {
        console.error('API request failed:', error);
        this._handleApiError(error);
        throw error;
      }
    }
  }

  _handleApiError(error) {
    if (typeof handleFetchError === 'function') {
      handleFetchError(error);
    } else {
      let errorMessage = 'An error occurred';

      if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      if (typeof MessagePopup === 'function') {
        MessagePopup('API Error', errorMessage);
      } else {
        alert(`API Error: ${errorMessage}`);
      }
    }
  }

  getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return value;
      }
    }
    return '';
  }

  getActiveViewData() {
    try {
      if (typeof useLayoutStore === 'undefined') {
        return { view_type: 'no_layout_store' };
      }

      const layoutStore = useLayoutStore();
      const action = layoutStore.state?.action || {};
      const activeMode = action.activeMode || 'unknown';
      const selectedRecords = layoutStore.selectedRecord || {};
      const currentRecordsIds = layoutStore.currentListRecordsIds || [];
      const filters = layoutStore.filters || {};
      const groups = layoutStore.groups || {};

      const selectedRecordIds = Object.keys(selectedRecords)
        .filter(key => key !== 'all_checked' && selectedRecords[key])
        .map(key => parseInt(key))
        .filter(id => !isNaN(id));

      const activeFilterKeys = Object.keys(filters).filter(key => filters[key]?.active);
      const activeGroupKeys = Object.keys(groups).filter(key => groups[key]?.active);

      const baseData = {
        view_type: activeMode,
        action_id: action.id,
        model: action.model,
        active_id: action.activeId,
        selected_record_ids: selectedRecordIds,
        filter_keys: activeFilterKeys,
        group_keys: activeGroupKeys,
        all_selected: !!selectedRecords.all_checked,
        domain: action.domain,
        context: action.context,
        limit: action.limit,
      };

      if (activeMode === 'kanban' && currentRecordsIds.length === 0) {
        baseData.needs_backend_fetch = true;
      } else {
        baseData.records_ids = currentRecordsIds.slice(0, 20);
      }

      return baseData;
    } catch (error) {
      return { view_type: 'error', error: error.message };
    }
  }

  getPageContext() {
    const context = {};

    try {
      context.base_url = window.location.origin;

      const allowedCompanyIds = sessionStorage.getItem('allowed_company_ids');
      const lastClickedCompanyId = sessionStorage.getItem('last_clicked_company_id');
      if (allowedCompanyIds) {
        const companyIds = JSON.parse(allowedCompanyIds);
        context.active_companies = companyIds;
        context.active_company_id = lastClickedCompanyId
          ? parseInt(lastClickedCompanyId)
          : companyIds.length > 0
            ? companyIds[companyIds.length - 1]
            : null;
      }

      const allowedBranchIds = sessionStorage.getItem('allowed_branch_ids');
      if (allowedBranchIds) {
        context.active_branches = JSON.parse(allowedBranchIds);
      }

      if (typeof useEnvStore !== 'undefined') {
        const envStore = useEnvStore();
        context.user_id = envStore.identity.id;
        context.database_name = envStore.session.dbAlias;
      }

      const hash = window.location.hash || '';
      if (hash && typeof useActionStateUrl !== 'undefined') {
        const actionState = useActionStateUrl();
        context.active_page_context = {
          action_id: actionState.actionStateUrl.actionId,
          active_id: actionState.actionStateUrl.activeId,
          active_mode: actionState.actionStateUrl.activeMode,
          full_hash: hash,
          view_data: this.getActiveViewData(),
        };
      }
    } catch (error) {
      console.error('[HashyApiClient] Error collecting context:', error);
    }

    return context;
  }

  async sendChatMessage(
    message,
    sessionId = null,
    files = [],
    externalEmployeeId = null,
    contextMentioned = null
  ) {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append('message', message);

      const context = this.getPageContext();
      formData.append('context', JSON.stringify(context));

      if (sessionId) {
        formData.append('session_id', String(sessionId));
      }
      if (externalEmployeeId) {
        formData.append('external_employee_id', externalEmployeeId);
      }
      if (contextMentioned) {
        formData.append('context_mentioned', contextMentioned);
      }

      files.forEach(fileObj => {
        const actualFile = fileObj.file || fileObj;
        if (actualFile instanceof File) {
          formData.append('files', actualFile);
        }
      });

      try {
        return await this.makeRequest('/chat', {
          method: 'POST',
          body: formData,
        });
      } catch (error) {
        console.error('Chat message with files failed:', error);
        throw error;
      }
    } else {
      const payload = {
        message,
        context: this.getPageContext(),
      };
      if (sessionId) payload.session_id = String(sessionId);
      if (externalEmployeeId) payload.external_employee_id = externalEmployeeId;
      if (contextMentioned) payload.context_mentioned = contextMentioned;

      try {
        return await this.makeRequest('/chat', {
          method: 'POST',
          body: payload,
        });
      } catch (error) {
        console.error('Chat message failed:', error);
        throw error;
      }
    }
  }

  async getSessionList(externalEmployeeId = null, status = 'active') {
    const params = {};
    if (externalEmployeeId) params.external_employee_id = externalEmployeeId;
    if (status) params.status = status;

    return this.makeRequest('/sessions', {
      method: 'GET',
      params: params,
    });
  }

  async getSessionDetail(sessionId) {
    return this.makeRequest(`/sessions/${sessionId}`, { method: 'GET' });
  }

  async getSessionHistory(externalEmployeeId = null) {
    return this.getSessionList(externalEmployeeId, null);
  }

  async getSessions(limit = 15, offset = 0) {
    const params = { limit, offset };
    return this.makeRequest('/sessions', {
      method: 'GET',
      params: params,
    });
  }

  async deleteSession(sessionId) {
    return this.makeRequest(`/sessions/${sessionId}/delete`, { method: 'POST' });
  }

  async renameSession(sessionId, newName) {
    return this.makeRequest(`/sessions/${sessionId}/rename`, {
      method: 'POST',
      body: { name: newName },
    });
  }

  async authenticateWithHashy(credentials) {
    try {
      const response = await this.makeRequest('/hashy_login', {
        method: 'POST',
        body: credentials,
      });

      if (response && response.access && response.refresh) {
        this._storeTokens(response.access, response.refresh, 3600);

        if (window.HashyAuthHelper) {
          window.HashyAuthHelper.setTokens(response.access, response.refresh, 3600);
        }
      }

      return response;
    } catch (error) {
      console.error('Hashy authentication failed:', error);
      throw error;
    }
  }

  clearAuthTokens() {
    try {
      sessionStorage.removeItem('hashy_tokens');
      if (window.HashyAuthHelper) {
        window.HashyAuthHelper.clearAuth();
      }
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  }
}

if (typeof window !== 'undefined') {
  window.HashyAPIClient = new HashyApiClient();
}
