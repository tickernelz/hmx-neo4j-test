const useHashyStore = Pinia.defineStore('hashyChat', () => {
  const sessions = Vue.ref([]);
  const activeSessionIds = Vue.ref([]);
  const maxSessions = 3;
  const isLoading = Vue.ref(false);
  const sessionCounter = Vue.ref(0);

  const SESSION_STATES = {
    NORMAL: 'normal',
    MINIMIZED: 'minimized',
    MAXIMIZED: 'maximized',
  };

  const createSession = sessionData => {
    sessionCounter.value++;
    const sessionNumber = sessionCounter.value;
    const newSession = {
      id: `session_${Date.now()}`,
      sessionIdAi: sessionData.sessionIdAi,
      externalSessionId: sessionData.externalSessionId,
      name: sessionData.name || null,
      sessionNumber: sessionNumber,
      state: SESSION_STATES.NORMAL,
      messages: [],
      chatOffset: 0,
      scrollPosition: 0,
      position: { x: window.innerWidth - 520, y: window.innerHeight - 630 },
      isActive: true,
      createdAt: new Date(),
      zIndex: Date.now(),
      isTemporary: sessionData.isTemporary || false,
      isResumed: sessionData.isResumed || false,
      currentMessage: '',
      attachedFiles: [],
      isThinking: false,
      replyingToMessage: null,
      contextMentioned: null,
      copiedMessageId: null,
    };
    return newSession;
  };

  const findSession = sessionId => {
    return sessions.value.find(s => s.id === sessionId);
  };

  const getActiveSession = () => {
    return sessions.value.find(s => activeSessionIds.value.includes(s.id));
  };

  const getActiveSessions = () => {
    return sessions.value.filter(
      s => activeSessionIds.value.includes(s.id) && s.state === SESSION_STATES.NORMAL
    );
  };

  const getOldestSession = () => {
    return sessions.value.reduce((oldest, session) =>
      session.createdAt < oldest.createdAt ? session : oldest
    );
  };

  const getMinimizedSessions = () => {
    return sessions.value.filter(s => s.state === SESSION_STATES.MINIMIZED);
  };

  const calculatePosition = sessionIndex => {
    const baseX = window.innerWidth - 520;
    const baseY = window.innerHeight - 630;
    const offsetX = sessionIndex * 430;
    return { x: baseX - offsetX, y: baseY };
  };

  const addSession = sessionData => {
    const existingSession = sessions.value.find(
      s => s.sessionIdAi === sessionData.sessionIdAi && s.sessionIdAi !== null
    );

    if (existingSession) {
      if (existingSession.state === SESSION_STATES.MINIMIZED) {
        restoreSession(existingSession.id);
      } else if (existingSession.state === SESSION_STATES.MAXIMIZED) {
        return { success: true, sessionId: existingSession.id, alreadyExists: true };
      } else {
        bringToFront(existingSession.id);
      }
      return { success: true, sessionId: existingSession.id, alreadyExists: true };
    }

    if (sessions.value.length >= maxSessions) {
      return { needsConfirmation: true, oldestSession: getOldestSession() };
    }

    const activeSessions = getActiveSessions();
    const newSession = createSession(sessionData);
    newSession.position = calculatePosition(activeSessions.length);

    sessions.value.push(newSession);
    activeSessionIds.value.push(newSession.id);

    return { success: true, sessionId: newSession.id };
  };

  const replaceOldestSession = sessionData => {
    const oldest = getOldestSession();
    const oldestIndex = sessions.value.findIndex(s => s.id === oldest.id);

    activeSessionIds.value = activeSessionIds.value.filter(id => id !== oldest.id);
    sessions.value.splice(oldestIndex, 1);

    const activeSessions = getActiveSessions();
    const newSession = createSession(sessionData);
    newSession.position = calculatePosition(activeSessions.length);

    sessions.value.push(newSession);
    activeSessionIds.value.push(newSession.id);

    return { success: true, sessionId: newSession.id };
  };

  const minimizeSession = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.state = SESSION_STATES.MINIMIZED;
      session.isActive = false;
      activeSessionIds.value = activeSessionIds.value.filter(id => id !== sessionId);
      repositionSessions();
    }
  };

  const maximizeSession = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.state = SESSION_STATES.MAXIMIZED;
      session.isActive = true;
      if (!activeSessionIds.value.includes(sessionId)) {
        activeSessionIds.value.push(sessionId);
      }
    }
  };

  const restoreSession = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      const activeSessions = getActiveSessions();
      if (activeSessions.length >= maxSessions) {
        const oldestActive = activeSessions.reduce((oldest, s) =>
          s.createdAt < oldest.createdAt ? s : oldest
        );
        minimizeSession(oldestActive.id);
      }

      session.state = SESSION_STATES.NORMAL;
      session.isActive = true;

      const currentActiveSessions = getActiveSessions();
      session.position = calculatePosition(currentActiveSessions.length);
      session.userMoved = false;

      if (!activeSessionIds.value.includes(sessionId)) {
        activeSessionIds.value.push(sessionId);
      }
    }
  };

  const normalizeSession = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.state = SESSION_STATES.NORMAL;
      session.isActive = true;
      if (!activeSessionIds.value.includes(sessionId)) {
        activeSessionIds.value.push(sessionId);
      }
    }
  };

  const closeSession = sessionId => {
    const sessionIndex = sessions.value.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      sessions.value.splice(sessionIndex, 1);
      activeSessionIds.value = activeSessionIds.value.filter(id => id !== sessionId);
      repositionSessions();
    }
  };

  const repositionSessions = () => {
    const activeSessions = getActiveSessions();
    activeSessions.forEach((session, index) => {
      if (!session.userMoved) {
        session.position = calculatePosition(index);
      }
    });
  };

  const bringToFront = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.zIndex = Date.now();
    }
  };

  const addMessage = (sessionId, newMessage) => {
    const session = findSession(sessionId);
    if (session) {
      session.messages.push(newMessage);
    }
  };

  const prependMessages = (sessionId, newMessages) => {
    const session = findSession(sessionId);
    if (session) {
      session.messages.unshift(...newMessages);
    }
  };

  const resetMessages = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.messages = [];
      session.chatOffset = 0;
      session.scrollPosition = 0;
    }
  };

  const updateSessionPosition = (sessionId, position) => {
    const session = findSession(sessionId);
    if (session) {
      session.position = position;
      session.userMoved = true;
    }
  };

  const updateSessionScroll = (sessionId, scrollData) => {
    const session = findSession(sessionId);
    if (session) {
      if (scrollData.offset !== undefined) session.chatOffset = scrollData.offset;
      if (scrollData.position !== undefined) session.scrollPosition = scrollData.position;
    }
  };

  const updateSessionToReal = (sessionId, realSessionData) => {
    const session = findSession(sessionId);
    if (session) {
      session.sessionIdAi = realSessionData.session_id;
      session.externalSessionId = realSessionData.external_session_id;
      if (realSessionData.session_name) {
        session.name = realSessionData.session_name;
      }
      session.isTemporary = false;
    }
  };

  const updateMessage = (sessionId, messageId, updates) => {
    const session = findSession(sessionId);
    if (session) {
      const message = session.messages.find(m => m.id === messageId);
      if (message) {
        Object.assign(message, updates);
      }
    }
  };

  const updateSessionMessage = (sessionId, message) => {
    const session = findSession(sessionId);
    if (session) {
      session.currentMessage = message;
    }
  };

  const updateSessionFiles = (sessionId, files) => {
    const session = findSession(sessionId);
    if (session) {
      session.attachedFiles = files;
    }
  };

  const addSessionFile = (sessionId, file) => {
    const session = findSession(sessionId);
    if (session) {
      session.attachedFiles.push(file);
    }
  };

  const removeSessionFile = (sessionId, index) => {
    const session = findSession(sessionId);
    if (session && session.attachedFiles[index]) {
      session.attachedFiles.splice(index, 1);
    }
  };

  const clearSessionFiles = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.attachedFiles = [];
    }
  };

  const updateSessionThinking = (sessionId, isThinking) => {
    const session = findSession(sessionId);
    if (session) {
      session.isThinking = isThinking;
    }
  };

  const updateSessionReplyContext = (sessionId, replyingTo, contextMentioned) => {
    const session = findSession(sessionId);
    if (session) {
      session.replyingToMessage = replyingTo;
      session.contextMentioned = contextMentioned;
    }
  };

  const clearSessionReplyContext = sessionId => {
    const session = findSession(sessionId);
    if (session) {
      session.replyingToMessage = null;
      session.contextMentioned = null;
    }
  };

  const updateSessionCopiedMessage = (sessionId, messageId) => {
    const session = findSession(sessionId);
    if (session) {
      session.copiedMessageId = messageId;
    }
  };

  return {
    sessions,
    activeSessionIds,
    maxSessions,
    isLoading,
    sessionCounter,
    SESSION_STATES,
    createSession,
    findSession,
    getActiveSession,
    getActiveSessions,
    getOldestSession,
    getMinimizedSessions,
    addSession,
    replaceOldestSession,
    minimizeSession,
    maximizeSession,
    restoreSession,
    normalizeSession,
    closeSession,
    addMessage,
    prependMessages,
    resetMessages,
    updateSessionPosition,
    updateSessionScroll,
    updateSessionToReal,
    updateMessage,
    repositionSessions,
    bringToFront,
    updateSessionMessage,
    updateSessionFiles,
    addSessionFile,
    removeSessionFile,
    clearSessionFiles,
    updateSessionThinking,
    updateSessionReplyContext,
    clearSessionReplyContext,
    updateSessionCopiedMessage,
  };
});
