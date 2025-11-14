<template>
  <div id="app">
    <AppHeader />
    <router-view />
    <AppFooter />
    <AppModal />
  </div>
</template>

<script lang="ts" setup>
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import AppModal from './components/AppModal.vue'
</script>
