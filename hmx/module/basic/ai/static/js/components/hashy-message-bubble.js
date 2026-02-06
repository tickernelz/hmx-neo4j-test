VueComponent.push({
  name: 'hx-hashy-message-bubble',
  component: {
    props: {
      message: {
        type: Object,
        required: true,
      },
      username: {
        type: String,
        default: 'User',
      },
      showTimestamp: {
        type: Boolean,
        default: true,
      },
    },
    template: `
      <div :class="['message-wrapper', message.sender === username ? 'user' : 'hashy']">
        <div v-if="message.attachments && message.attachments.length" class="attachments">
          <div
            v-for="(file, index) in message.attachments"
            :key="index"
            class="attachment-item"
          >
            <span class="file-icon">📄</span>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">({{ formatFileSize(file.size) }})</span>
          </div>
        </div>
        <div
          :class="[
            'message-bubble',
            message.sender === username ? 'user-message' : 'hashy-message',
            { 'error-message': message.isError }
          ]"
        >
          {{ message.text }}
        </div>
        <div
          v-if="showTimestamp"
          :class="[
            'message-timestamp',
            message.sender === username ? 'user-timestamp' : 'hashy-timestamp',
          ]"
        >
          {{ formatTime(message.timestamp) }}
        </div>
      </div>
    `,
    setup: function (props) {
      var formatTime = function (timestamp) {
        return window.HashyMessageUtils.formatTime(timestamp);
      };

      var formatFileSize = function (bytes) {
        return window.HashyMessageUtils.formatFileSize(bytes);
      };

      return {
        formatTime: formatTime,
        formatFileSize: formatFileSize,
      };
    },
  },
});
