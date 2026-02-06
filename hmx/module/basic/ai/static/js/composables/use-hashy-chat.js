(function () {
  'use strict';

  window.useHashyChat = function (options) {
    options = options || {};

    var layout =
      options.layout || (typeof useLayoutStore !== 'undefined' ? useLayoutStore() : null);
    var envStore = options.envStore || (typeof useEnvStore !== 'undefined' ? useEnvStore() : null);
    var chatStore =
      options.chatStore || (typeof useHashyStore !== 'undefined' ? useHashyStore() : null);

    var username = Vue.computed(function () {
      return envStore ? envStore.identity.username : options.username || 'User';
    });

    var messagesComposable = window.useHashyMessages({
      username: username.value,
      initialMessages: options.initialMessages,
    });

    var filesComposable = window.useHashyFiles({
      maxFiles: options.maxFiles || 10,
      maxFileSize: options.maxFileSize,
      allowedTypes: options.allowedTypes,
    });

    var currentMessage = Vue.ref('');
    var isThinking = Vue.ref(false);
    var chatBodyRef = Vue.ref(null);
    var modalChatBodyRef = Vue.ref(null);

    var sendMessage = function (sessionId, messageOptions) {
      messageOptions = messageOptions || {};
      var messageText = currentMessage.value.trim();

      if (!messageText || isThinking.value) return Promise.resolve();

      var userMessage = messagesComposable.createUserMessage(
        messageText,
        username.value,
        filesComposable.formatAttachments()
      );

      messagesComposable.addMessage(userMessage);
      currentMessage.value = '';
      isThinking.value = true;

      Vue.nextTick(function () {
        scrollToBottom(50);
      });

      return window.HashyAPIUtils.sendChatMessage(
        messageText,
        sessionId ? String(sessionId) : null,
        filesComposable.attachedFiles.value,
        messageOptions
      )
        .then(function (response) {
          if (response && response.response) {
            if (
              messageOptions.onSessionUpdate &&
              typeof messageOptions.onSessionUpdate === 'function'
            ) {
              messageOptions.onSessionUpdate(response);
            }

            var aiMessage = messagesComposable.createAIMessage(
              response.response.data || 'No response received',
              response.message_id
            );

            messagesComposable.addMessage(aiMessage);

            Vue.nextTick(function () {
              scrollToBottom(50);
            });
          }

          return response;
        })
        .catch(function (error) {
          console.error('Failed to send message:', error);

          var errorInfo = window.HashyAPIUtils.handleApiError(error, layout);
          var errorMessage = messagesComposable.createErrorMessage(
            errorInfo.message,
            errorInfo.title
          );

          messagesComposable.addMessage(errorMessage);

          Vue.nextTick(function () {
            scrollToBottom(50);
          });

          throw error;
        })
        .finally(function () {
          isThinking.value = false;
          filesComposable.clearFiles();
        });
    };

    var handleKeyPress = function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(options.sessionId);
      }
    };

    var scrollToBottom = function (delay) {
      var element = getCurrentChatElement();
      if (element && window.HashyScrollUtils) {
        window.HashyScrollUtils.scrollToBottom(element, delay);
      }
    };

    var smartScroll = function (delay, behavior) {
      var element = getCurrentChatElement();
      if (element && window.HashyScrollUtils) {
        window.HashyScrollUtils.smartScroll(element, delay, behavior);
      }
    };

    var getCurrentChatElement = function () {
      if (!window.HashyScrollUtils) return null;
      return window.HashyScrollUtils.getCurrentChatElement(
        options.sessionState,
        chatBodyRef.value,
        modalChatBodyRef.value
      );
    };

    var handleScroll = function (event) {
      if (messagesComposable.isLoading.value) return;

      window.HashyScrollUtils.handleScrollLoad(
        event.target,
        function () {
          loadMoreMessages();
        },
        10
      );
    };

    var loadMoreMessages = function () {
      if (
        !options.sessionId ||
        messagesComposable.isLoading.value ||
        !messagesComposable.hasMore.value
      ) {
        return Promise.resolve();
      }

      var offset = messagesComposable.getMessageCount();

      return messagesComposable.loadMessages(options.sessionId, offset).then(function (response) {
        if (response.success) {
          Vue.nextTick(function () {
            smartScroll(200);
          });
        }
        return response;
      });
    };

    var initializeChat = function () {
      if (messagesComposable.getMessageCount() === 0) {
        var welcomeMessage = window.HashyMessageUtils.createWelcomeMessage();
        messagesComposable.addMessage(welcomeMessage);
        scrollToBottom(100);
      }
    };

    var loadChatHistory = function (sessionId) {
      if (!sessionId) return Promise.resolve();

      return messagesComposable
        .loadMessages(sessionId)
        .then(function (response) {
          if (response.success && messagesComposable.getMessageCount() === 0) {
            initializeChat();
          }
          Vue.nextTick(function () {
            scrollToBottom(100);
          });
          return response;
        })
        .catch(function (error) {
          console.warn('Could not load chat history, starting fresh chat');
          initializeChat();
          return { success: false, error: error };
        });
    };

    var resetChat = function () {
      messagesComposable.clearMessages();
      filesComposable.clearFiles();
      currentMessage.value = '';
      isThinking.value = false;
    };

    var addWelcomeMessage = function () {
      var welcomeMessage = window.HashyMessageUtils.createWelcomeMessage();
      messagesComposable.addMessage(welcomeMessage);
    };

    return {
      messages: messagesComposable.messages,
      currentMessage: currentMessage,
      isThinking: isThinking,
      chatBodyRef: chatBodyRef,
      modalChatBodyRef: modalChatBodyRef,
      attachedFiles: filesComposable.attachedFiles,
      username: username,
      sendMessage: sendMessage,
      handleKeyPress: handleKeyPress,
      handleFileChange: filesComposable.handleFileChange,
      removeFile: filesComposable.removeFile,
      scrollToBottom: scrollToBottom,
      smartScroll: smartScroll,
      handleScroll: handleScroll,
      loadMoreMessages: loadMoreMessages,
      initializeChat: initializeChat,
      loadChatHistory: loadChatHistory,
      resetChat: resetChat,
      addWelcomeMessage: addWelcomeMessage,
      formatTime: messagesComposable.formatTime,
      formatFileSize: messagesComposable.formatFileSize,
      isLoading: messagesComposable.isLoading,
      hasFiles: filesComposable.hasFiles,
      canAddMoreFiles: filesComposable.canAddMore,
      getFileCount: filesComposable.getFileCount,
      getTotalFileSize: filesComposable.getTotalSizeFormatted,
      validateFiles: filesComposable.validateFiles,
      addMessage: messagesComposable.addMessage,
      addUserMessage: messagesComposable.addUserMessage,
      addAIMessage: messagesComposable.addAIMessage,
      addErrorMessage: messagesComposable.addErrorMessage,
    };
  };
})();
