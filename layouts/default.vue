<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const route  = useRoute()
const { locale, locales, setLocale, t } = useI18n({ useScope: 'global' })

const auth     = useAuth()
const isAuthed = computed(() => Boolean(auth.value?.ok))
const email    = computed(() => auth.value?.email ?? '')
const isAdmin  = computed(() => Boolean(auth.value?.is_admin))
const initials = computed(() => initialsFromEmail(email.value))

const { barApps, activeApp, sidebarOpen, setApp } = useAppNav()

watch(
  auth,
  (val) => {
    if ((val === null || !val.ok) && route.path !== '/login') {
      navigateTo('/login')
    }
    if (val?.ok && route.path === '/login') {
      navigateTo('/')
    }
  },
  { immediate: true }
)

const langOptions = computed(() =>
  (locales.value as any[]).map(l => ({
    label: l.name,
    onClick: () => setLocale(l.code),
  }))
)

const userMenuItems = computed(() => {
  const group1: any[] = []
  if (isAdmin.value) {
    group1.push({ label: t('nav.adminSettings'), to: '/admin/db-tools' })
  }
  group1.push({ label: t('nav.userSettings'), to: '/settings' })
  return [group1, [{ label: t('auth.logout'), to: '/logout' }]]
})

function initialsFromEmail(e: string) {
  if (!e) return '?'
  const local = e.split('@')[0] || e
  const parts = local.split(/[.\-_]/).filter(Boolean)
  const a = parts[0]?.[0] ?? local[0]
  const b = parts[1]?.[0] ?? local[1]
  return (a + (b ?? '')).toUpperCase()
}

function isLinkActive(linkTo: string) {
  return route.path === linkTo || route.path.startsWith(linkTo + '/')
}
</script>

