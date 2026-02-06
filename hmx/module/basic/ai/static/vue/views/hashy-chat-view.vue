<template name="hx-hashy-chat-view">
  <div class="hx-hashy-chat-view">
    <div
      class="hashy-modal-backdrop"
      v-show="maximizedSession"
      @click="() => normalizeChat(maximizedSession?.id)"
    >
      <div class="hashy-modal-container" @click.stop>
        <div class="hashy-modal-header">
          <div class="modal-title">
            <span>Hi! I'm Hashy</span>
          </div>
          <div class="modal-controls">
            <button
              class="control-btn minimize-btn"
              @click="() => minimizeChat(maximizedSession?.id)"
              title="Minimize"
            >
              <svg class="smart-buttons icon-hashy-strip">
                <use xlink:href="#icon-hashy-strip"></use>
              </svg>
            </button>
            <button
              class="control-btn normalize-btn"
              @click="() => normalizeChat(maximizedSession?.id)"
              title="Normalize"
            >
              <svg class="smart-buttons icon-hashy-normalize">
                <use xlink:href="#icon-hashy-normalize"></use>
              </svg>
            </button>
            <button
              class="control-btn close-btn"
              @click="() => closeChat(maximizedSession?.id)"
              title="Close"
            >
              <svg class="smart-buttons icon-hashy-x">
                <use xlink:href="#icon-hashy-x"></use>
              </svg>
            </button>
          </div>
        </div>
        <div v-if="maximizedSession?.name" class="hashy-session-header">
          <span class="session-name">{{ maximizedSession.name }}</span>
        </div>
        <div class="hashy-modal-body" ref="modalChatBodyRef">
          <div
            v-for="(message, index) in getMessagesForSession(maximizedSession?.id || '')"
            :key="message.id"
          >
            <div
              v-if="
                shouldShowDateBubble(
                  message,
                  getMessagesForSession(maximizedSession?.id || '')[index - 1]
                )
              "
              class="date-bubble-separator"
            >
              <span class="date-bubble-text">
                {{ formatTime(message.timestamp).split('\n')[0] || '' }}
              </span>
            </div>
            <div :class="['message-wrapper', message.sender === username ? 'user' : 'hashy']">
              <div
                v-if="message.sender === username && message.contextMentioned"
                class="user-context-preview"
              >
                <svg class="context-arrow-icon" style="rotate: 180deg">
                  <use xlink:href="#icon-reply-outline"></use>
                </svg>
                <div class="context-preview-text">
                  {{ truncateText(message.contextMentioned, 150) }}
                </div>
              </div>
              <div
                v-if="message.attachments && message.attachments.length"
                class="hashy-attachment-sent"
              >
                <div
                  v-for="(file, index) in message.attachments"
                  :key="index"
                  class="hashy-attachment-item"
                >
                  <div class="hashy-file-icon-wrapper">
                    <svg :class="['hashy-file-icon', getFileIconClass(file.filename)]">
                      <use :xlink:href="'#' + getFileIconSymbol(file.filename)"></use>
                    </svg>
                  </div>
                  <div class="hashy-file-info">
                    <a
                      v-if="file.url"
                      :href="file.url"
                      :download="file.filename"
                      target="_blank"
                      class="hashy-file-name"
                    >
                      {{ file.filename }}
                    </a>
                    <span v-else class="hashy-file-name">{{ file.filename }}</span>
                    <span class="hashy-file-size">{{ formatFileSize(file.size) }}</span>
                    <span v-if="!file.url" class="hashy-upload-status">Uploading...</span>
                  </div>
                </div>
              </div>
              <div
                :class="[
                  'message-bubble',
                  message.sender === username ? 'user-message' : 'hashy-message',
                ]"
                :tabindex="message.sender === username ? null : 0"
              >
                <hx-hashy-message-content
                  :text="message.text"
                  :is-markdown="message.sender !== username"
                />
              </div>
              <div
                :class="[
                  'message-timestamp',
                  message.sender === username ? 'user-timestamp' : 'hashy-timestamp',
                ]"
              >
                <span class="timestamp-time">
                  {{ formatTime(message.timestamp).split('\n')[1] || '' }}
                </span>
              </div>
              <div class="message-actions" aria-hidden="true">
                <span
                  class="message-action"
                  :class="{ copied: message.id === maximizedSession?.copiedMessageId }"
                  @click="() => copyMessageText(maximizedSession?.id, message)"
                  title="Copy"
                >
                  <svg
                    v-if="message.id !== maximizedSession?.copiedMessageId"
                    class="smart-buttons icon-hashy-copy"
                    aria-hidden="true"
                  >
                    <use xlink:href="#icon-hashy-copy"></use>
                  </svg>
                  <svg v-else class="smart-buttons icon-check-circle" aria-hidden="true">
                    <use xlink:href="#icon-check-circle-outline"></use>
                  </svg>
                </span>
                <span
                  class="message-action"
                  @click="() => setReplyContext(maximizedSession?.id, message)"
                  title="Reply"
                >
                  <svg class="smart-buttons icon-reply" aria-hidden="true">
                    <use xlink:href="#icon-reply-outline"></use>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <div v-if="maximizedSession?.isThinking" class="thinking-indicator">
            <div class="thinking-bubble">
              <svg class="smart-buttons thinking-sparkle sparkle-top-left" aria-hidden="true">
                <use xlink:href="#icon-hashy-sparkles"></use>
              </svg>
              <svg class="smart-buttons thinking-sparkle sparkle-top-right" aria-hidden="true">
                <use xlink:href="#icon-hashy-sparkles"></use>
              </svg>
              <svg class="smart-buttons thinking-sparkle sparkle-bottom" aria-hidden="true">
                <use xlink:href="#icon-hashy-sparkles"></use>
              </svg>
              <div class="thinking-dots" aria-hidden="true">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
              </div>
              <div class="thinking-text">Hashy is thinking...</div>
            </div>
          </div>
        </div>
        <div class="hashy-modal-input">
          <div
            v-if="maximizedSession?.replyingToMessage || maximizedSession?.contextMentioned"
            class="hashy-reply-preview"
          >
            <svg class="reply-arrow-icon" style="rotate: 180deg">
              <use xlink:href="#icon-reply-outline"></use>
            </svg>
            <div class="reply-preview-text">
              {{
                truncateText(
                  maximizedSession?.replyingToMessage
                    ? maximizedSession.replyingToMessage.text
                    : maximizedSession?.contextMentioned,
                  200
                )
              }}
            </div>
            <button class="reply-close-btn" @click="() => clearReplyContext(maximizedSession?.id)">
              <svg>
                <use xlink:href="#icon-hashy-x"></use>
              </svg>
            </button>
          </div>
          <div class="input-message-area">
            <label
              :for="'modal-attach-file-' + (maximizedSession?.id || 'default')"
              class="attach-btn"
              :class="{
                disabled:
                  maximizedSession?.isThinking ||
                  (maximizedSession?.attachedFiles?.length || 0) >= 1,
              }"
            >
              <svg class="smart-buttons icon-hashy-attachment" style="color: #757575">
                <use xlink:href="#icon-hashy-attachment"></use>
              </svg>
            </label>
            <input
              type="file"
              :id="'modal-attach-file-' + (maximizedSession?.id || 'default')"
              :name="'modal-attach-file-' + (maximizedSession?.id || 'default')"
              @change="e => handleFileChange(e, maximizedSession?.id)"
            />
            <input
              type="text"
              class="message-input"
              placeholder="Type your message here..."
              :value="maximizedSession?.currentMessage || ''"
              @input="e => updateSessionMessage(maximizedSession?.id, e.target.value)"
              @keypress="e => handleKeyPress(e, maximizedSession?.id)"
              :disabled="maximizedSession?.isThinking"
            />
            <button class="audio-btn">
              <svg class="smart-buttons icon-hashy-mic" style="color: #757575">
                <use xlink:href="#icon-hashy-mic"></use>
              </svg>
            </button>
            <button
              class="send-btn"
              @click="() => sendMessage(maximizedSession?.id)"
              :disabled="maximizedSession?.isThinking"
            >
              <svg class="smart-buttons icon-hashy-send">
                <use xlink:href="#icon-hashy-send"></use>
              </svg>
            </button>
          </div>
          <div
            class="hashy-attachment-preview"
            v-if="(maximizedSession?.attachedFiles?.length || 0) > 0"
          >
            <div
              class="hashy-attachment-item"
              v-for="(file, index) in maximizedSession?.attachedFiles"
              :key="index"
            >
              <div class="hashy-file-icon-wrapper">
                <svg :class="['hashy-file-icon', getFileIconClass(file.name)]">
                  <use :xlink:href="'#' + getFileIconSymbol(file.name)"></use>
                </svg>
              </div>
              <div class="hashy-file-info">
                <div class="hashy-file-name">{{ file.name }}</div>
                <div class="hashy-file-size">{{ formatFileSize(file.size) }}</div>
              </div>
              <button
                class="hashy-remove-file-btn"
                @click="() => removeFile(maximizedSession?.id, index)"
              >
                <svg>
                  <use xlink:href="#icon-close-outline"></use>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-for="session in activeSessions"
      :key="session.id"
      class="hashyai-chatbox-container"
      :data-session-id="session.id"
      v-show="session.state === 'normal'"
    >
      <div
        class="hashyai-chatbox"
        :style="getChatboxStyle(session)"
        @click="() => bringToFront(session.id)"
      >
        <div class="chat-header" @mousedown="e => startDrag(e, session.id)">
          <div class="character-section">
            <img :src="hashyCharacterGif" alt="Hashy Character" class="character-image" />
          </div>
          <div class="title-section">
            <p class="chat-title">Hi! I'm Hashy</p>
          </div>
          <div class="controls-section">
            <button
              class="control-btn minimize-btn"
              @click="() => minimizeChat(session.id)"
              title="Minimize"
            >
              <svg class="smart-buttons icon-hashy-strip">
                <use xlink:href="#icon-hashy-strip"></use>
              </svg>
            </button>
            <button
              class="control-btn maximize-btn"
              @click="() => maximizeChat(session.id)"
              title="Maximize"
            >
              <svg class="smart-buttons icon-hashy-maximize">
                <use xlink:href="#icon-hashy-maximize"></use>
              </svg>
            </button>
            <button
              class="control-btn close-btn"
              @click="() => closeChat(session.id)"
              title="Close"
            >
              <svg class="smart-buttons icon-hashy-x">
                <use xlink:href="#icon-hashy-x"></use>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="session.name" class="hashy-session-header">
          <span class="session-name">{{ session.name }}</span>
        </div>

        <div class="chat-body" :ref="session.id === activeSession?.id ? 'chatBodyRef' : null">
          <div v-for="(message, index) in getMessagesForSession(session.id)" :key="message.id">
            <div
              v-if="shouldShowDateBubble(message, getMessagesForSession(session.id)[index - 1])"
              class="date-bubble-separator"
            >
              <span class="date-bubble-text">
                {{ formatTime(message.timestamp).split('\n')[0] || '' }}
              </span>
            </div>
            <div :class="['message-wrapper', message.sender === username ? 'user' : 'hashy']">
              <div
                v-if="message.sender === username && message.contextMentioned"
                class="user-context-preview"
              >
                <svg class="context-arrow-icon" style="rotate: 180deg">
                  <use xlink:href="#icon-reply-outline"></use>
                </svg>
                <div class="context-preview-text">
                  {{ truncateText(message.contextMentioned, 150) }}
                </div>
              </div>
              <div
                v-if="message.attachments && message.attachments.length"
                class="hashy-attachment-sent"
              >
                <div
                  v-for="(file, index) in message.attachments"
                  :key="index"
                  class="hashy-attachment-item"
                >
                  <div class="hashy-file-icon-wrapper">
                    <svg :class="['hashy-file-icon', getFileIconClass(file.filename)]">
                      <use :xlink:href="'#' + getFileIconSymbol(file.filename)"></use>
                    </svg>
                  </div>
                  <div class="hashy-file-info">
                    <a
                      v-if="file.url"
                      :href="file.url"
                      :download="file.filename"
                      target="_blank"
                      class="hashy-file-name"
                    >
                      {{ file.filename }}
                    </a>
                    <span v-else class="hashy-file-name">{{ file.filename }}</span>
                    <span class="hashy-file-size">{{ formatFileSize(file.size) }}</span>
                    <span v-if="!file.url" class="hashy-upload-status">Uploading...</span>
                  </div>
                </div>
              </div>
              <div
                :class="[
                  'message-bubble',
                  message.sender === username ? 'user-message' : 'hashy-message',
                ]"
                :tabindex="message.sender === username ? null : 0"
              >
                <hx-hashy-message-content
                  :text="message.text"
                  :is-markdown="message.sender !== username"
                />
              </div>
              <div
                :class="[
                  'message-timestamp',
                  message.sender === username ? 'user-timestamp' : 'hashy-timestamp',
                ]"
              >
                <span class="timestamp-time">
                  {{ formatTime(message.timestamp).split('\n')[1] || '' }}
                </span>
              </div>
              <div class="message-actions" aria-hidden="true">
                <span
                  class="message-action"
                  :class="{ copied: message.id === session.copiedMessageId }"
                  @click="() => copyMessageText(session.id, message)"
                  title="Copy"
                >
                  <svg
                    v-if="message.id !== session.copiedMessageId"
                    class="smart-buttons icon-hashy-copy"
                    aria-hidden="true"
                  >
                    <use xlink:href="#icon-hashy-copy"></use>
                  </svg>
                  <svg v-else class="smart-buttons icon-check-circle" aria-hidden="true">
                    <use xlink:href="#icon-check-circle-outline"></use>
                  </svg>
                </span>
                <span
                  class="message-action"
                  @click="() => setReplyContext(session.id, message)"
                  title="Reply"
                >
                  <svg class="smart-buttons icon-reply" aria-hidden="true">
                    <use xlink:href="#icon-reply-outline"></use>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <div v-if="session.isThinking" class="thinking-indicator">
            <div class="thinking-bubble">
              <svg class="smart-buttons thinking-sparkle sparkle-top-left" aria-hidden="true">
                <use xlink:href="#icon-hashy-sparkles"></use>
              </svg>
              <svg class="smart-buttons thinking-sparkle sparkle-top-right" aria-hidden="true">
                <use xlink:href="#icon-hashy-sparkles"></use>
              </svg>
              <svg class="smart-buttons thinking-sparkle sparkle-bottom" aria-hidden="true">
                <use xlink:href="#icon-hashy-sparkles"></use>
              </svg>
              <div class="thinking-dots" aria-hidden="true">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
              </div>
              <div class="thinking-text">Hashy is thinking...</div>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <div
            v-if="session.replyingToMessage || session.contextMentioned"
            class="hashy-reply-preview"
          >
            <svg class="reply-arrow-icon" style="rotate: 180deg">
              <use xlink:href="#icon-reply-outline"></use>
            </svg>
            <div class="reply-preview-text">
              {{
                truncateText(
                  session.replyingToMessage
                    ? session.replyingToMessage.text
                    : session.contextMentioned,
                  200
                )
              }}
            </div>
            <button class="reply-close-btn" @click="() => clearReplyContext(session.id)">
              <svg>
                <use xlink:href="#icon-hashy-x"></use>
              </svg>
            </button>
          </div>
          <div class="input-message-area">
            <label
              :for="'attach-file-' + session.id"
              class="attach-btn"
              :class="{ disabled: session.isThinking || (session.attachedFiles?.length || 0) >= 1 }"
            >
              <svg class="smart-buttons icon-hashy-attachment" style="color: #757575">
                <use xlink:href="#icon-hashy-attachment"></use>
              </svg>
            </label>
            <input
              type="file"
              :id="'attach-file-' + session.id"
              :name="'attach-file-' + session.id"
              @change="e => handleFileChange(e, session.id)"
            />
            <input
              type="text"
              class="message-input"
              placeholder="Type your message here..."
              :value="session.currentMessage || ''"
              @input="e => updateSessionMessage(session.id, e.target.value)"
              @keypress="e => handleKeyPress(e, session.id)"
              :disabled="session.isThinking"
            />
            <button class="audio-btn">
              <svg class="smart-buttons icon-hashy-mic" style="color: #757575">
                <use xlink:href="#icon-hashy-mic"></use>
              </svg>
            </button>
            <button
              class="send-btn"
              @click="() => sendMessage(session.id)"
              :disabled="session.isThinking"
            >
              <svg class="smart-buttons icon-hashy-send">
                <use xlink:href="#icon-hashy-send"></use>
              </svg>
            </button>
          </div>

          <div class="hashy-attachment-preview" v-if="(session.attachedFiles?.length || 0) > 0">
            <div
              class="hashy-attachment-item"
              v-for="(file, index) in session.attachedFiles"
              :key="index"
            >
              <div class="hashy-file-icon-wrapper">
                <svg :class="['hashy-file-icon', getFileIconClass(file.name)]">
                  <use :xlink:href="'#' + getFileIconSymbol(file.name)"></use>
                </svg>
              </div>
              <div class="hashy-file-info">
                <div class="hashy-file-name">{{ file.name }}</div>
                <div class="hashy-file-size">{{ formatFileSize(file.size) }}</div>
              </div>
              <button class="hashy-remove-file-btn" @click="() => removeFile(session.id, index)">
                <svg>
                  <use xlink:href="#icon-close-outline"></use>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="hashy-selection-tooltip" aria-hidden="true" @click="handleAskHashy($event)">
      <svg class="smart-buttons hashy-selection-icon" aria-hidden="true">
        <use xlink:href="#icon-hashy-star"></use>
      </svg>
      Ask hashy
    </div>
  </div>
</template>

<template name="hx-hashy-chat-view-extend" inherit="webx.hx-action-manager">
  <t t-find=".hx-action-manager" t-operation="after">
    <hx-hashy-chat-view></hx-hashy-chat-view>
    <hx-hashy-session-icons></hx-hashy-session-icons>
    <hx-hashy-session-warning></hx-hashy-session-warning>
  </t>
</template>
<script setup lang="ts"></script>
