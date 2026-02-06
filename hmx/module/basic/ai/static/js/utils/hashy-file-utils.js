const hashyFileUtils = {
  handleFileSelection: function (event, currentFiles, maxFiles) {
    maxFiles = maxFiles || 10;
    var newFiles = Array.from(event.target.files || []);
    if (!newFiles.length) return currentFiles;

    var totalFiles = currentFiles.length + newFiles.length;
    if (totalFiles > maxFiles) {
      newFiles = newFiles.slice(0, maxFiles - currentFiles.length);
    }

    event.target.value = '';
    return currentFiles.concat(newFiles);
  },

  removeFileAtIndex: function (files, index) {
    var newFiles = files.slice();
    newFiles.splice(index, 1);
    return newFiles;
  },

  validateFileTypes: function (files, allowedTypes) {
    if (!allowedTypes || !allowedTypes.length) return true;

    return files.every(function (file) {
      var extension = file.name.split('.').pop().toLowerCase();
      return allowedTypes.includes(extension);
    });
  },

  getFilePreviewData: function (file) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: file.name.split('.').pop().toLowerCase(),
      sizeFormatted: window.HashyMessageUtils.formatFileSize(file.size),
    };
  },

  formatAttachmentDisplay: function (attachments) {
    if (!attachments || !attachments.length) return [];

    return attachments.map(function (attachment) {
      return {
        name: attachment.name,
        size: attachment.size,
        sizeFormatted: window.HashyMessageUtils.formatFileSize(attachment.size || 0),
      };
    });
  },

  createFileAttachmentData: function (files) {
    return Array.from(files).map(function (file) {
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
      };
    });
  },

  validateFileSize: function (files, maxSizeBytes) {
    if (!maxSizeBytes) return true;

    return files.every(function (file) {
      return file.size <= maxSizeBytes;
    });
  },

  getTotalFileSize: function (files) {
    return files.reduce(function (total, file) {
      return total + (file.size || 0);
    }, 0);
  },

  getFileType: function (filename) {
    if (!filename) return 'generic';
    var ext = filename.split('.').pop().toLowerCase();
    var typeMap = {
      pdf: 'pdf',
      doc: 'document',
      docx: 'document',
      xls: 'spreadsheet',
      xlsx: 'spreadsheet',
      csv: 'spreadsheet',
      ppt: 'presentation',
      pptx: 'presentation',
      jpg: 'image',
      jpeg: 'image',
      png: 'image',
      gif: 'image',
      svg: 'image',
      webp: 'image',
      zip: 'archive',
      rar: 'archive',
      '7z': 'archive',
      tar: 'archive',
      gz: 'archive',
      txt: 'text',
      md: 'text',
      json: 'code',
      js: 'code',
      py: 'code',
      html: 'code',
      css: 'code',
    };
    return typeMap[ext] || 'generic';
  },

  getFileIconClass: function (fileType) {
    var iconMap = {
      pdf: 'file-icon-pdf',
      document: 'file-icon-document',
      spreadsheet: 'file-icon-spreadsheet',
      presentation: 'file-icon-presentation',
      image: 'file-icon-image',
      archive: 'file-icon-archive',
      text: 'file-icon-text',
      code: 'file-icon-code',
      generic: 'file-icon-generic',
    };
    return iconMap[fileType] || 'file-icon-generic';
  },

  getFileIconSymbol: function (fileType) {
    var symbolMap = {
      pdf: 'icon-document',
      document: 'icon-document',
      spreadsheet: 'icon-document',
      presentation: 'icon-document',
      image: 'icon-document',
      archive: 'icon-archive-minimalistic-outline',
      text: 'icon-document',
      code: 'icon-document',
      generic: 'icon-document',
    };
    return symbolMap[fileType] || 'icon-document';
  },

  getFileIconSymbol: function (fileType) {
    var symbolMap = {
      pdf: 'icon-document',
      document: 'icon-document',
      spreadsheet: 'icon-document',
      presentation: 'icon-document',
      image: 'icon-document',
      archive: 'icon-archive-minimalistic-outline',
      text: 'icon-document',
      code: 'icon-document',
      generic: 'icon-document',
    };
    return symbolMap[fileType] || 'icon-document';
  },
};

window.HashyFileUtils = hashyFileUtils;
