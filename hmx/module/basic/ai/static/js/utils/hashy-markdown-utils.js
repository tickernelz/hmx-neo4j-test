const hashyMarkdownUtils = {
  configureMarked: function () {
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false,
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: false,
        highlight: function (code, lang) {
          if (typeof hljs !== 'undefined' && lang) {
            try {
              if (hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
              }
            } catch (err) {
              console.error('Highlight.js error:', err);
            }
          }
          return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        },
      });
    }
  },

  renderMarkdown: function (markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    this.configureMarked();

    try {
      var rawHtml = marked.parse(markdown);

      var cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'u',
          's',
          'del',
          'code',
          'pre',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'blockquote',
          'hr',
          'a',
          'img',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'div',
          'span',
        ],
        ALLOWED_ATTR: [
          'href',
          'title',
          'target',
          'rel',
          'src',
          'alt',
          'width',
          'height',
          'class',
          'align',
        ],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'],
      });

      return cleanHtml;
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  },

  hasMarkdownSyntax: function (text) {
    if (!text) return false;

    var markdownPatterns = [
      /\*\*.*\*\*/,
      /\*.*\*/,
      /^#{1,6}\s/m,
      /\[.*\]\(.*\)/,
      /```[\s\S]*```/,
      /`.*`/,
      /^[-*+]\s/m,
      /^\d+\.\s/m,
      /^>\s/m,
    ];

    return markdownPatterns.some(function (pattern) {
      return pattern.test(text);
    });
  },

  addCopyButtons: function (container) {
    if (!container) return;

    var codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(function (codeBlock) {
      var pre = codeBlock.parentElement;
      if (!pre || pre.querySelector('.hashy-copy-btn')) return;

      var copyBtn = document.createElement('button');
      copyBtn.className = 'hashy-copy-btn';
      copyBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      copyBtn.title = 'Copy code';

      copyBtn.addEventListener('click', function () {
        var code = codeBlock.textContent || '';
        navigator.clipboard
          .writeText(code)
          .then(function () {
            copyBtn.innerHTML =
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            copyBtn.classList.add('copied');
            setTimeout(function () {
              copyBtn.innerHTML =
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
              copyBtn.classList.remove('copied');
            }, 2000);
          })
          .catch(function (err) {
            console.error('Failed to copy:', err);
          });
      });

      if (!pre.parentElement.classList.contains('hashy-code-block-wrapper')) {
        var wrapper = document.createElement('div');
        wrapper.className = 'hashy-code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
        wrapper.appendChild(copyBtn);
      }
    });
  },
};

window.HashyMarkdownUtils = hashyMarkdownUtils;
