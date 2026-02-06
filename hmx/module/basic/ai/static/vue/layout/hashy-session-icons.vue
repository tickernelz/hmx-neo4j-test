<template name="hx-hashy-session-icons">
  <div class="hx-hashy-session-management">
    <div class="hashy-minimized-container" v-show="minimizedSessions.length > 0">
      <div
        v-for="session in minimizedSessions"
        :key="session.id"
        class="hashy-minimized-icon"
        @click="restoreSession(session.id)"
        :title="session.name"
      >
        <img :src="hashyCharacter" alt="Hashy" class="icon-image" />
        <span class="session-number">{{ getSessionNumber(session) }}</span>
        <span class="close-icon" @click.stop="closeSession(session.id)" title="Close session"
          >×</span
        >
      </div>
    </div>
  </div>
</template>
