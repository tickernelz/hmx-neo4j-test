(function () {
  'use strict';

  window.useHashyFiles = function (options) {
    options = options || {};

    var attachedFiles = Vue.ref([]);
    var maxFiles = options.maxFiles || 1;
    var maxFileSize = options.maxFileSize || null;
    var allowedTypes = options.allowedTypes || null;

    var handleFileChange = function (event) {
      if (attachedFiles.value.length >= maxFiles) {
        console.warn('Maximum file limit reached: ' + maxFiles);
        event.target.value = '';
        return false;
      }

      var newFiles = window.HashyFileUtils.handleFileSelection(
        event,
        attachedFiles.value,
        maxFiles
      );

      if (
        allowedTypes &&
        !window.HashyFileUtils.validateFileTypes(
          newFiles.slice(attachedFiles.value.length),
          allowedTypes
        )
      ) {
        console.warn('Some files have invalid types');
        return false;
      }

      if (
        maxFileSize &&
        !window.HashyFileUtils.validateFileSize(
          newFiles.slice(attachedFiles.value.length),
          maxFileSize
        )
      ) {
        console.warn('Some files exceed size limit');
        return false;
      }

      attachedFiles.value = newFiles;
      return true;
    };

    var removeFile = function (index) {
      attachedFiles.value = window.HashyFileUtils.removeFileAtIndex(attachedFiles.value, index);
    };

    var clearFiles = function () {
      attachedFiles.value = [];
    };

    var getFilePreview = function (index) {
      var file = attachedFiles.value[index];
      if (!file) return null;

      return window.HashyFileUtils.getFilePreviewData(file);
    };

    var getAllFilePreviews = function () {
      return attachedFiles.value.map(function (file) {
        return window.HashyFileUtils.getFilePreviewData(file);
      });
    };

    var getTotalSize = function () {
      return window.HashyFileUtils.getTotalFileSize(attachedFiles.value);
    };

    var getTotalSizeFormatted = function () {
      return window.HashyMessageUtils.formatFileSize(getTotalSize());
    };

    var getFileCount = function () {
      return attachedFiles.value.length;
    };

    var hasFiles = Vue.computed(function () {
      return attachedFiles.value.length > 0;
    });

    var canAddMore = Vue.computed(function () {
      return attachedFiles.value.length < maxFiles;
    });

    var isAtLimit = Vue.computed(function () {
      return attachedFiles.value.length >= maxFiles;
    });

    var createAttachmentData = function () {
      return window.HashyFileUtils.createFileAttachmentData(attachedFiles.value);
    };

    var formatAttachments = function () {
      return window.HashyFileUtils.formatAttachmentDisplay(
        attachedFiles.value.map(function (file) {
          return {
            name: file.name,
            size: file.size,
          };
        })
      );
    };

    var validateFiles = function () {
      var isValid = true;
      var errors = [];

      if (
        allowedTypes &&
        !window.HashyFileUtils.validateFileTypes(attachedFiles.value, allowedTypes)
      ) {
        isValid = false;
        errors.push('Invalid file types detected');
      }

      if (
        maxFileSize &&
        !window.HashyFileUtils.validateFileSize(attachedFiles.value, maxFileSize)
      ) {
        isValid = false;
        errors.push('Files exceed size limit');
      }

      if (attachedFiles.value.length > maxFiles) {
        isValid = false;
        errors.push('Too many files attached');
      }

      return {
        isValid: isValid,
        errors: errors,
      };
    };

    var addFiles = function (files) {
      var fileArray = Array.isArray(files) ? files : Array.from(files);
      var totalFiles = attachedFiles.value.length + fileArray.length;

      if (totalFiles > maxFiles) {
        fileArray = fileArray.slice(0, maxFiles - attachedFiles.value.length);
      }

      attachedFiles.value = attachedFiles.value.concat(fileArray);
      return fileArray.length;
    };

    var replaceFiles = function (files) {
      attachedFiles.value = Array.isArray(files) ? files : Array.from(files);
      if (attachedFiles.value.length > maxFiles) {
        attachedFiles.value = attachedFiles.value.slice(0, maxFiles);
      }
    };

    return {
      attachedFiles: attachedFiles,
      maxFiles: maxFiles,
      maxFileSize: maxFileSize,
      allowedTypes: allowedTypes,
      handleFileChange: handleFileChange,
      removeFile: removeFile,
      clearFiles: clearFiles,
      getFilePreview: getFilePreview,
      getAllFilePreviews: getAllFilePreviews,
      getTotalSize: getTotalSize,
      getTotalSizeFormatted: getTotalSizeFormatted,
      getFileCount: getFileCount,
      hasFiles: hasFiles,
      canAddMore: canAddMore,
      isAtLimit: isAtLimit,
      createAttachmentData: createAttachmentData,
      formatAttachments: formatAttachments,
      validateFiles: validateFiles,
      addFiles: addFiles,
      replaceFiles: replaceFiles,
    };
  };
})();
