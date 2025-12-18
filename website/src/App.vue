<template>
  <div id="app">
    <AppHeader />
    <main>
      <HomeSection />
    </main>
    <AppFooter />
  </div>
</template>

<script lang="ts" setup>
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import HomeSection from './views/Home.vue'
</script>
