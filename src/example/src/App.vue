<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div>
    <a href="https://digital.vittel.com.br/produtos/" target="_blank">
      <img src="./assets/logo.png" class="logo vittel" alt="Vittel logo" />
    </a>
  </div>
  <HelloWorld msg="Vittel Webphone" />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vittel:hover {
  filter: drop-shadow(0 0 2em #f2f5faaa);
}
</style>
