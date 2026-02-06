const hashyApiUtils = {
  sendChatMessage: function (messageText, sessionId, files, options) {
    options = options || {};

    if (!window.HashyAPIClient) {
      return Promise.reject(new Error('API client not available'));
    }

    return window.HashyAPIClient.sendChatMessage(
      messageText,
      sessionId,
      files || [],
      options.externalEmployeeId || null,
      options.contextMentioned || null
    );
  },

  loadSessionMessages: function (sessionId, offset) {
    if (!window.HashyAPIClient || !sessionId) {
      return Promise.resolve({ success: false, messages: [] });
    }

    return window.HashyAPIClient.getSessionDetail(sessionId)
      .then(function (response) {
        if (response.success && Array.isArray(response.messages)) {
          return {
            success: true,
            messages: response.messages,
            offset: offset || 0,
          };
        }
        return { success: false, messages: [] };
      })
      .catch(function (error) {
        console.error('Failed to load session messages:', error);
        return { success: false, messages: [], error: error };
      });
  },

  handleApiError: function (error, layout, options) {
    options = options || {};

    var errorMessage = 'Failed to send message. Please try again.';
    var errorTitle = 'Chat Error';

    if (error?.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    if (error?.response?.status === 401 || error?.response?.status === 403) {
      errorTitle = 'Session Expired';
      errorMessage = 'Your session has expired. Please refresh the page and try again.';

      if (window.HashyAuthUtils) {
        window.HashyAuthUtils.handleAuthError(error, layout);
      }
    }

    if (layout && typeof layout.showNotif === 'function') {
      layout.showNotif({
        type: 'error',
        message: errorMessage,
        timeout: options.timeout || 8000,
      });
    }

    return {
      title: errorTitle,
      message: errorMessage,
      status: error?.response?.status,
    };
  },

  createApiPayload: function (message, context, options) {
    options = options || {};

    var payload = {
      message: message,
    };

    if (context) {
      payload.context = context;
    }

    if (options.sessionId) {
      payload.session_id = options.sessionId;
    }

    if (options.externalEmployeeId) {
      payload.external_employee_id = options.externalEmployeeId;
    }

    return payload;
  },

  retryFailedRequest: function (requestFn, maxRetries, delay) {
    maxRetries = maxRetries || 3;
    delay = delay || 1000;

    var attempt = 0;

    function executeRequest() {
      return requestFn().catch(function (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }

        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(executeRequest());
          }, delay * attempt);
        });
      });
    }

    return executeRequest();
  },

  validateSessionState: function (session) {
    return (
      session &&
      !session.isTemporary &&
      session.sessionIdAi &&
      !String(session.sessionIdAi).startsWith('temp_')
    );
  },

  getPageContext: function () {
    if (window.HashyAPIClient && typeof window.HashyAPIClient.getPageContext === 'function') {
      return window.HashyAPIClient.getPageContext();
    }
    return {};
  },

  loadSessions: function (limit, offset) {
    limit = limit || 15;
    offset = offset || 0;

    if (!window.HashyAPIClient) {
      return Promise.reject(new Error('API client not available'));
    }

    return window.HashyAPIClient.getSessions(limit, offset)
      .then(function (response) {
        if (response.success && Array.isArray(response.sessions)) {
          return {
            success: true,
            sessions: response.sessions,
            total: response.total || response.sessions.length,
          };
        }
        return { success: false, sessions: [], total: 0 };
      })
      .catch(function (error) {
        console.error('Failed to load sessions:', error);
        return { success: false, sessions: [], total: 0, error: error };
      });
  },

  deleteSession: function (sessionId) {
    if (!window.HashyAPIClient || !sessionId) {
      return Promise.reject(new Error('Invalid session ID'));
    }

    return window.HashyAPIClient.deleteSession(sessionId)
      .then(function (response) {
        return {
          success: response.success || false,
          message: response.message || 'Session deleted',
        };
      })
      .catch(function (error) {
        console.error('Failed to delete session:', error);
        return {
          success: false,
          message: error?.response?.data?.detail || 'Failed to delete session',
          error: error,
        };
      });
  },

  renameSession: function (sessionId, newName) {
    if (!window.HashyAPIClient || !sessionId || !newName) {
      return Promise.reject(new Error('Invalid parameters'));
    }

    return window.HashyAPIClient.renameSession(sessionId, newName)
      .then(function (response) {
        return {
          success: response.success || false,
          message: response.message || 'Session renamed',
        };
      })
      .catch(function (error) {
        console.error('Failed to rename session:', error);
        return {
          success: false,
          message: error?.response?.data?.detail || 'Failed to rename session',
          error: error,
        };
      });
  },
};

window.HashyAPIUtils = hashyApiUtils;
