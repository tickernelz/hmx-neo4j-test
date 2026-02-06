VueComponent.push({
  name: 'hx-hashy-session-dropdown',
  component: {
    template: VueTemplate['hx-hashy-session-dropdown'],
    props: {
      showPanel: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['close', 'create-new', 'resume-session'],
    setup(props, { emit }) {
      const envStore = useEnvStore();
      const searchQuery = Vue.ref('');
      const sessions = Vue.ref([]);
      const filteredGroups = Vue.ref([]);
      const isLoading = Vue.ref(false);

      const totalSessions = Vue.computed(() => sessions.value.length);
      const hasFilteredSessions = Vue.computed(() =>
        filteredGroups.value.some(group => group.sessions.length > 0)
      );

      const formatTime = timestamp => {
        const date = new Date(timestamp);
        const now = new Date();

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 86400000);

        if (dateDay.getTime() === today.getTime()) {
          return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (dateDay.getTime() === yesterday.getTime()) {
          return 'Yesterday';
        } else if (dateDay.getTime() > weekAgo.getTime()) {
          const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / 86400000);
          return `${diffDays} days ago`;
        } else {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      };

      const groupSessionsByDate = sessionList => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const weekAgo = new Date(today.getTime() - 604800000);

        const groups = {
          today: [],
          yesterday: [],
          thisWeek: [],
          older: [],
        };

        sessionList.forEach(session => {
          const sessionDate = new Date(session.updated_at || session.created_at);
          const sessionDay = new Date(
            sessionDate.getFullYear(),
            sessionDate.getMonth(),
            sessionDate.getDate()
          );

          if (sessionDay.getTime() === today.getTime()) {
            groups.today.push(session);
          } else if (sessionDay.getTime() === yesterday.getTime()) {
            groups.yesterday.push(session);
          } else if (sessionDate >= weekAgo) {
            groups.thisWeek.push(session);
          } else {
            groups.older.push(session);
          }
        });

        const result = [];
        if (groups.today.length) result.push({ label: 'Today', sessions: groups.today });
        if (groups.yesterday.length)
          result.push({ label: 'Yesterday', sessions: groups.yesterday });
        if (groups.thisWeek.length) result.push({ label: 'This Week', sessions: groups.thisWeek });
        if (groups.older.length) result.push({ label: 'Older', sessions: groups.older });

        return result;
      };

      const filterSessions = () => {
        const query = searchQuery.value.toLowerCase().trim();
        let filtered = sessions.value;

        if (query) {
          filtered = sessions.value.filter(session => session.name.toLowerCase().includes(query));
        }

        filteredGroups.value = groupSessionsByDate(filtered);
      };

      const loadSessionHistory = async () => {
        isLoading.value = true;
        try {
          if (!window.HashyAPIClient) {
            throw new Error('API client not available');
          }

          const response = await window.HashyAPIClient.getSessionHistory();

          if (response.success) {
            sessions.value = response.sessions.map(session => ({
              ...session,
              lastMessage: `Session with ${session.message_count} messages`,
            }));
          } else {
            sessions.value = [];
          }

          filterSessions();
        } catch (error) {
          console.error('Failed to load session history:', error);
          sessions.value = [];
          filterSessions();
        } finally {
          isLoading.value = false;
        }
      };

      const createNewSession = () => {
        emit('create-new');
      };

      const resumeSession = session => {
        emit('resume-session', session);
      };

      const closePanel = () => {
        emit('close');
      };

      Vue.watch(
        () => props.showPanel,
        newVal => {
          if (newVal) {
            Vue.nextTick(() => {
              loadSessionHistory();
            });
          } else {
            searchQuery.value = '';
          }
        },
        { immediate: true }
      );

      Vue.watch(searchQuery, filterSessions);

      Vue.onMounted(() => {
        if (props.showPanel) {
          loadSessionHistory();
        }
      });

      return {
        searchQuery,
        sessions,
        filteredGroups,
        totalSessions,
        hasFilteredSessions,
        isLoading,
        formatTime,
        filterSessions,
        createNewSession,
        resumeSession,
        closePanel,
      };
    },
  },
});
