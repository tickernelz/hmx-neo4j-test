VueComponent.push({
  name: 'hx-hashy-session-icons',
  component: {
    template: VueTemplate['hx-hashy-session-icons'],
    setup: function () {
      var hashyCharacter = Vue.ref('/static/img/logo-hashy.png');
      var chatStore = useHashyStore();

      var minimizedSessions = Vue.computed(function () {
        return window.HashySessionUtils.getMinimizedSessions(chatStore.sessions);
      });

      var restoreSession = function (sessionId) {
        chatStore.restoreSession(sessionId);
      };

      var getSessionNumber = function (session) {
        return window.HashySessionUtils.getSessionNumber(session);
      };

      var closeSession = function (sessionId) {
        chatStore.closeSession(sessionId);
      };

      var getSessionDisplayName = function (session) {
        return window.HashySessionUtils.getSessionDisplayName(session);
      };

      return {
        hashyCharacter: hashyCharacter,
        minimizedSessions: minimizedSessions,
        restoreSession: restoreSession,
        getSessionNumber: getSessionNumber,
        closeSession: closeSession,
        getSessionDisplayName: getSessionDisplayName,
      };
    },
  },
});