<template>
  <UApp>
    <!-- Outer shell: bg is the app-bar color, acts as the visible frame around the content container -->
    <div class="h-dvh flex flex-col overflow-hidden bg-[var(--color-app-bar)]">

      <!-- TOP APP BAR -->
      <header class="flex-none h-14 flex items-center px-3 gap-3">

        <!-- Logo: invert makes the black plant white; screen blend dissolves the background into the bar.
             Overlay ring traces the logo's natural circle boundary. -->
        <div class="flex-none h-9 w-9 rounded-full overflow-hidden border-2 border-white/90">
          <img src="/logo.png" alt="Zenpire" class="h-full w-full object-cover invert mix-blend-screen" />
        </div>

        <!-- App switcher — always-visible icon + label -->
        <div class="flex items-end gap-1">
          <button
            v-for="app in barApps"
            :key="app.id"
            class="flex flex-col items-center px-3 py-1 rounded transition-opacity duration-150"
            :class="activeApp?.id === app.id
              ? 'opacity-100 border-b-2 border-white'
              : 'opacity-60 hover:opacity-90 border-b-2 border-transparent'"
            @click="setApp(app)"
          >
            <UIcon :name="app.icon" class="w-5 h-5 text-white" />
            <span class="text-white text-[8px] leading-tight mt-0.5">
              {{ t(app.labelKey) }}
            </span>
          </button>
        </div>

        <div class="flex-1" />

        <!-- Language selector -->
        <UDropdownMenu :items="[langOptions]">
          <UButton color="neutral" variant="ghost" size="sm" class="text-white hover:bg-white/15">
            {{ (locales as any[]).find(l => l.code === locale)?.name }}
          </UButton>
        </UDropdownMenu>

        <!-- User pill -->
        <UDropdownMenu v-if="isAuthed" :items="userMenuItems">
          <div
            class="flex items-center gap-2 rounded-full px-3 py-1 text-sm text-white
                   bg-white/10 cursor-pointer hover:bg-white/20 transition-colors select-none"
          >
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full
                     bg-white text-[var(--color-app-bar)] text-xs font-semibold"
              aria-hidden="true"
            >
              {{ initials }}
            </div>
            <span class="max-w-[160px] truncate hidden sm:block">{{ email }}</span>
            <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 text-white/70" />
          </div>
        </UDropdownMenu>
      </header>

      <!-- CONTENT CONTAINER: windowed area below the app bar.
           mx-1 mb-1 shows the blue frame color on left, right, and bottom.
           overflow-hidden + rounded-xl clips all children (sidebar, mobile overlay).
           relative anchors the absolute-positioned mobile sidebar. -->
      <div class="content-container flex-1 min-h-0 mx-1 mb-1 rounded-xl overflow-hidden flex relative bg-white dark:bg-zinc-950">

        <!-- Desktop sidebar (flex child, width animates) -->
        <aside
          class="hidden md:flex flex-none overflow-hidden transition-[width] duration-200 bg-[var(--color-sidebar)]"
          :class="sidebarOpen ? 'w-56' : 'w-0'"
        >
          <div class="w-56 h-full flex flex-col">
            <!-- App name + close button -->
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {{ t(activeApp.labelKey) }}
              </h2>
              <button
                class="p-1.5 rounded text-slate-500 dark:text-slate-300 hover:bg-[var(--color-sidebar-hover)] transition-colors flex-none"
                @click="sidebarOpen = false"
              >
                <UIcon name="i-heroicons-chevron-double-left" class="w-4 h-4" />
              </button>
            </div>

            <!-- Sidebar nav links -->
            <nav class="flex-1 overflow-y-auto flex flex-col px-2 gap-0.5 pb-2">
              <NuxtLink
                v-for="link in activeApp.links ?? []"
                :key="link.to"
                :to="link.to"
                class="flex items-center px-3 py-2 rounded text-sm transition-colors"
                :class="isLinkActive(link.to)
                  ? 'bg-[var(--color-sidebar-active)] text-white font-medium'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-[var(--color-sidebar-hover)]'"
              >
                {{ t(link.labelKey) }}
              </NuxtLink>
            </nav>
          </div>
        </aside>

        <!-- Mobile sidebar: absolute within content-container (cannot overlap the app bar) -->
        <template v-if="sidebarOpen">
          <div
            class="md:hidden absolute inset-0 z-30 bg-black/30"
            @click="sidebarOpen = false"
          />
          <aside
            class="md:hidden absolute inset-y-0 left-0 z-40 w-56 flex flex-col bg-[var(--color-sidebar)]"
          >
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {{ t(activeApp.labelKey) }}
              </h2>
              <button
                class="p-1.5 rounded text-slate-500 dark:text-slate-300 hover:bg-[var(--color-sidebar-hover)] transition-colors flex-none"
                @click="sidebarOpen = false"
              >
                <UIcon name="i-heroicons-chevron-double-left" class="w-4 h-4" />
              </button>
            </div>
            <nav class="flex-1 overflow-y-auto flex flex-col px-2 gap-0.5 pb-2">
              <NuxtLink
                v-for="link in activeApp.links ?? []"
                :key="link.to"
                :to="link.to"
                class="flex items-center px-3 py-2 rounded text-sm transition-colors"
                :class="isLinkActive(link.to)
                  ? 'bg-[var(--color-sidebar-active)] text-white font-medium'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-[var(--color-sidebar-hover)]'"
                @click="sidebarOpen = false"
              >
                {{ t(link.labelKey) }}
              </NuxtLink>
            </nav>
          </aside>
        </template>

        <!-- Main content: scrolls vertically within the content-container -->
        <main class="flex-1 overflow-y-auto relative bg-white dark:bg-zinc-950">
          <!-- Open sidebar button (shown when sidebar is closed) -->
          <button
            v-if="!sidebarOpen"
            class="absolute top-2 left-2 z-10 p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            @click="sidebarOpen = true"
          >
            <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
          </button>

          <div class="px-6 py-6" :class="!sidebarOpen ? 'pl-12' : ''">
            <slot />
          </div>
        </main>

      </div>
    </div>

    <UToaster />
  </UApp>
</template>
