<template name="hx-hashy-session-warning">
  <div class="hx-hashy-session-management">
    <div class="hashy-warning-backdrop" v-show="showWarning" @click="closeWarning">
      <div class="hashy-warning-modal" @click.stop>
        <div class="warning-header">
          <h3>Maximum Sessions Reached</h3>
        </div>
        <div class="warning-body">
          <p>You have reached the maximum of {{ maxSessions }} sessions.</p>
          <p>Do you want to replace the oldest session?</p>
          <div class="oldest-session-info">
            <strong>Oldest Session:</strong> {{ oldestSession?.name }}
            <br />
            <small>Created: {{ formatDate(oldestSession?.createdAt) }}</small>
          </div>
        </div>
        <div class="warning-actions">
          <button class="btn-cancel" @click="closeWarning">Cancel</button>
          <button class="btn-confirm" @click="confirmReplace">Replace & Continue</button>
        </div>
      </div>
    </div>
  </div>
</template>
