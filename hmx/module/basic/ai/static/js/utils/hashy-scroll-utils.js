const hashyScrollUtils = {
  smartScroll: function (element, delay, behavior) {
    delay = delay || 100;
    behavior = behavior || 'smooth';

    if (delay <= 0) {
      this.performScroll(element, behavior);
    } else {
      setTimeout(function () {
        window.HashyScrollUtils.performScroll(element, behavior);
      }, delay);
    }
  },

  performScroll: function (element, behavior) {
    behavior = behavior || 'auto';

    if (element && element.scrollHeight > 0) {
      if (behavior === 'smooth' && element.scrollTo) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        element.scrollTop = element.scrollHeight;
      }
      return true;
    }
    return false;
  },

  scrollToBottom: function (element, delay) {
    delay = delay || 0;

    if (delay > 0) {
      setTimeout(function () {
        window.HashyScrollUtils.performScroll(element);
      }, delay);
    } else {
      Vue.nextTick(function () {
        window.HashyScrollUtils.performScroll(element);
      });
    }
  },

  getCurrentChatElement: function (sessionState, chatBodyRef, modalChatBodyRef) {
    if (sessionState && sessionState.state === 'maximized') {
      return modalChatBodyRef || document.querySelector('.hashy-modal-body');
    }
    return chatBodyRef || document.querySelector('.chat-body');
  },

  performScrollWithFallback: function (isMaximized, chatBodyRef, modalChatBodyRef) {
    var targetElement = null;

    if (isMaximized) {
      targetElement = modalChatBodyRef || document.querySelector('.hashy-modal-body');
    } else {
      targetElement = chatBodyRef || document.querySelector('.chat-body');
    }

    if (this.performScroll(targetElement)) {
      return true;
    }

    var fallbackSelectors = isMaximized
      ? ['.hashy-modal-body', '[data-session-id] .chat-body']
      : ['.chat-body', '[data-session-id] .chat-body', '.hashy-modal-body'];

    for (var i = 0; i < fallbackSelectors.length; i++) {
      var element = document.querySelector(fallbackSelectors[i]);
      if (this.performScroll(element)) {
        return true;
      }
    }

    return false;
  },

  handleScrollLoad: function (element, loadCallback, threshold) {
    threshold = threshold || 10;

    if (!element || !loadCallback) return;

    var scrollTop = element.scrollTop;
    if (scrollTop < threshold) {
      loadCallback();
    }
  },

  createScrollHandler: function (loadCallback, threshold) {
    threshold = threshold || 10;

    return function (event) {
      var element = event.target;
      window.HashyScrollUtils.handleScrollLoad(element, loadCallback, threshold);
    };
  },

  isScrolledToBottom: function (element, threshold) {
    threshold = threshold || 5;

    if (!element) return false;

    return element.scrollTop + element.clientHeight >= element.scrollHeight - threshold;
  },

  scrollToPosition: function (element, position, behavior) {
    behavior = behavior || 'auto';

    if (!element) return false;

    if (behavior === 'smooth' && element.scrollTo) {
      element.scrollTo({
        top: position,
        behavior: 'smooth',
      });
    } else {
      element.scrollTop = position;
    }

    return true;
  },
};

window.HashyScrollUtils = hashyScrollUtils;
