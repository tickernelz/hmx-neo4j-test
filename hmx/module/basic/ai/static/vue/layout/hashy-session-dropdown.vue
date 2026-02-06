<template name="hx-hashy-session-dropdown">
  <div class="hx-hashy-session-dropdown">
    <div class="hashy-dropdown" @click.stop>
      <div class="hashy-header">
        <div class="hashy-header-left">
          <div class="hashy-header-title">Session History</div>
          <div class="hashy-counter-badge">{{ totalSessions }}</div>
        </div>
        <button @click="createNewSession" class="hashy-btn-new">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          New
        </button>
      </div>

      <div class="hashy-search">
        <div class="hashy-search-wrapper">
          <svg class="hashy-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <input
            v-model="searchQuery"
            placeholder="Search sessions..."
            class="hashy-search-input"
            @input="filterSessions"
          />
        </div>
      </div>

      <div class="hashy-list">
        <div v-for="group in filteredGroups" :key="group.label" class="hashy-group">
          <div class="hashy-group-title">{{ group.label }}</div>
          <div
            v-for="session in group.sessions"
            :key="session.id"
            class="hashy-item"
            @click="resumeSession(session)"
          >
            <div class="hashy-item-main">
              <div class="hashy-session-name">{{ session.name }}</div>
              <div class="hashy-session-preview">{{ session.lastMessage }}</div>
              <div class="hashy-session-time">
                {{ formatTime(session.updated_at) }}
              </div>
            </div>
            <div class="hashy-session-status" :class="session.status">
              <div class="hashy-status-dot"></div>
            </div>
          </div>
        </div>

        <div v-if="!hasFilteredSessions" class="hashy-empty">
          <div class="hashy-empty-icon">💬</div>
          <div class="hashy-empty-text">
            {{ searchQuery ? 'No sessions found' : 'No sessions yet' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
