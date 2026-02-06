VueComponent.push({
  name: 'hx-hashy-chat-view',
  component: {
    template: VueTemplate['hx-hashy-chat-view'],
    setup: function () {
      var hashyCharacter = Vue.ref('/static/img/hashy-character-transparent.png');
      var hashyCharacterGif = Vue.ref('/static/img/hashy-character-animated.gif');
      var layout = useLayoutStore();
      var envStore = useEnvStore();
      var chatStore = useHashyStore();

      var username = Vue.computed(function () {
        return envStore.identity.username;
      });

      var chatBodyRef = Vue.ref(null);
      var modalChatBodyRef = Vue.ref(null);

      var activeSessions = Vue.computed(function () {
        return chatStore.getActiveSessions();
      });

      var activeSession = Vue.computed(function () {
        return activeSessions.value[0] || null;
      });

      var maximizedSession = Vue.computed(function () {
        return (
          chatStore.sessions.find(function (s) {
            return s.state === 'maximized';
          }) || null
        );
      });

      var currentMessages = Vue.computed(function () {
        return activeSession.value ? activeSession.value.messages : [];
      });

      var getMessagesForSession = function (sessionId) {
        var session = chatStore.findSession(sessionId);
        return session ? session.messages : [];
      };

      var shouldShowDateBubble = function (currentMessage, previousMessage) {
        if (!previousMessage) {
          return true;
        }

        var currentDate = new Date(currentMessage.timestamp);
        var previousDate = new Date(previousMessage.timestamp);

        var currentDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate()
        );
        var previousDay = new Date(
          previousDate.getFullYear(),
          previousDate.getMonth(),
          previousDate.getDate()
        );

        return currentDay.getTime() !== previousDay.getTime();
      };

      var updateSessionMessage = function (sessionId, value) {
        chatStore.updateSessionMessage(sessionId, value);
      };

      var handleFileChange = function (event, sessionId) {
        var newFiles = Array.from(event.target.files || []);
        if (!newFiles.length) {
          return;
        }
        var session = chatStore.findSession(sessionId);
        if (session) {
          chatStore.updateSessionFiles(sessionId, session.attachedFiles.concat(newFiles));
        }
        event.target.value = '';
      };

      var removeFile = function (sessionId, index) {
        chatStore.removeSessionFile(sessionId, index);
      };

      var loadMessage = function (sessionId) {
        var session = sessionId ? chatStore.findSession(sessionId) : activeSession.value;

        if (!window.HashyAPIUtils.validateSessionState(session) || chatStore.isLoading) {
          return Promise.resolve();
        }

        chatStore.isLoading = true;

        return window.HashyAPIUtils.loadSessionMessages(session.sessionIdAi)
          .then(function (response) {
            if (response.success && Array.isArray(response.messages)) {
              var messages = response.messages.map(function (msg) {
                return window.HashyMessageUtils.createMessage(
                  msg.text,
                  msg.message_type === 'user' ? username.value : 'hashyAI',
                  msg.attachments || [],
                  {
                    id: msg.id,
                    timestamp: new Date(msg.created_at || Date.now()).toISOString(),
                    contextMentioned: msg.context_mentioned || null,
                  }
                );
              });

              if (messages.length > 0) {
                chatStore.prependMessages(session.id, messages);
                chatStore.updateSessionScroll(session.id, {
                  offset: (session.chatOffset || 0) + 10,
                });
              }
            }

            return Vue.nextTick().then(function () {
              chatStore.isLoading = false;
              smartScroll(200, sessionId);
            });
          })
          .catch(function (error) {
            console.error('Failed to load messages:', error);
            chatStore.isLoading = false;
          });
      };

      var sendMessage = function (sessionId) {
        var session = chatStore.findSession(sessionId);
        if (!session) return;

        var messageText = session.currentMessage.trim();

        if (!messageText || session.isThinking) return;

        var capturedSessionId = sessionId;
        var isTemporary = session.isTemporary;
        var filesToSend = session.attachedFiles.slice();
        var contextToSend = session.contextMentioned;

        var userMessage = window.HashyMessageUtils.createUserMessage(
          messageText,
          username.value,
          filesToSend.map(function (file) {
            return {
              filename: file.name,
              size: file.size,
              type: file.type,
            };
          }),
          contextToSend
        );

        chatStore.addMessage(capturedSessionId, userMessage);
        chatStore.updateSessionMessage(capturedSessionId, '');
        chatStore.clearSessionFiles(capturedSessionId);
        chatStore.clearSessionReplyContext(capturedSessionId);
        chatStore.updateSessionThinking(capturedSessionId, true);

        Vue.nextTick(function () {
          smartScroll(50, capturedSessionId);
        });

        var sessionIdToSend = isTemporary ? null : session.externalSessionId;

        window.HashyAPIUtils.sendChatMessage(
          messageText,
          sessionIdToSend ? String(sessionIdToSend) : null,
          filesToSend,
          {
            contextMentioned: contextToSend,
          }
        )
          .then(function (responseHashy) {
            if (responseHashy && responseHashy.response) {
              if (responseHashy.attachments && responseHashy.attachments.length > 0) {
                chatStore.updateMessage(capturedSessionId, userMessage.id, {
                  attachments: responseHashy.attachments,
                });
              }

              if (isTemporary) {
                chatStore.updateSessionToReal(capturedSessionId, responseHashy);
              }

              var aiMessage = window.HashyMessageUtils.createAIMessage(
                responseHashy.response.data || 'No response received',
                responseHashy.message_id
              );

              chatStore.addMessage(capturedSessionId, aiMessage);

              Vue.nextTick(function () {
                smartScroll(50, capturedSessionId);
              });
            }
          })
          .catch(function (error) {
            console.error('Failed to send message:', error);

            var errorInfo = window.HashyAPIUtils.handleApiError(error, layout);
            var errorMessage = window.HashyMessageUtils.createErrorMessage(
              errorInfo.message,
              errorInfo.title
            );

            chatStore.addMessage(capturedSessionId, errorMessage);

            Vue.nextTick(function () {
              smartScroll(50, capturedSessionId);
            });
          })
          .finally(function () {
            chatStore.updateSessionThinking(capturedSessionId, false);
          });
      };

      var handleKeyPress = function (event, sessionId) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage(sessionId);
        }
      };

      var handleScroll = function () {
        var chatEl = getCurrentChatElement();
        if (!chatEl || chatStore.isLoading) return;
        var scrollTop = chatEl.scrollTop;

        if (scrollTop < 10) {
          loadMessage();
        }
      };

      var getCurrentChatElement = function () {
        if (activeSession.value && activeSession.value.state === 'maximized') {
          return modalChatBodyRef.value;
        }
        return chatBodyRef.value;
      };

      var smartScroll = function (delay, sessionId) {
        delay = delay || 100;
        if (delay <= 0) {
          performScroll(sessionId);
        } else {
          setTimeout(function () {
            performScroll(sessionId);
          }, delay);
        }
      };

      var performScroll = function (sessionId) {
        var isMaximized = maximizedSession.value;
        var targetElement = null;

        if (isMaximized) {
          targetElement = modalChatBodyRef.value || document.querySelector('.hashy-modal-body');
        } else if (sessionId) {
          var container = document.querySelector("[data-session-id='" + sessionId + "']");
          if (container) {
            targetElement = container.querySelector('.chat-body');
          }
        } else {
          targetElement = chatBodyRef.value || document.querySelector('.chat-body');
        }

        if (targetElement && targetElement.scrollHeight > 0) {
          targetElement.scrollTop = targetElement.scrollHeight;
          return;
        }

        var fallbackSelectors = isMaximized
          ? ['.hashy-modal-body', '[data-session-id] .chat-body']
          : ['.chat-body', '[data-session-id] .chat-body', '.hashy-modal-body'];

        for (var i = 0; i < fallbackSelectors.length; i++) {
          var element = document.querySelector(fallbackSelectors[i]);
          if (element && element.scrollHeight > 0) {
            element.scrollTop = element.scrollHeight;
            break;
          }
        }
      };

      var formatTime = function (timestamp) {
        return window.HashyMessageUtils.formatTime(timestamp);
      };

      var formatFileSize = function (bytes) {
        return window.HashyMessageUtils.formatFileSize(bytes);
      };

      var selectionTooltip = null;
      var selectionFrame = null;
      var textMeasureContext = null;

      var ensureSelectionTooltip = function () {
        if (selectionTooltip && document.body.contains(selectionTooltip)) {
          return selectionTooltip;
        }
        selectionTooltip = document.querySelector('.hashy-selection-tooltip');
        return selectionTooltip;
      };

      var getTextMeasureContext = function () {
        if (textMeasureContext) return textMeasureContext;
        var canvas = document.createElement('canvas');
        textMeasureContext = canvas.getContext('2d');
        return textMeasureContext;
      };

      var clampValue = function (value, min, max) {
        return Math.min(Math.max(value, min), max);
      };

      var getRangeSelectionRect = function (range) {
        var rects = range.getClientRects();
        if (rects && rects.length) {
          return rects[0];
        }
        return range.getBoundingClientRect();
      };

      var getFontString = function (style) {
        if (style.font && style.font !== 'normal') {
          return style.font;
        }
        var lineHeight = style.lineHeight === 'normal' ? '1.2' : style.lineHeight;
        return [
          style.fontStyle || 'normal',
          style.fontVariant || 'normal',
          style.fontWeight || '400',
          style.fontSize + '/' + lineHeight,
          style.fontFamily || 'sans-serif',
        ].join(' ');
      };

      var getInputSelectionPosition = function (input) {
        if (!input || typeof input.selectionStart !== 'number') return null;
        var start = input.selectionStart;
        var end = input.selectionEnd;
        if (start === null || end === null || start === end) return null;

        var selectedText = input.value.slice(start, end);
        if (!selectedText.trim()) return null;

        var rect = input.getBoundingClientRect();
        var style = window.getComputedStyle(input);
        var paddingLeft = parseFloat(style.paddingLeft) || 0;
        var scrollLeft = input.scrollLeft || 0;
        var ctx = getTextMeasureContext();
        ctx.font = getFontString(style);

        var beforeText = input.value.slice(0, start);
        var beforeWidth = ctx.measureText(beforeText).width;
        var selectedWidth = ctx.measureText(selectedText).width;

        var lineHeight = parseFloat(style.lineHeight);
        if (!lineHeight || Number.isNaN(lineHeight)) {
          var fontSize = parseFloat(style.fontSize) || 14;
          lineHeight = fontSize * 1.2;
        }

        var x = rect.left + paddingLeft + beforeWidth - scrollLeft + selectedWidth / 2;
        var y = rect.top + (rect.height - lineHeight) / 2;

        return { x: x, y: y };
      };

      var getRangeSelectionPosition = function (range) {
        var rect = getRangeSelectionRect(range);
        if (!rect || rect.width === 0 || rect.height === 0) return null;
        return { x: rect.left + rect.width / 2, y: rect.top };
      };

      var getSelectionPosition = function () {
        var activeElement = document.activeElement;
        if (
          activeElement &&
          activeElement.classList &&
          activeElement.classList.contains('message-input') &&
          activeElement.closest('.hx-hashy-chat-view')
        ) {
          var inputPosition = getInputSelectionPosition(activeElement);
          if (inputPosition) {
            return inputPosition;
          }
        }

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
        if (!hashyMessage || !hashyMessage.closest('.hx-hashy-chat-view')) return null;

        return getRangeSelectionPosition(range);
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

        tooltip.style.setProperty('--hashy-selection-left', clampedX + 'px');
        tooltip.style.setProperty('--hashy-selection-top', top + 'px');
        tooltip.style.setProperty('--hashy-selection-arrow-offset', desiredX - clampedX + 'px');
        tooltip.classList.add('is-visible');
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

      var isDragging = Vue.ref(false);
      var dragSessionId = Vue.ref(null);
      var offsetX = Vue.ref(0);
      var offsetY = Vue.ref(0);

      var getChatboxStyle = function (session) {
        if (!session) return {};
        return {
          left: session.position.x + 'px',
          top: session.position.y + 'px',
          zIndex: session.zIndex || 1000,
        };
      };

      var startDrag = function (e, sessionId) {
        e.preventDefault();
        e.stopPropagation();
        var session = chatStore.findSession(sessionId);
        if (!session) return;
        isDragging.value = true;
        dragSessionId.value = sessionId;
        offsetX.value = e.clientX - session.position.x;
        offsetY.value = e.clientY - session.position.y;
        chatStore.bringToFront(sessionId);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
      };

      var onDrag = function (e) {
        if (!isDragging.value || !dragSessionId.value) return;
        var newPosition = {
          x: e.clientX - offsetX.value,
          y: e.clientY - offsetY.value,
        };
        chatStore.updateSessionPosition(dragSessionId.value, newPosition);
      };

      var stopDrag = function () {
        isDragging.value = false;
        dragSessionId.value = null;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
      };

      var minimizeChat = function (sessionId) {
        var session = sessionId ? chatStore.findSession(sessionId) : activeSession.value;
        if (session) {
          var chatContainer = document.querySelector(
            ".hashyai-chatbox-container[data-session-id='" + session.id + "']"
          );
          var modalBackdrop = document.querySelector('.hashy-modal-backdrop');

          if (session.state === 'maximized' && modalBackdrop) {
            var modalContainer = modalBackdrop.querySelector('.hashy-modal-container');

            modalBackdrop.classList.remove('fade-out');
            if (modalContainer) {
              modalContainer.classList.remove('slide-out');
            }
            modalBackdrop.offsetHeight;
            modalBackdrop.classList.add('fade-out');
            if (modalContainer) {
              modalContainer.classList.add('slide-out');
            }
            setTimeout(function () {
              chatStore.minimizeSession(session.id);
              modalBackdrop.classList.remove('fade-out');
              if (modalContainer) {
                modalContainer.classList.remove('slide-out');
              }
            }, 300);
          } else if (chatContainer) {
            chatContainer.classList.add('minimizing');
            setTimeout(function () {
              chatStore.minimizeSession(session.id);
              chatContainer.classList.remove('minimizing');
            }, 400);
          } else {
            chatStore.minimizeSession(session.id);
          }
        }
      };

      var maximizeChat = function (sessionId) {
        var session = sessionId ? chatStore.findSession(sessionId) : activeSession.value;
        if (session) {
          chatStore.maximizeSession(session.id);
        }
      };

      var normalizeChat = function (sessionId) {
        var session = sessionId ? chatStore.findSession(sessionId) : activeSession.value;
        if (session) {
          var modalBackdrop = document.querySelector('.hashy-modal-backdrop');

          if (modalBackdrop) {
            var modalContainer = modalBackdrop.querySelector('.hashy-modal-container');

            modalBackdrop.classList.remove('fade-out');
            if (modalContainer) {
              modalContainer.classList.remove('slide-out');
            }
            modalBackdrop.offsetHeight;
            modalBackdrop.classList.add('fade-out');
            if (modalContainer) {
              modalContainer.classList.add('slide-out');
            }
            setTimeout(function () {
              chatStore.normalizeSession(session.id);
              modalBackdrop.classList.remove('fade-out');
              if (modalContainer) {
                modalContainer.classList.remove('slide-out');
              }
            }, 300);
          } else {
            chatStore.normalizeSession(session.id);
          }
        }
      };

      var closeChat = function (sessionId) {
        var session = sessionId ? chatStore.findSession(sessionId) : activeSession.value;
        if (session) {
          chatStore.closeSession(session.id);
        }
      };

      var bringToFront = function (sessionId) {
        chatStore.bringToFront(sessionId);
      };

      Vue.watch(
        function () {
          return activeSessions.value.map(function (s) {
            return s.id;
          });
        },
        function (newSessionIds, oldSessionIds) {
          if (!Array.isArray(oldSessionIds)) oldSessionIds = [];

          var addedSessionIds = newSessionIds.filter(function (id) {
            return !oldSessionIds.includes(id);
          });

          if (addedSessionIds.length === 0) return;

          addedSessionIds.forEach(function (sessionId) {
            var session = chatStore.findSession(sessionId);

            if (!session || session.messages.length > 0) return;

            if (session.isResumed) {
              loadMessage(sessionId)
                .then(function () {
                  smartScroll(100, sessionId);
                })
                .catch(function (error) {
                  console.error('Failed to load messages for session:', sessionId, error);
                });
            } else {
              var welcomeMessage = window.HashyMessageUtils.createWelcomeMessage();
              chatStore.addMessage(sessionId, welcomeMessage);
              smartScroll(100, sessionId);
            }
          });
        },
        { immediate: true }
      );

      Vue.watch(
        function () {
          return activeSession.value ? activeSession.value.state : null;
        },
        function (newState, oldState) {
          if (newState === 'maximized') {
            Vue.nextTick(function () {
              smartScroll(100, maximizedSession.value ? maximizedSession.value.id : null);
            });
          }
        }
      );

      Vue.onMounted(function () {
        Vue.nextTick(function () {
          if (chatBodyRef.value && typeof chatBodyRef.value.addEventListener === 'function') {
            chatBodyRef.value.addEventListener('scroll', handleScroll);
          }
          if (
            modalChatBodyRef.value &&
            typeof modalChatBodyRef.value.addEventListener === 'function'
          ) {
            modalChatBodyRef.value.addEventListener('scroll', handleScroll);
          }
        });

        var handleTooltipClick = function (e) {
          var target = e.target;
          var tooltip = target.closest('.hashy-selection-tooltip');
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

        window._hashyTooltipClickHandler = handleTooltipClick;
      });

      Vue.onUnmounted(function () {
        if (chatBodyRef.value && typeof chatBodyRef.value.removeEventListener === 'function') {
          chatBodyRef.value.removeEventListener('scroll', handleScroll);
        }
        if (
          modalChatBodyRef.value &&
          typeof modalChatBodyRef.value.removeEventListener === 'function'
        ) {
          modalChatBodyRef.value.removeEventListener('scroll', handleScroll);
        }

        if (window._hashyTooltipClickHandler) {
          document.removeEventListener('mousedown', window._hashyTooltipClickHandler, true);
          document.removeEventListener('click', window._hashyTooltipClickHandler);
          window._hashyTooltipClickHandler = null;
        }

        document.removeEventListener('selectionchange', scheduleSelectionTooltipUpdate);
        document.removeEventListener('mouseup', scheduleSelectionTooltipUpdate);
        document.removeEventListener('keyup', scheduleSelectionTooltipUpdate);
        document.removeEventListener('touchend', scheduleSelectionTooltipUpdate);
        document.removeEventListener('scroll', scheduleSelectionTooltipUpdate, true);
        hideSelectionTooltip();
      });

      Vue.watch(
        function () {
          return activeSession.value ? activeSession.value.scrollPosition : null;
        },
        function (newPos) {
          if (newPos > 0) {
            Vue.nextTick(function () {
              var chatEl = getCurrentChatElement();
              if (chatEl) {
                chatEl.scrollTop = newPos;
              }
            });
          } else {
            smartScroll(50, activeSession.value ? activeSession.value.id : null);
          }
        }
      );

      var getFileIconClass = function (filename) {
        var fileType = window.HashyFileUtils.getFileType(filename);
        return window.HashyFileUtils.getFileIconClass(fileType);
      };

      var getFileIconSymbol = function (filename) {
        var fileType = window.HashyFileUtils.getFileType(filename);
        return window.HashyFileUtils.getFileIconSymbol(fileType);
      };

      var copyMessageText = function (sessionId, message) {
        if (!message || !message.text) return;

        var textToCopy = message.text;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(textToCopy)
            .then(function () {
              chatStore.updateSessionCopiedMessage(sessionId, message.id);
              setTimeout(function () {
                chatStore.updateSessionCopiedMessage(sessionId, null);
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
              chatStore.updateSessionCopiedMessage(sessionId, message.id);
              setTimeout(function () {
                chatStore.updateSessionCopiedMessage(sessionId, null);
              }, 2000);
            }
          } catch (err) {
            console.error('Failed to copy message:', err);
          }
          document.body.removeChild(textArea);
        }
      };

      var setReplyContext = function (sessionId, message) {
        if (!message) return;
        chatStore.updateSessionReplyContext(sessionId, message, message.text);
        Vue.nextTick(function () {
          var session = chatStore.findSession(sessionId);
          if (session && session.state === 'maximized') {
            var inputElement = document.querySelector(
              '.hashy-modal-body ~ .hashy-modal-input .message-input'
            );
            if (inputElement) {
              inputElement.focus();
            }
          } else {
            var chatContainer = document.querySelector(
              ".hashyai-chatbox-container[data-session-id='" + sessionId + "']"
            );
            if (chatContainer) {
              var inputElement = chatContainer.querySelector('.message-input');
              if (inputElement) {
                inputElement.focus();
              }
            }
          }
        });
      };

      var clearReplyContext = function (sessionId) {
        chatStore.clearSessionReplyContext(sessionId);
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
        if (!hashyMessage || !hashyMessage.closest('.hx-hashy-chat-view')) {
          return;
        }

        var chatboxContainer = hashyMessage.closest('.hashyai-chatbox-container');
        var modalBackdrop = hashyMessage.closest('.hashy-modal-backdrop');
        var sessionId = null;

        if (chatboxContainer) {
          sessionId = chatboxContainer.getAttribute('data-session-id');
        } else if (modalBackdrop && maximizedSession.value) {
          sessionId = maximizedSession.value.id;
        }

        if (!sessionId) {
          return;
        }

        chatStore.updateSessionReplyContext(sessionId, null, selectedText);

        hideSelectionTooltip();

        Vue.nextTick(function () {
          var session = chatStore.findSession(sessionId);
          if (session && session.state === 'maximized') {
            var inputElement = document.querySelector(
              '.hashy-modal-body ~ .hashy-modal-input .message-input'
            );
            if (inputElement) {
              inputElement.focus();
            }
          } else {
            var chatContainer = document.querySelector(
              ".hashyai-chatbox-container[data-session-id='" + sessionId + "']"
            );
            if (chatContainer) {
              var inputElement = chatContainer.querySelector('.message-input');
              if (inputElement) {
                inputElement.focus();
              }
            }
          }
        });

        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      };

      return {
        hashyCharacter: hashyCharacter,
        hashyCharacterGif: hashyCharacterGif,
        getChatboxStyle: getChatboxStyle,
        startDrag: startDrag,
        stopDrag: stopDrag,
        minimizeChat: minimizeChat,
        maximizeChat: maximizeChat,
        normalizeChat: normalizeChat,
        closeChat: closeChat,
        activeSession: activeSession,
        activeSessions: activeSessions,
        currentMessages: currentMessages,
        getMessagesForSession: getMessagesForSession,
        chatBodyRef: chatBodyRef,
        modalChatBodyRef: modalChatBodyRef,
        sendMessage: sendMessage,
        handleKeyPress: handleKeyPress,
        smartScroll: smartScroll,
        performScroll: performScroll,
        formatTime: formatTime,
        formatFileSize: formatFileSize,
        handleFileChange: handleFileChange,
        removeFile: removeFile,
        username: username,
        bringToFront: bringToFront,
        maximizedSession: maximizedSession,
        getFileIconClass: getFileIconClass,
        getFileIconSymbol: getFileIconSymbol,
        shouldShowDateBubble: shouldShowDateBubble,
        copyMessageText: copyMessageText,
        setReplyContext: setReplyContext,
        clearReplyContext: clearReplyContext,
        truncateText: truncateText,
        handleAskHashy: handleAskHashy,
        updateSessionMessage: updateSessionMessage,
      };
    },
  },
});
