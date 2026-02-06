<template name="hx-topbar-button-hashy">
  <div class="hx-topbar-button-hashy">
    <button
      class="hashy-button"
      data_uniq="topbar_button_hashy"
      data-shortcut="w"
      @click="togglePanel"
    >
      <img :src="logoSrc" alt="Hashy Logo" class="hashy-logo" @error="onLogoError" />
    </button>

    <transition name="hashy-dropdown" appear>
      <div v-if="showPanel" class="hashy-dropdown">
        <hx-hashy-session-dropdown
          :show-panel="showPanel"
          @close="closePanel"
          @create-new="handleCreateNew"
          @resume-session="handleResumeSession"
        />
      </div>
    </transition>

    <transition name="hashy-overlay" appear>
      <div v-if="showPanel" class="hashy-overlay" @click="closePanel"></div>
    </transition>
  </div>
</template>
