<template name="hx-ai-chat-interface">
  <div class="hx-ai-chat-interface">
    <div class="ai-chat-container">
      <div class="ai-chat-main">
        <div class="ai-chat-header">
          <span class="ai-chat-title">Hi! I'm Hashy</span>
        </div>

        <div v-if="currentSessionName" class="ai-session-header">
          <span class="ai-session-name">{{ currentSessionName }}</span>
        </div>

        <div class="ai-chat-body" ref="chatBodyRef">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['ai-message-wrapper', message.sender === username ? 'user' : 'hashy']"
          >
            <div
              v-if="message.sender === username && message.contextMentioned"
              class="ai-user-context-preview"
            >
              <svg class="ai-context-arrow-icon" style="rotate: 180deg">
                <use xlink:href="#icon-reply-outline"></use>
              </svg>
              <div class="ai-context-preview-text">
                {{ truncateText(message.contextMentioned, 150) }}
              </div>
            </div>
            <div
              v-if="message.attachments && message.attachments.length"
              class="ai-attachment-sent"
            >
              <div
                v-for="(file, index) in message.attachments"
                :key="index"
                class="ai-attachment-item"
              >
                <div class="ai-file-icon-wrapper">
                  <svg :class="['smart-buttons', 'ai-file-icon', getFileIconClass(file.filename)]">
                    <use :xlink:href="'#' + getFileIconSymbol(file.filename)"></use>
                  </svg>
                </div>
                <div class="ai-file-info">
                  <a
                    v-if="file.url"
                    :href="file.url"
                    :download="file.filename"
                    target="_blank"
                    class="ai-file-name"
                  >
                    {{ file.filename }}
                  </a>
                  <span v-else class="ai-file-name">{{ file.filename }}</span>
                  <span class="ai-file-size">{{ formatFileSize(file.size) }}</span>
                  <span v-if="!file.url" class="ai-upload-status">Uploading...</span>
                </div>
              </div>
            </div>
            <div
              :class="[
                'ai-message-bubble',
                message.sender === username ? 'user-message' : 'hashy-message',
              ]"
            >
              <hx-hashy-message-content
                :text="message.text"
                :is-markdown="message.sender !== username"
              />
            </div>
            <div
              :class="[
                'ai-message-timestamp',
                message.sender === username ? 'user-timestamp' : 'hashy-timestamp',
              ]"
            >
              {{ formatTime(message.timestamp) }}
            </div>
            <div class="ai-message-actions" aria-hidden="true">
              <span
                class="ai-message-action"
                :class="{ copied: message.id === copiedMessageId }"
                @click="copyMessageText(message)"
                title="Copy"
              >
                <svg
                  v-if="message.id !== copiedMessageId"
                  class="smart-buttons icon-hashy-copy"
                  aria-hidden="true"
                >
                  <use xlink:href="#icon-hashy-copy"></use>
                </svg>
                <svg v-else class="smart-buttons icon-check-circle" aria-hidden="true">
                  <use xlink:href="#icon-check-circle-outline"></use>
                </svg>
              </span>
              <span class="ai-message-action" @click="setReplyContext(message)" title="Reply">
                <svg class="smart-buttons icon-reply" aria-hidden="true">
                  <use xlink:href="#icon-reply-outline"></use>
                </svg>
              </span>
            </div>
          </div>

          <div v-if="isThinking" class="ai-thinking-indicator">
            <div class="ai-thinking-dots">
              <div class="ai-thinking-dot"></div>
              <div class="ai-thinking-dot"></div>
              <div class="ai-thinking-dot"></div>
            </div>
          </div>
        </div>

        <div class="ai-chat-input">
          <div v-if="replyingToMessage || contextMentioned" class="ai-reply-preview">
            <svg class="ai-reply-arrow-icon">
              <use xlink:href="#icon-reply-outline"></use>
            </svg>
            <div class="ai-reply-preview-text">
              {{ truncateText(replyingToMessage ? replyingToMessage.text : contextMentioned, 200) }}
            </div>
            <button class="ai-reply-close-btn" @click="clearReplyContext">
              <svg>
                <use xlink:href="#icon-hashy-x"></use>
              </svg>
            </button>
          </div>
          <div class="ai-input-area">
            <label
              :for="'attach-file-' + (sessionId || 'default')"
              class="ai-attach-btn"
              :class="{ disabled: isThinking || attachedFiles.length >= 1 }"
            >
              <svg class="smart-buttons ai-input-icon">
                <use xlink:href="#icon-hashy-attachment"></use>
              </svg>
            </label>
            <input
              type="file"
              :id="'attach-file-' + (sessionId || 'default')"
              :name="'attach-file-' + (sessionId || 'default')"
              @change="handleFileChange"
            />
            <input
              type="text"
              class="ai-message-input"
              placeholder="Type your message here..."
              v-model="currentMessage"
              @keypress="handleKeyPress"
              :disabled="isThinking"
            />
            <button class="ai-audio-btn">
              <svg class="smart-buttons ai-input-icon">
                <use xlink:href="#icon-hashy-mic"></use>
              </svg>
            </button>
            <button
              class="ai-send-btn"
              @click="sendMessage"
              :disabled="isThinking || !currentMessage || !currentMessage.trim()"
            >
              <svg class="smart-buttons ai-input-icon">
                <use xlink:href="#icon-hashy-send"></use>
              </svg>
            </button>
          </div>
          <div class="ai-attachment-preview" v-if="attachedFiles.length > 0">
            <div class="ai-attachment-item" v-for="(file, index) in attachedFiles" :key="index">
              <div class="ai-file-icon-wrapper">
                <svg :class="['smart-buttons', 'ai-file-icon', getFileIconClass(file.name)]">
                  <use :xlink:href="'#' + getFileIconSymbol(file.name)"></use>
                </svg>
              </div>
              <div class="ai-file-info">
                <div class="ai-file-name">{{ file.name }}</div>
                <div class="ai-file-size">{{ formatFileSize(file.size) }}</div>
              </div>
              <button class="ai-remove-file-btn" @click="removeFile(index)">
                <svg class="smart-buttons">
                  <use xlink:href="#icon-close-outline"></use>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-chat-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="ai-sidebar-header">
          <template v-if="!sidebarCollapsed">
            <button class="ai-sidebar-toggle-btn" @click="toggleSidebar">
              <svg class="smart-buttons ai-toggle-icon">
                <use xlink:href="#icon-sidebar"></use>
              </svg>
            </button>
            <span class="ai-sidebar-title">Hashy AI Assistant</span>
          </template>
          <template v-else>
            <button class="ai-sidebar-toggle-btn" @click="toggleSidebar">
              <svg class="smart-buttons ai-toggle-icon">
                <use xlink:href="#icon-sidebar"></use>
              </svg>
            </button>
          </template>
        </div>

        <div class="ai-sidebar-content" v-if="!sidebarCollapsed">
          <div class="ai-sidebar-search-group">
            <div class="ai-sidebar-search">
              <svg class="smart-buttons ai-search-icon">
                <use xlink:href="#icon-search-outline"></use>
              </svg>
              <input
                type="text"
                class="ai-search-input"
                placeholder="Search"
                v-model="searchQuery"
              />
            </div>

            <a href="#" class="ai-sidebar-new-link" @click.prevent="createNewChat">
              <svg class="smart-buttons ai-new-icon">
                <use xlink:href="#icon-document-add-outline"></use>
              </svg>
              <span>New Chat</span>
            </a>
          </div>

          <div class="ai-sidebar-list">
            <div
              v-for="group in filteredGroupedSessions"
              :key="group.label"
              class="ai-session-group"
            >
              <div class="ai-group-header" @click="toggleGroup(group.label)">
                <span class="ai-group-label">{{ group.label }}</span>
                <svg class="smart-buttons ai-group-icon" :class="{ collapsed: group.collapsed }">
                  <use xlink:href="#icon-chevron-down"></use>
                </svg>
              </div>

              <div v-if="!group.collapsed" class="ai-group-items">
                <div
                  v-for="session in group.sessions"
                  :key="session.id"
                  class="ai-session-item"
                  :class="{ active: session.id === activeSessionId }"
                  @click="switchSession(session.id)"
                >
                  <div class="ai-session-content">
                    <input
                      v-if="session.id === editingSessionId"
                      type="text"
                      class="ai-session-name-input"
                      v-model="editingSessionName"
                      @click.stop
                      @keypress.enter="saveSessionName(session.id)"
                      @blur="saveSessionName(session.id)"
                      ref="sessionNameInput"
                    />
                    <span v-else class="ai-session-item-name">{{ session.name }}</span>
                    <span class="ai-session-time">{{ formatSessionTime(session.created_at) }}</span>
                  </div>
                  <div class="ai-session-actions">
                    <button
                      class="ai-session-rename"
                      @click.stop="startRenameSession(session.id, session.name)"
                    >
                      <svg class="smart-buttons ai-rename-icon">
                        <use xlink:href="#icon-edit-outline"></use>
                      </svg>
                    </button>
                    <button class="ai-session-delete" @click.stop="deleteSession(session.id)">
                      <svg class="smart-buttons ai-delete-icon">
                        <use xlink:href="#icon-trash-bin-trash-outline"></use>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="hasMoreSessions"
              class="ai-load-more"
              @click="loadMoreSessions"
              :disabled="isLoadingSessions"
            >
              {{ isLoadingSessions ? 'Loading...' : 'Load More Sessions' }}
            </button>

            <div v-if="sessions.length === 0" class="ai-empty-state">
              <p>No sessions yet</p>
              <p class="ai-empty-hint">Start a new chat to begin</p>
            </div>
          </div>
        </div>

        <div class="ai-sidebar-icons" v-else>
          <button class="ai-sidebar-icon-btn search-btn" title="Search" @click="toggleSearchModal">
            <svg class="smart-buttons">
              <use xlink:href="#icon-search-outline"></use>
            </svg>
          </button>
          <button class="ai-sidebar-icon-btn" title="New Chat" @click="createNewChat">
            <svg class="smart-buttons">
              <use xlink:href="#icon-document-add-outline"></use>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showSearchModal && sidebarCollapsed"
      class="ai-search-modal-backdrop"
      @click="closeSearchModal"
    >
      <div class="ai-search-modal" @click.stop>
        <div class="ai-modal-header">
          <div class="ai-modal-search">
            <svg class="smart-buttons ai-search-icon">
              <use xlink:href="#icon-search-outline"></use>
            </svg>
            <input
              type="text"
              class="ai-search-input"
              placeholder="Search"
              v-model="searchQuery"
              ref="modalSearchInput"
            />
          </div>

          <a href="#" class="ai-modal-new-link" @click.prevent="createNewChatFromModal">
            <svg class="smart-buttons ai-new-icon">
              <use xlink:href="#icon-document-add-outline"></use>
            </svg>
            <span>New Chat</span>
          </a>
        </div>

        <div class="ai-modal-divider"></div>

        <div class="ai-modal-session-list">
          <div v-for="group in filteredGroupedSessions" :key="group.label" class="ai-session-group">
            <div class="ai-group-header" @click="toggleGroup(group.label)">
              <span class="ai-group-label">{{ group.label }}</span>
              <svg class="smart-buttons ai-group-icon" :class="{ collapsed: group.collapsed }">
                <use xlink:href="#icon-chevron-down"></use>
              </svg>
            </div>

            <div v-if="!group.collapsed" class="ai-group-items">
              <div
                v-for="session in group.sessions"
                :key="session.id"
                class="ai-session-item"
                :class="{ active: session.id === activeSessionId }"
                @click="switchSessionFromModal(session.id)"
              >
                <div class="ai-session-content">
                  <span class="ai-session-item-name">{{ session.name }}</span>
                  <span class="ai-session-time">{{ formatSessionTime(session.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="hasMoreSessions"
            class="ai-load-more"
            @click="loadMoreSessions"
            :disabled="isLoadingSessions"
          >
            {{ isLoadingSessions ? 'Loading...' : 'Load More Sessions' }}
          </button>

          <div v-if="sessions.length === 0" class="ai-empty-state">
            <p>No sessions yet</p>
            <p class="ai-empty-hint">Start a new chat to begin</p>
          </div>
        </div>
      </div>
    </div>
    <div class="ai-selection-tooltip" aria-hidden="true">
      <svg class="smart-buttons ai-selection-icon" aria-hidden="true">
        <use xlink:href="#icon-hashy-star"></use>
      </svg>
      Ask hashy
    </div>
  </div>
</template>

<script setup lang="ts"></script>
