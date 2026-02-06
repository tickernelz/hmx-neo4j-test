(function () {
  'use strict';

  window.HashyFileIcon = {
    name: 'hashy-file-icon',
    props: {
      filename: {
        type: String,
        required: true,
      },
    },
    setup: function (props) {
      var fileType = Vue.computed(function () {
        return window.HashyFileUtils.getFileType(props.filename);
      });

      var iconClass = Vue.computed(function () {
        return window.HashyFileUtils.getFileIconClass(fileType.value);
      });

      var iconSymbol = Vue.computed(function () {
        return window.HashyFileUtils.getFileIconSymbol(fileType.value);
      });

      return {
        fileType: fileType,
        iconClass: iconClass,
        iconSymbol: iconSymbol,
      };
    },
    template: `
      <div class="hashy-file-icon-wrapper">
        <svg :class="['hashy-file-icon', iconClass]">
          <use :xlink:href="'#' + iconSymbol"></use>
        </svg>
      </div>
    `,
  };
})();
