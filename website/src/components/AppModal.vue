<template>
  <dialog class="app-modal" open>
    <div class="row">
      <h1>{{ modalTitle }}</h1>
      <span class="spacer"></span>
      <button class="close-button" @click="closeModal">×</button>
    </div>
  </dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const modalTitle = ref('Modal Title')

function closeModal() {
  // Emit close event or handle modal close logic here
  console.log('Modal closed')
}
</script>