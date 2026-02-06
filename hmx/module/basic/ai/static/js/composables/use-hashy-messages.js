(function () {
  'use strict';

  window.useHashyMessages = function (options) {
    options = options || {};

    var messages = Vue.ref(options.initialMessages || []);
    var isLoading = Vue.ref(false);
    var hasMore = Vue.ref(true);

    var addMessage = function (message) {
      if (window.HashyMessageUtils.validateMessage(message)) {
        messages.value.push(message);
        return true;
      }
      return false;
    };

    var prependMessages = function (newMessages) {
      if (Array.isArray(newMessages)) {
        messages.value = newMessages.concat(messages.value);
      }
    };

    var createUserMessage = function (text, username, attachments) {
      return window.HashyMessageUtils.createUserMessage(text, username, attachments);
    };

    var createAIMessage = function (text, messageId) {
      return window.HashyMessageUtils.createAIMessage(text, messageId);
    };

    var createErrorMessage = function (errorText, title) {
      return window.HashyMessageUtils.createErrorMessage(errorText, title);
    };

    var addUserMessage = function (text, username, attachments) {
      var message = createUserMessage(text, username, attachments);
      return addMessage(message);
    };

    var addAIMessage = function (text, messageId) {
      var message = createAIMessage(text, messageId);
      return addMessage(message);
    };

    var addErrorMessage = function (errorText, title) {
      var message = createErrorMessage(errorText, title);
      return addMessage(message);
    };

    var loadMessages = function (sessionId, offset) {
      if (isLoading.value || !sessionId) {
        return Promise.resolve();
      }

      isLoading.value = true;

      return window.HashyAPIUtils.loadSessionMessages(sessionId, offset)
        .then(function (response) {
          if (response.success && Array.isArray(response.messages)) {
            var formattedMessages = response.messages.map(function (msg) {
              return {
                id: msg.id,
                text: msg.text,
                sender: msg.message_type === 'user' ? options.username : 'hashyAI',
                timestamp: new Date(msg.created_at || Date.now()).toISOString(),
                attachments: msg.attachments || [],
              };
            });

            if (offset && offset > 0) {
              prependMessages(formattedMessages);
            } else {
              messages.value = formattedMessages;
            }

            hasMore.value = formattedMessages.length > 0;
          }

          isLoading.value = false;
          return response;
        })
        .catch(function (error) {
          console.error('Failed to load messages:', error);
          isLoading.value = false;
          throw error;
        });
    };

    var clearMessages = function () {
      messages.value = [];
    };

    var getMessageById = function (messageId) {
      return messages.value.find(function (msg) {
        return msg.id === messageId;
      });
    };

    var removeMessage = function (messageId) {
      var index = messages.value.findIndex(function (msg) {
        return msg.id === messageId;
      });

      if (index !== -1) {
        messages.value.splice(index, 1);
        return true;
      }

      return false;
    };

    var updateMessage = function (messageId, updates) {
      var message = getMessageById(messageId);
      if (message) {
        Object.assign(message, updates);
        return true;
      }
      return false;
    };

    var getLastMessage = function () {
      return messages.value.length > 0 ? messages.value[messages.value.length - 1] : null;
    };

    var getMessageCount = function () {
      return messages.value.length;
    };

    var formatTime = function (timestamp) {
      return window.HashyMessageUtils.formatTime(timestamp);
    };

    var formatFileSize = function (bytes) {
      return window.HashyMessageUtils.formatFileSize(bytes);
    };

    return {
      messages: messages,
      isLoading: isLoading,
      hasMore: hasMore,
      addMessage: addMessage,
      prependMessages: prependMessages,
      addUserMessage: addUserMessage,
      addAIMessage: addAIMessage,
      addErrorMessage: addErrorMessage,
      loadMessages: loadMessages,
      clearMessages: clearMessages,
      getMessageById: getMessageById,
      removeMessage: removeMessage,
      updateMessage: updateMessage,
      getLastMessage: getLastMessage,
      getMessageCount: getMessageCount,
      formatTime: formatTime,
      formatFileSize: formatFileSize,
      createUserMessage: createUserMessage,
      createAIMessage: createAIMessage,
      createErrorMessage: createErrorMessage,
    };
  };
})();
