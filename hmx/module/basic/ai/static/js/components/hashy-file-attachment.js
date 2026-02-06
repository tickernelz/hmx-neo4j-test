VueComponent.push({
  name: 'hx-hashy-file-attachment',
  component: {
    props: {
      attachedFiles: {
        type: Array,
        default: function () {
          return [];
        },
      },
      sessionId: {
        type: String,
        default: 'default',
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      maxFiles: {
        type: Number,
        default: 10,
      },
    },
    emits: ['file-change', 'remove-file'],
    template: `
      <div class="attachment-preview-area" v-if="attachedFiles.length > 0">
        <div class="attached-file-card" v-for="(file, index) in attachedFiles" :key="index">
          <div class="file-icon">📄</div>
          <div class="file-name">{{ file.name }}</div>
          <div class="file-size">{{ formatFileSize(file.size) }}</div>
          <button class="remove-file-btn" @click="removeFile(index)" :disabled="disabled">✕</button>
        </div>
        <label
          v-if="canAddMore"
          :for="'attach-file-' + sessionId"
          class="attached-file-card add-more"
          :class="{ disabled: disabled }"
        >
          <div class="file-icon">➕</div>
          <div class="file-name">Add More Files</div>
        </label>
      </div>
    `,
    setup: function (props, { emit }) {
      var canAddMore = Vue.computed(function () {
        return props.attachedFiles.length < props.maxFiles;
      });

      var removeFile = function (index) {
        emit('remove-file', index);
      };

      var formatFileSize = function (bytes) {
        return window.HashyMessageUtils.formatFileSize(bytes);
      };

      return {
        canAddMore: canAddMore,
        removeFile: removeFile,
        formatFileSize: formatFileSize,
      };
    },
  },
});
