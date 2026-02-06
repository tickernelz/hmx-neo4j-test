const hashySessionUtils = {
  getSessionDisplayName: function (session) {
    if (!session) return 'New Chat';
    return session.name || session.title || session.id || '';
  },

  validateSessionState: function (session) {
    return (
      session &&
      typeof session.id !== 'undefined' &&
      session.state &&
      ['normal', 'minimized', 'maximized'].includes(session.state)
    );
  },

  isSessionActive: function (session) {
    return session && session.state !== 'closed' && session.state !== 'inactive';
  },

  isSessionTemporary: function (session) {
    return (
      session &&
      (session.isTemporary ||
        !session.sessionIdAi ||
        String(session.sessionIdAi).startsWith('temp_'))
    );
  },

  getSessionNumber: function (session) {
    if (!session) return '';
    return session.sessionNumber || '';
  },

  createSessionPosition: function (index, offset) {
    offset = offset || { x: 20, y: 20 };
    return {
      x: offset.x + index * 30,
      y: offset.y + index * 30,
    };
  },

  getNextZIndex: function (sessions) {
    if (!sessions || !sessions.length) return 1000;

    var maxZ = Math.max.apply(
      Math,
      sessions.map(function (s) {
        return s.zIndex || 1000;
      })
    );

    return maxZ + 1;
  },

  findSessionById: function (sessions, sessionId) {
    if (!sessions || !sessionId) return null;

    return (
      sessions.find(function (session) {
        return session.id === sessionId;
      }) || null
    );
  },

  getActiveSessions: function (sessions) {
    if (!sessions) return [];

    return sessions.filter(function (session) {
      return window.HashySessionUtils.isSessionActive(session);
    });
  },

  getMinimizedSessions: function (sessions) {
    if (!sessions) return [];

    return sessions.filter(function (session) {
      return session.state === 'minimized';
    });
  },

  getMaximizedSession: function (sessions) {
    if (!sessions) return null;

    return (
      sessions.find(function (session) {
        return session.state === 'maximized';
      }) || null
    );
  },

  createNewSession: function (options) {
    options = options || {};

    var sessionId = options.id || 'session_' + Date.now();

    return {
      id: sessionId,
      name: options.name || null,
      state: options.state || 'normal',
      messages: [],
      position: options.position || { x: 20, y: 20 },
      zIndex: options.zIndex || 1000,
      isTemporary: options.isTemporary || false,
      sessionIdAi: options.sessionIdAi || null,
      externalSessionId: options.externalSessionId || null,
      isResumed: options.isResumed || false,
      chatOffset: options.chatOffset || 0,
      scrollPosition: options.scrollPosition || 0,
      createdAt: new Date().toISOString(),
    };
  },

  updateSessionFromResponse: function (session, response) {
    if (!session || !response) return session;

    var updatedSession = Object.assign({}, session);

    if (response.session_id) {
      updatedSession.sessionIdAi = response.session_id;
      updatedSession.externalSessionId = response.session_id;
      updatedSession.isTemporary = false;
    }

    if (response.session_name) {
      updatedSession.name = response.session_name;
    }

    return updatedSession;
  },
};

window.HashySessionUtils = hashySessionUtils;
