const hashyMessageUtils = {
  formatTime: function (timestamp) {
    var date = new Date(timestamp);
    var now = new Date();

    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var yesterday = new Date(today.getTime() - 86400000);
    var dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    var minutesStr = minutes < 10 ? '0' + minutes : minutes;
    var timeStr = hours + ':' + minutesStr + ' ' + ampm;

    if (dateDay.getTime() === today.getTime()) {
      return 'Today\n' + timeStr;
    } else if (dateDay.getTime() === yesterday.getTime()) {
      return 'Yesterday\n' + timeStr;
    } else if (dateDay.getTime() > yesterday.getTime() - 3 * 86400000) {
      var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return dayNames[date.getDay()] + '\n' + timeStr;
    } else {
      var day = date.getDate();
      var month = date.getMonth() + 1;
      var year = date.getFullYear();
      var dayStr = day < 10 ? '0' + day : day;
      var monthStr = month < 10 ? '0' + month : month;
      return dayStr + '/' + monthStr + '/' + year + '\n' + timeStr;
    }
  },

  formatFileSize: function (bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  createMessage: function (text, sender, attachments, options) {
    options = options || {};
    return {
      id: options.id || Date.now(),
      text: text,
      sender: sender,
      timestamp: options.timestamp || new Date().toISOString(),
      attachments: attachments || [],
      contextMentioned: options.contextMentioned || null,
      isError: options.isError || false,
    };
  },

  createWelcomeMessage: function (username) {
    return this.createMessage(
      "Hello! I'm Hashy, your AI assistant. How can I help you today?",
      'hashyAI',
      [],
      { id: Date.now() }
    );
  },

  createErrorMessage: function (errorText, title) {
    title = title || 'Error';
    return this.createMessage(title + ': ' + errorText, 'system', [], { isError: true });
  },

  validateMessage: function (message) {
    return (
      message &&
      typeof message.text === 'string' &&
      message.text.trim().length > 0 &&
      message.sender
    );
  },

  createUserMessage: function (text, username, attachments, contextMentioned) {
    return this.createMessage(text, username, attachments, {
      contextMentioned: contextMentioned,
    });
  },

  createAIMessage: function (text, messageId) {
    return this.createMessage(text, 'hashyAI', [], { id: messageId || Date.now() });
  },
};

window.HashyMessageUtils = hashyMessageUtils;
