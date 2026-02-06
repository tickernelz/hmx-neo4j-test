VueComponent.push({
  name: 'hx-topbar-button-hashy',
  component: {
    template: VueTemplate['hx-topbar-button-hashy'],
    setup() {
      const logoSrc = Vue.ref('/static/img/logo-hashy.png');
      const onLogoError = e => (e.target.src = '/static/img/logo-hashy.png');
      const layout = useLayoutStore();
      const envStore = useEnvStore();
      const sessionIdAi = Vue.ref(null);
      const showPanel = Vue.ref(false);

      const getActiveConfig = async () => {
        try {
          const params = {
            model_name: 'aiagentconfig',
            domain: [['use_config', '=', true]],
            fields: ['id', 'name', 'use_config'],
            limit: 1,
          };
          const result = await useFetch('/hmx_api/record/search_read', params);
          return result.records[0] || null;
        } catch (error) {
          console.error('Failed to get active config:', error);
          return null;
        }
      };

      const createNewSession = async () => {
        const activeConfig = await getActiveConfig();
        if (!activeConfig) {
          return null;
        }

        return {
          sessionIdAi: `temp_${Date.now()}`,
          externalSessionId: null,
          isTemporary: true,
        };
      };

      const executeCreateSession = async () => {
        const chatStore = useHashyStore();

        const activeConfig = await getActiveConfig();
        if (!activeConfig) {
          layout.showNotif({
            type: 'warning',
            message: 'Set up configuration first.',
            timeout: 3000,
          });
          return;
        }

        const sessionData = await createNewSession();
        if (!sessionData) {
          layout.showNotif({
            type: 'warning',
            message: 'Failed to create session.',
            timeout: 3000,
          });
          return;
        }

        const result = chatStore.addSession(sessionData);

        if (result.needsConfirmation) {
          if (window.hashySessionWarning) {
            window.hashySessionWarning.openWarning(sessionData, result.oldestSession);
          }
          return;
        }

        if (result.success) {
          localStorage.setItem('sessionIdAi', sessionData.sessionIdAi);
          layout.showNotif({
            type: 'success',
            message: 'New chat session created successfully!',
            timeout: 3000,
          });
        }
      };

      const togglePanel = () => {
        showPanel.value = !showPanel.value;
      };

      const closePanel = () => {
        showPanel.value = false;
      };

      const handleCreateNew = async () => {
        closePanel();
        await executeCreateSession();
      };

      const handleResumeSession = async session => {
        closePanel();
        const chatStore = useHashyStore();

        const sessionData = {
          sessionIdAi: session.id,
          externalSessionId: session.external_session_id,
          name: session.name,
          isTemporary: false,
          isResumed: true,
        };

        const result = chatStore.addSession(sessionData);

        if (result.needsConfirmation) {
          if (window.hashySessionWarning) {
            window.hashySessionWarning.openWarning(sessionData, result.oldestSession);
          }
          return;
        }

        if (result.success) {
          localStorage.setItem('sessionIdAi', sessionData.sessionIdAi);
          const message = result.alreadyExists
            ? `Session already open: ${session.name}`
            : `Resumed session: ${session.name}`;
          layout.showNotif({
            type: 'success',
            message: message,
            timeout: 3000,
          });
        }
      };

      return {
        logoSrc,
        onLogoError,
        showPanel,
        togglePanel,
        closePanel,
        handleCreateNew,
        handleResumeSession,
      };
    },
  },
});
