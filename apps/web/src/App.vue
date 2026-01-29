<script setup lang="ts">
import Header from './components/Header.vue'
</script>

<template>
  <div class="min-h-screen bg-val-gradient text-val-cream">
    <!-- Background decoration: diagonal lines -->
    <div class="fixed inset-0 pointer-events-none opacity-[0.03]">
      <div
        class="absolute inset-0"
        style="background-image: repeating-linear-gradient(45deg, transparent, transparent 35px, #FF4655 35px, #FF4655 36px);"
      />
    </div>

    <Header />

    <main class="relative z-10">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
