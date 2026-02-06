VueComponent.push({
  name: 'hx-hashy-message-content',
  component: {
    props: {
      text: {
        type: String,
        required: true,
      },
      isMarkdown: {
        type: Boolean,
        default: true,
      },
    },
    template: `
      <div
        v-if="isMarkdown && renderedHtml"
        class="hashy-message-content hashy-markdown-content"
        v-html="renderedHtml"
        ref="contentRef"
      ></div>
      <div
        v-else
        class="hashy-message-content hashy-plain-content"
      >
        {{ text }}
      </div>
    `,
    setup: function (props) {
      var contentRef = Vue.ref(null);

      var renderedHtml = Vue.computed(function () {
        if (!props.isMarkdown || !props.text) {
          return '';
        }
        return window.HashyMarkdownUtils.renderMarkdown(props.text);
      });

      Vue.onMounted(function () {
        if (contentRef.value && props.isMarkdown) {
          window.HashyMarkdownUtils.addCopyButtons(contentRef.value);
        }
      });

      Vue.onUpdated(function () {
        if (contentRef.value && props.isMarkdown) {
          window.HashyMarkdownUtils.addCopyButtons(contentRef.value);
        }
      });

      return {
        renderedHtml: renderedHtml,
        contentRef: contentRef,
      };
    },
  },
});
