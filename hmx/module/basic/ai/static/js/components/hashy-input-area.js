VueComponent.push({
  name: 'hx-hashy-input-area',
  component: {
    props: {
      currentMessage: {
        type: String,
        default: '',
      },
      sessionId: {
        type: String,
        default: 'default',
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      placeholder: {
        type: String,
        default: 'Type your message here...',
      },
      showAudioButton: {
        type: Boolean,
        default: true,
      },
    },
    emits: ['update:currentMessage', 'send-message', 'file-change', 'key-press'],
    template: `
      <div class="input-message-area">
        <label
          :for="'attach-file-' + sessionId"
          class="attach-btn"
          :class="{ disabled: disabled }"
        >
          <svg class="smart-buttons icon-hashy-attachment" style="color: #757575">
            <use xlink:href="#icon-hashy-attachment"></use>
          </svg>
        </label>
        <input
          type="file"
          :id="'attach-file-' + sessionId"
          :name="'attach-file-' + sessionId"
          multiple
          @change="handleFileChange"
          style="display: none;"
        />
        <input
          type="text"
          class="message-input"
          :placeholder="placeholder"
          :value="currentMessage"
          @input="updateMessage"
          @keypress="handleKeyPress"
          :disabled="disabled"
        />
        <button
          v-if="showAudioButton"
          class="audio-btn"
          :disabled="disabled"
        >
          <svg class="smart-buttons icon-hashy-mic" style="color: #757575">
            <use xlink:href="#icon-hashy-mic"></use>
          </svg>
        </button>
        <button
          class="send-btn"
          @click="sendMessage"
          :disabled="disabled || !currentMessage || !currentMessage.trim()"
        >
          <svg class="smart-buttons icon-hashy-send">
            <use xlink:href="#icon-hashy-send"></use>
          </svg>
        </button>
      </div>
    `,
    setup: function (props, { emit }) {
      var updateMessage = function (event) {
        emit('update:currentMessage', event.target.value);
      };

      var sendMessage = function () {
        if (!props.disabled && props.currentMessage && props.currentMessage.trim()) {
          emit('send-message');
        }
      };

      var handleFileChange = function (event) {
        emit('file-change', event);
      };

      var handleKeyPress = function (event) {
        emit('key-press', event);
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      };

      return {
        updateMessage: updateMessage,
        sendMessage: sendMessage,
        handleFileChange: handleFileChange,
        handleKeyPress: handleKeyPress,
      };
    },
  },
});
