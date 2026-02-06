VueComponent.push({
  name: 'hx-hashy-thinking-indicator',
  component: {
    props: {
      show: {
        type: Boolean,
        default: false,
      },
      text: {
        type: String,
        default: '',
      },
    },
    template: `
      <div v-if="show" class="thinking-indicator">
        <div class="thinking-dots">
          <div class="thinking-dot"></div>
          <div class="thinking-dot"></div>
          <div class="thinking-dot"></div>
        </div>
        <span v-if="text" class="thinking-text">{{ text }}</span>
      </div>
    `,
    setup: function () {
      return {};
    },
  },
});
