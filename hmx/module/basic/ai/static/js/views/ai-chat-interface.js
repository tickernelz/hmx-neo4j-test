VueComponent.push({
  name: 'hx-ai-chat-interface',
  component: {
    template: VueTemplate['hx-ai-chat-interface'],
    setup: function () {
      var layout = useLayoutStore();
      var envStore = useEnvStore();

      var actionContext = Vue.computed(function () {
        var action = layout.action;
        var context = action?.context || {};

        if (window.currentAction) {
          action = window.currentAction;
          context = action?.context || {};
        }

        if (layout.state && layout.state.action) {
          action = layout.state.action;
          context = action?.context || {};
        }

        if (typeof context === 'string') {
          try {
            var parsed = JSON.parse(context);
            return parsed;
          } catch (e) {
            console.error('[AI Chat Interface] Failed to parse context:', context, e);
            return {};
          }
        }

        return context || {};
      });

      var sessionId = Vue.computed(function () {
        return actionContext.value?.session_id || null;
      });

      var sessionName = Vue.computed(function () {
        return actionContext.value?.session_name || '';
      });

      var SIDEBAR_STATE_KEY = 'hmx_ai_sidebar_collapsed';

      var getSavedSidebarState = function () {
        try {
          var saved = localStorage.getItem(SIDEBAR_STATE_KEY);
          return saved === 'true';
        } catch (e) {
          return false;
        }
      };

      var saveSidebarState = function (collapsed) {
        try {
          localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? 'true' : 'false');
        } catch (e) {
          console.warn('Failed to save sidebar state:', e);
        }
      };

      var sidebarCollapsed = Vue.ref(getSavedSidebarState());
      var sessions = Vue.ref([]);
      var searchQuery = Vue.ref('');
      var activeSessionId = Vue.ref(null);
      var externalSessionId = Vue.ref(null);
      var currentSessionName = Vue.ref('');
      var groupCollapsedState = Vue.ref({});
      var isLoadingSessions = Vue.ref(false);
      var sessionPageSize = Vue.ref(15);
      var hasMoreSessions = Vue.ref(true);
      var editingSessionId = Vue.ref(null);
      var editingSessionName = Vue.ref('');
      var sessionNameInput = Vue.ref(null);
      var showSearchModal = Vue.ref(false);
      var modalSearchInput = Vue.ref(null);
      var replyingToMessage = Vue.ref(null);
      var contextMentioned = Vue.ref(null);
      var copiedMessageId = Vue.ref(null);
      var selectionTooltip = null;
      var selectionFrame = null;

      var chatComposable = window.useHashyChat({
        layout: layout,
        envStore: envStore,
        sessionId: sessionId.value,
      });

      var sessionStatus = Vue.computed(function () {
        return 'Active';
      });

      var groupSessionsByDate = function (sessionList) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        var groups = {
          Today: [],
          Yesterday: [],
        };

        var otherDates = {};

        sessionList.forEach(function (session) {
          var sessionDate = new Date(session.created_at);
          sessionDate.setHours(0, 0, 0, 0);

          if (sessionDate.getTime() === today.getTime()) {
            groups['Today'].push(session);
          } else if (sessionDate.getTime() === yesterday.getTime()) {
            groups['Yesterday'].push(session);
          } else {
            var label = formatDateLabel(sessionDate);
            if (!otherDates[label]) {
              otherDates[label] = [];
            }
            otherDates[label].push(session);
          }
        });

        var result = [];

        if (groups['Today'].length > 0) {
          result.push({
            label: 'Today',
            sessions: groups['Today'],
            collapsed: groupCollapsedState.value['Today'] || false,
          });
        }

        if (groups['Yesterday'].length > 0) {
          result.push({
            label: 'Yesterday',
            sessions: groups['Yesterday'],
            collapsed: groupCollapsedState.value['Yesterday'] || false,
          });
        }

        Object.keys(otherDates)
          .sort(function (a, b) {
            return new Date(b) - new Date(a);
          })
          .forEach(function (label) {
            result.push({
              label: label,
              sessions: otherDates[label],
              collapsed: groupCollapsedState.value[label] || false,
            });
          });

        return result;
      };

      var formatDateLabel = function (date) {
        var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];

        return (
          days[date.getDay()] +
          ', ' +
          date.getDate() +
          ' ' +
          months[date.getMonth()] +
          ' ' +
          date.getFullYear()
        );
      };

      var formatSessionTime = function (timestamp) {
        var date = new Date(timestamp);
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return hours + ':' + minutes + ' ' + ampm;
      };

      var groupedSessions = Vue.computed(function () {
        return groupSessionsByDate(sessions.value);
      });

      var filteredGroupedSessions = Vue.computed(function () {
        if (!searchQuery.value.trim()) {
          return groupedSessions.value;
        }

        var query = searchQuery.value.toLowerCase();
        return groupedSessions.value
          .map(function (group) {
            return {
              label: group.label,
              sessions: group.sessions.filter(function (session) {
                return session.name.toLowerCase().includes(query);
              }),
              collapsed: group.collapsed,
            };
          })
          .filter(function (group) {
            return group.sessions.length > 0;
          });
      });

      var loadSessions = function (append) {
        append = append || false;
        isLoadingSessions.value = true;

        var offset = append ? sessions.value.length : 0;

        return window.HashyAPIUtils.loadSessions(sessionPageSize.value, offset)
          .then(function (response) {
            if (response.success) {
              if (append) {
                sessions.value = sessions.value.concat(response.sessions);
              } else {
                sessions.value = response.sessions;
              }

              hasMoreSessions.value = response.sessions.length === sessionPageSize.value;
            }
          })
          .catch(function (error) {
            console.error('Failed to load sessions:', error);
          })
          .finally(function () {
            isLoadingSessions.value = false;
          });
      };

      var loadMoreSessions = function () {
        loadSessions(true);
      };

      var toggleSidebar = function () {
        sidebarCollapsed.value = !sidebarCollapsed.value;
        saveSidebarState(sidebarCollapsed.value);
        if (!sidebarCollapsed.value) {
          showSearchModal.value = false;
        }
      };

      var toggleSearchModal = function () {
        if (sidebarCollapsed.value) {
          showSearchModal.value = !showSearchModal.value;

          if (showSearchModal.value) {
            Vue.nextTick(function () {
              if (modalSearchInput.value) {
                modalSearchInput.value.focus();
              }
            });
          }
        }
      };

      var closeSearchModal = function () {
        showSearchModal.value = false;
      };

      var createNewChatFromModal = function () {
        createNewChat();
        closeSearchModal();
      };

      var switchSessionFromModal = function (sessionIdToSwitch) {
        switchSession(sessionIdToSwitch);
        closeSearchModal();
      };

      var toggleGroup = function (groupLabel) {
        groupCollapsedState.value[groupLabel] = !groupCollapsedState.value[groupLabel];
      };

      var createNewChat = function () {
        activeSessionId.value = null;
        externalSessionId.value = null;
        currentSessionName.value = '';
        chatComposable.messages.value = [];

        var welcomeMessage = window.HashyMessageUtils.createWelcomeMessage();
        chatComposable.addMessage(welcomeMessage);
        chatComposable.scrollToBottom(100);
      };

      var switchSession = function (sessionIdToSwitch) {
        if (activeSessionId.value === sessionIdToSwitch) return;

        activeSessionId.value = sessionIdToSwitch;
        chatComposable.messages.value = [];
        chatComposable.isThinking.value = true;

        var session = sessions.value.find(function (s) {
          return s.id === sessionIdToSwitch;
        });
        currentSessionName.value = session ? session.name : '';
        externalSessionId.value = session ? session.external_session_id : null;

        window.HashyAPIUtils.loadSessionMessages(sessionIdToSwitch)
          .then(function (response) {
            if (response.success && Array.isArray(response.messages)) {
              var formattedMessages = response.messages.map(function (msg) {
                return window.HashyMessageUtils.createMessage(
                  msg.text,
                  msg.message_type === 'user' ? chatComposable.username.value : 'hashy',
                  msg.attachments || [],
                  {
                    id: msg.id,
                    timestamp: new Date(msg.created_at || Date.now()).toISOString(),
                    contextMentioned: msg.context_mentioned || null,
                  }
                );
              });

              chatComposable.messages.value = formattedMessages;
              chatComposable.scrollToBottom();
            }
          })
          .catch(function (error) {
            console.error('Failed to load session messages:', error);
          })
          .finally(function () {
            chatComposable.isThinking.value = false;
          });
      };

      var deleteSession = function (sessionIdToDelete) {
        if (!confirm('Are you sure you want to delete this session?')) {
          return;
        }

        window.HashyAPIUtils.deleteSession(sessionIdToDelete)
          .then(function (response) {
            if (response.success) {
              sessions.value = sessions.value.filter(function (s) {
                return s.id !== sessionIdToDelete;
              });

              if (activeSessionId.value === sessionIdToDelete) {
                createNewChat();
              }
            } else {
              alert('Failed to delete session: ' + (response.message || 'Unknown error'));
            }
          })
          .catch(function (error) {
            console.error('Failed to delete session:', error);
            alert('Failed to delete session');
          });
      };

      var startRenameSession = function (sessionIdToRename, currentName) {
        editingSessionId.value = sessionIdToRename;
        editingSessionName.value = currentName;

        Vue.nextTick(function () {
          if (sessionNameInput.value && sessionNameInput.value.length > 0) {
            var input = sessionNameInput.value[0];
            if (input) {
              input.focus();
              input.select();
            }
          }
        });
      };

      var saveSessionName = function (sessionIdToRename) {
        if (!editingSessionName.value || !editingSessionName.value.trim()) {
          editingSessionId.value = null;
          editingSessionName.value = '';
          return;
        }

        var newName = editingSessionName.value.trim();
        var session = sessions.value.find(function (s) {
          return s.id === sessionIdToRename;
        });

        if (session && session.name === newName) {
          editingSessionId.value = null;
          editingSessionName.value = '';
          return;
        }

        window.HashyAPIUtils.renameSession(sessionIdToRename, newName)
          .then(function (response) {
            if (response.success) {
              var sessionToUpdate = sessions.value.find(function (s) {
                return s.id === sessionIdToRename;
              });
              if (sessionToUpdate) {
                sessionToUpdate.name = newName;
              }

              if (activeSessionId.value === sessionIdToRename) {
                currentSessionName.value = newName;
              }
            } else {
              alert('Failed to rename session: ' + (response.message || 'Unknown error'));
            }
          })
          .catch(function (error) {
            console.error('Failed to rename session:', error);
            alert('Failed to rename session');
          })
          .finally(function () {
            editingSessionId.value = null;
            editingSessionName.value = '';
          });
      };

      var loadMessages = function () {
        if (!sessionId.value) {
          return Promise.resolve();
        }

        return window.HashyAPIUtils.loadSessionMessages(sessionId.value)
          .then(function (response) {
            if (response.success && Array.isArray(response.messages)) {
              var formattedMessages = response.messages.map(function (msg) {
                return window.HashyMessageUtils.createMessage(
                  msg.text,
                  msg.message_type === 'user' ? chatComposable.username.value : 'hashy',
                  msg.attachments || [],
                  {
                    id: msg.id,
                    timestamp: new Date(msg.created_at || Date.now()).toISOString(),
                    contextMentioned: msg.context_mentioned || null,
                  }
                );
              });

              chatComposable.messages.value = formattedMessages;
              chatComposable.scrollToBottom();
            }
          })
          .catch(function (error) {
            console.warn('[AI Chat Interface] Could not load message history, starting fresh chat');
          });
      };

      var sendMessage = function () {
        if (
          !chatComposable.currentMessage.value ||
          !chatComposable.currentMessage.value.trim() ||
          chatComposable.isThinking.value
        ) {
          return;
        }

        var messageText = chatComposable.currentMessage.value.trim();
        var files = chatComposable.attachedFiles.value.slice();
        var contextToSend = contextMentioned.value;

        var userMessage = window.HashyMessageUtils.createUserMessage(
          messageText,
          chatComposable.username.value,
          files.map(function (file) {
            return {
              filename: file.name,
              size: file.size,
              type: file.type,
            };
          }),
          contextToSend
        );

        chatComposable.addMessage(userMessage);
        chatComposable.currentMessage.value = '';
        chatComposable.attachedFiles.value = [];
        clearReplyContext();
        chatComposable.isThinking.value = true;

        Vue.nextTick(function () {
          chatComposable.scrollToBottom();
        });

        var sessionIdToUse = externalSessionId.value;

        window.HashyAPIUtils.sendChatMessage(
          messageText,
          sessionIdToUse ? String(sessionIdToUse) : null,
          files,
          { contextMentioned: contextToSend }
        )
          .then(function (response) {
            if (response.success) {
              if (response.session_id && !externalSessionId.value) {
                activeSessionId.value = parseInt(response.session_id);
                externalSessionId.value = response.external_session_id || response.session_id;
                currentSessionName.value =
                  messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '');
                loadSessions();
              }

              if (response.attachments && response.attachments.length > 0) {
                var messages = chatComposable.messages.value;
                var userMsg = messages.find(function (m) {
                  return m.id === userMessage.id;
                });
                if (userMsg) {
                  userMsg.attachments = response.attachments;
                }
              }

              var aiMessage = window.HashyMessageUtils.createAIMessage(
                response.response?.data || response.message || 'No response',
                response.message_id
              );
              chatComposable.addMessage(aiMessage);
            } else {
              var errorMessage = window.HashyMessageUtils.createErrorMessage(
                response.error || 'Failed to send message'
              );
              chatComposable.addMessage(errorMessage);
            }
          })
          .catch(function (error) {
            console.error('Failed to send message:', error);
            var errorMessage =
              window.HashyMessageUtils.createErrorMessage('Failed to send message');
            chatComposable.addMessage(errorMessage);
          })
          .finally(function () {
            chatComposable.isThinking.value = false;
            Vue.nextTick(function () {
              chatComposable.scrollToBottom();
            });
          });
      };

      var handleKeyPress = function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      };

      var initializeChat = function () {
        if (chatComposable.messages.value.length === 0) {
          var welcomeMessage = window.HashyMessageUtils.createWelcomeMessage();
          chatComposable.addMessage(welcomeMessage);
          chatComposable.scrollToBottom(100);
        }
      };

      var ensureSelectionTooltip = function () {
        if (selectionTooltip && document.body.contains(selectionTooltip)) {
          return selectionTooltip;
        }
        selectionTooltip = document.querySelector('.ai-selection-tooltip');
        return selectionTooltip;
      };

      var clampValue = function (value, min, max) {
        return Math.min(Math.max(value, min), max);
      };

      var hideSelectionTooltip = function () {
        var tooltip = ensureSelectionTooltip();
        if (!tooltip) return;
        tooltip.classList.remove('is-visible');
      };

      var showSelectionTooltip = function (position) {
        var tooltip = ensureSelectionTooltip();
        if (!tooltip || !position) return;

        var desiredX = position.x;
        var desiredY = position.y - 8;
        var tooltipWidth = tooltip.offsetWidth || 0;
        var padding = 12;
        var clampedX = desiredX;

        if (tooltipWidth) {
          clampedX = clampValue(
            desiredX,
            tooltipWidth / 2 + padding,
            window.innerWidth - tooltipWidth / 2 - padding
          );
        }

        var top = Math.max(8, desiredY);

        tooltip.style.setProperty('--ai-selection-left', clampedX + 'px');
        tooltip.style.setProperty('--ai-selection-top', top + 'px');
        tooltip.style.setProperty('--ai-selection-arrow-offset', desiredX - clampedX + 'px');
        tooltip.classList.add('is-visible');
      };

      var getSelectionPosition = function () {
        var selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

        var selectedText = selection.toString();
        if (!selectedText || !selectedText.trim()) return null;

        var range = selection.getRangeAt(0);
        var containerNode = range.commonAncestorContainer;
        var containerElement =
          containerNode.nodeType === Node.ELEMENT_NODE
            ? containerNode
            : containerNode.parentElement;

        if (!containerElement) return null;

        var hashyMessage = containerElement.closest('.hashy-message');
        if (!hashyMessage || !hashyMessage.closest('.hx-ai-chat-interface')) return null;

        var rect = range.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return null;
        return { x: rect.left + rect.width / 2, y: rect.top };
      };

      var updateSelectionTooltip = function () {
        var tooltip = ensureSelectionTooltip();
        if (tooltip && tooltip.matches(':hover')) {
          return;
        }

        var position = getSelectionPosition();
        if (!position) {
          hideSelectionTooltip();
          return;
        }
        showSelectionTooltip(position);
      };

      var scheduleSelectionTooltipUpdate = function () {
        if (selectionFrame) {
          cancelAnimationFrame(selectionFrame);
        }
        selectionFrame = requestAnimationFrame(function () {
          selectionFrame = null;
          updateSelectionTooltip();
        });
      };

      var setReplyContext = function (message) {
        if (!message) return;
        replyingToMessage.value = message;
        contextMentioned.value = message.text;
        Vue.nextTick(function () {
          var inputElement = document.querySelector('.ai-message-input');
          if (inputElement) {
            inputElement.focus();
          }
        });
      };

      var clearReplyContext = function () {
        replyingToMessage.value = null;
        contextMentioned.value = null;
      };

      var truncateText = function (text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
      };

      var handleAskHashy = function (event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        var selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          return;
        }

        var selectedText = selection.toString().trim();
        if (!selectedText) {
          return;
        }

        var range = selection.getRangeAt(0);
        var containerNode = range.commonAncestorContainer;
        var containerElement =
          containerNode.nodeType === Node.ELEMENT_NODE
            ? containerNode
            : containerNode.parentElement;

        if (!containerElement) {
          return;
        }

        var hashyMessage = containerElement.closest('.hashy-message');
        if (!hashyMessage || !hashyMessage.closest('.hx-ai-chat-interface')) {
          return;
        }

        replyingToMessage.value = null;
        contextMentioned.value = selectedText;

        hideSelectionTooltip();

        Vue.nextTick(function () {
          var inputElement = document.querySelector('.ai-message-input');
          if (inputElement) {
            inputElement.focus();
          }
        });

        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      };

      var copyMessageText = function (message) {
        if (!message || !message.text) return;

        var textToCopy = message.text;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(textToCopy)
            .then(function () {
              copiedMessageId.value = message.id;
              setTimeout(function () {
                copiedMessageId.value = null;
              }, 2000);
            })
            .catch(function (err) {
              console.error('Failed to copy message:', err);
            });
        } else {
          var textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            var successful = document.execCommand('copy');
            if (successful) {
              copiedMessageId.value = message.id;
              setTimeout(function () {
                copiedMessageId.value = null;
              }, 2000);
            }
          } catch (err) {
            console.error('Failed to copy message:', err);
          }
          document.body.removeChild(textArea);
        }
      };

      var isMounted = Vue.ref(true);

      Vue.onMounted(function () {
        if (actionContext.value?.external_session_id) {
          externalSessionId.value = actionContext.value.external_session_id;
          activeSessionId.value = actionContext.value.session_id;
        }

        loadSessions();

        var handleTooltipClick = function (e) {
          var target = e.target;
          var tooltip = target.closest('.ai-selection-tooltip');
          if (tooltip && tooltip.classList.contains('is-visible')) {
            e.preventDefault();
            e.stopPropagation();
            handleAskHashy(e);
          }
        };

        document.addEventListener('mousedown', handleTooltipClick, true);
        document.addEventListener('click', handleTooltipClick);
        document.addEventListener('selectionchange', scheduleSelectionTooltipUpdate);
        document.addEventListener('mouseup', scheduleSelectionTooltipUpdate);
        document.addEventListener('keyup', scheduleSelectionTooltipUpdate);
        document.addEventListener('touchend', scheduleSelectionTooltipUpdate);
        document.addEventListener('scroll', scheduleSelectionTooltipUpdate, true);

        window._aiTooltipClickHandler = handleTooltipClick;

        setTimeout(function () {
          try {
            if (!isMounted.value) return;
            if (sessionId.value) {
              loadMessages().then(function () {
                if (!isMounted.value) return;
                if (chatComposable.messages.value.length === 0) {
                  initializeChat();
                }
              });
            } else {
              initializeChat();
            }
          } catch (error) {
            console.error('[AI Chat Interface] Error loading messages:', error);
            if (isMounted.value) {
              initializeChat();
            }
          }
        }, 100);

        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && showSearchModal.value) {
            closeSearchModal();
          }
        });
      });

      Vue.onUnmounted(function () {
        isMounted.value = false;

        if (window._aiTooltipClickHandler) {
          document.removeEventListener('mousedown', window._aiTooltipClickHandler, true);
          document.removeEventListener('click', window._aiTooltipClickHandler);
          window._aiTooltipClickHandler = null;
        }

        document.removeEventListener('selectionchange', scheduleSelectionTooltipUpdate);
        document.removeEventListener('mouseup', scheduleSelectionTooltipUpdate);
        document.removeEventListener('keyup', scheduleSelectionTooltipUpdate);
        document.removeEventListener('touchend', scheduleSelectionTooltipUpdate);
        document.removeEventListener('scroll', scheduleSelectionTooltipUpdate, true);
        hideSelectionTooltip();
      });

      var getFileIconClass = function (filename) {
        var fileType = window.HashyFileUtils.getFileType(filename);
        return window.HashyFileUtils.getFileIconClass(fileType);
      };

      var getFileIconSymbol = function (filename) {
        var fileType = window.HashyFileUtils.getFileType(filename);
        return window.HashyFileUtils.getFileIconSymbol(fileType);
      };

      return {
        sessionId: sessionId,
        sessionName: sessionName,
        sessionStatus: sessionStatus,
        username: chatComposable.username,
        messages: chatComposable.messages,
        currentMessage: chatComposable.currentMessage,
        attachedFiles: chatComposable.attachedFiles,
        isThinking: chatComposable.isThinking,
        chatBodyRef: chatComposable.chatBodyRef,
        sendMessage: sendMessage,
        handleKeyPress: handleKeyPress,
        handleFileChange: chatComposable.handleFileChange,
        removeFile: chatComposable.removeFile,
        formatTime: chatComposable.formatTime,
        formatFileSize: chatComposable.formatFileSize,
        getFileIconClass: getFileIconClass,
        getFileIconSymbol: getFileIconSymbol,
        sidebarCollapsed: sidebarCollapsed,
        sessions: sessions,
        searchQuery: searchQuery,
        activeSessionId: activeSessionId,
        currentSessionName: currentSessionName,
        groupCollapsedState: groupCollapsedState,
        isLoadingSessions: isLoadingSessions,
        hasMoreSessions: hasMoreSessions,
        filteredGroupedSessions: filteredGroupedSessions,
        toggleSidebar: toggleSidebar,
        toggleGroup: toggleGroup,
        createNewChat: createNewChat,
        switchSession: switchSession,
        deleteSession: deleteSession,
        loadMoreSessions: loadMoreSessions,
        formatSessionTime: formatSessionTime,
        editingSessionId: editingSessionId,
        editingSessionName: editingSessionName,
        sessionNameInput: sessionNameInput,
        startRenameSession: startRenameSession,
        saveSessionName: saveSessionName,
        showSearchModal: showSearchModal,
        modalSearchInput: modalSearchInput,
        toggleSearchModal: toggleSearchModal,
        closeSearchModal: closeSearchModal,
        createNewChatFromModal: createNewChatFromModal,
        switchSessionFromModal: switchSessionFromModal,
        replyingToMessage: replyingToMessage,
        contextMentioned: contextMentioned,
        copiedMessageId: copiedMessageId,
        setReplyContext: setReplyContext,
        clearReplyContext: clearReplyContext,
        truncateText: truncateText,
        handleAskHashy: handleAskHashy,
        copyMessageText: copyMessageText,
      };
    },
  },
});
