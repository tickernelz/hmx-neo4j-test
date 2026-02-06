VueComponent.push({
  name: 'hx-hashy-session-warning',
  component: {
    template: VueTemplate['hx-hashy-session-warning'],
    setup: function () {
      var chatStore = useHashyStore();
      var layout = useLayoutStore();

      var showWarning = Vue.ref(false);
      var pendingSessionData = Vue.ref(null);
      var oldestSession = Vue.ref(null);

      var maxSessions = Vue.computed(function () {
        return chatStore.maxSessions;
      });

      var openWarning = function (sessionData, oldest) {
        pendingSessionData.value = sessionData;
        oldestSession.value = oldest;
        showWarning.value = true;
      };

      var closeWarning = function () {
        showWarning.value = false;
        pendingSessionData.value = null;
        oldestSession.value = null;
      };

      var confirmReplace = function () {
        if (pendingSessionData.value) {
          chatStore.replaceOldestSession(pendingSessionData.value);
        }
        closeWarning();
      };

      var formatDate = function (date) {
        if (!date) return '';
        return new Date(date).toLocaleString();
      };

      var getSessionDisplayName = function (session) {
        return window.HashySessionUtils.getSessionDisplayName(session);
      };

      var validateSessionState = function (session) {
        return window.HashySessionUtils.validateSessionState(session);
      };

      window.hashySessionWarning = {
        openWarning: openWarning,
      };

      return {
        showWarning: showWarning,
        oldestSession: oldestSession,
        maxSessions: maxSessions,
        closeWarning: closeWarning,
        confirmReplace: confirmReplace,
        formatDate: formatDate,
        getSessionDisplayName: getSessionDisplayName,
        validateSessionState: validateSessionState,
      };
    },
  },
});
