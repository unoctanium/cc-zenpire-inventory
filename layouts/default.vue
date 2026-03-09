<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { locale, locales, setLocale, t } = useI18n({ useScope: 'global' })

const auth     = useAuth()
const isAuthed = computed(() => Boolean(auth.value?.ok))
const email    = computed(() => auth.value?.email ?? '')
const isAdmin  = computed(() => Boolean(auth.value?.is_admin))
const initials = computed(() => initialsFromEmail(email.value))

const route = useRoute()
const { barApps, overflowApps, activeApp, setApp } = useAppNav()

const navLinks = computed(() => activeApp.value?.links ?? [])

function isLinkActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}

function initialsFromEmail(e: string) {
  if (!e) return '?'
  const local = e.split('@')[0] || e
  const parts = local.split(/[.\-_]/).filter(Boolean)
  const a = parts[0]?.[0] ?? local[0]
  const b = parts[1]?.[0] ?? local[1]
  return (a + (b ?? '')).toUpperCase()
}

const userDrawerOpen = ref(false)
const morePopupOpen  = ref(false)
const morePopupPos   = ref({ left: 0, top: 0, bottom: 0, anchor: 'right' as 'right' | 'above' })

function openMorePopup(event: MouseEvent) {
  const btn    = event.currentTarget as HTMLElement
  const rect   = btn.getBoundingClientRect()
  const popupW = 208
  if (window.innerWidth - rect.right >= popupW + 16) {
    morePopupPos.value = { left: rect.right + 10, top: rect.top + rect.height / 2, bottom: 0, anchor: 'right' }
  } else {
    const cx = rect.left + rect.width / 2
    morePopupPos.value = {
      left:   Math.max(8, Math.min(cx - popupW / 2, window.innerWidth - popupW - 8)),
      top:    0,
      bottom: window.innerHeight - rect.top + 10,
      anchor: 'above',
    }
  }
  morePopupOpen.value = !morePopupOpen.value
}

const FLAG: Record<string, string> = { en: '🇺🇸', de: '🇩🇪', ja: '🇯🇵' }

// Mobile back-navigation: when on a pushed sub-page, replace top bar with back button
const backNav = computed(() => {
  const p = route.path
  if (p.startsWith('/reports/'))    return { label: t('nav.apps.reports'), to: '/reports' }
  if (/^\/production\/.+/.test(p))  return { label: t('nav.recipe'),       to: '/production' }
  if (/^\/ingredients\/.+/.test(p)) return { label: t('nav.ingredients'),  to: '/ingredients' }
  if (/^\/units\/.+/.test(p))       return { label: t('nav.units'),        to: '/units' }
  if (/^\/allergens\/.+/.test(p))   return { label: t('nav.allergens'),    to: '/allergens' }
  return null
})

// Sub-nav overflow (mobile pill strip)
const PILL_LIMIT = 4
const visibleLinks  = computed(() => navLinks.value.length > PILL_LIMIT + 1 ? navLinks.value.slice(0, PILL_LIMIT) : navLinks.value)
const overflowLinks = computed(() => navLinks.value.length > PILL_LIMIT + 1 ? navLinks.value.slice(PILL_LIMIT) : [])

const subNavMoreOpen = ref(false)
const subNavMorePos  = ref({ left: 0, top: 0 })

function openSubNavMore(event: MouseEvent) {
  const btn  = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  const popupW = 180
  subNavMorePos.value = {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8)),
    top:  rect.bottom + 6,
  }
  subNavMoreOpen.value = !subNavMoreOpen.value
}
</script>

<template>
  <UApp>
    <!-- Auth guard: blue screen while auth is unresolved -->
    <div v-if="!isAuthed" style="position:fixed;inset:0;background:#0082c9" />

    <template v-else>

      <!-- ══════════════════════════════════════════════════════════════════════
           TABLET / DESKTOP  (≥ sm · 640 px)
           ══════════════════════════════════════════════════════════════════════ -->
      <div class="hidden sm:flex print:flex overflow-hidden print:overflow-visible print:!h-auto bg-white dark:bg-gray-900" style="height:100dvh">

        <!-- Vertical icon bar -->
        <div class="print:hidden w-20 flex-none flex flex-col items-center pt-4 pb-4 gap-2 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

          <!-- User avatar -->
          <button
            class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all active:scale-95 mb-1"
            style="background: var(--color-app-bar)"
            @click="userDrawerOpen = true"
          >
            {{ initials }}
          </button>

          <div class="w-10 border-t border-gray-200 dark:border-gray-700 mb-1" />

          <!-- App icons -->
          <button
            v-for="app in barApps"
            :key="app.id"
            :title="t(app.labelKey)"
            class="flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
            :class="activeApp?.id === app.id ? '' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'"
            :style="activeApp?.id === app.id ? 'color: var(--color-app-bar)' : ''"
            @click="setApp(app)"
          >
            <UIcon :name="app.icon" class="w-6 h-6" />
            <span class="text-[9px] leading-none font-medium">{{ t(app.labelKey) }}</span>
            <div
              class="h-0.5 w-6 rounded-full mt-0.5 transition-all"
              :style="activeApp?.id === app.id ? 'background: var(--color-app-bar)' : 'background: transparent'"
            />
          </button>

          <!-- More button -->
          <button
            v-if="overflowApps.length"
            :title="t('nav.more')"
            class="flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
            @click="openMorePopup"
          >
            <UIcon name="i-heroicons-ellipsis-horizontal-circle" class="w-6 h-6" />
            <span class="text-[9px] leading-none font-medium">{{ t('nav.more') }}</span>
          </button>

        </div>

        <!-- Content area: h-full gives Safari/WebKit a definite height so that
             children using h-full (AppSplitLayout) resolve correctly. -->
        <div class="flex-1 h-full overflow-auto print:overflow-visible print:h-auto bg-gray-50 dark:bg-gray-950 print:bg-white">
          <slot />
        </div>

      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           MOBILE / PHONE  (< sm · 640 px)
           ══════════════════════════════════════════════════════════════════════ -->
      <div class="flex sm:hidden print:hidden flex-col overflow-hidden bg-white dark:bg-gray-900" style="height:100dvh">

        <!-- Top bar -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-none min-h-[52px]">
          <!-- Pushed page: back chevron + calling page name -->
          <template v-if="backNav">
            <button
              class="flex items-center gap-0.5 text-sm font-medium text-gray-700 dark:text-gray-300 active:opacity-60 transition-opacity"
              @click="navigateTo(backNav.to)"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-5 h-5 flex-none" />
              {{ backNav.label }}
            </button>
          </template>
          <!-- Normal top bar: avatar + app name -->
          <template v-else>
            <button
              class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all active:scale-95 flex-none"
              style="background: var(--color-app-bar)"
              @click="userDrawerOpen = true"
            >
              {{ initials }}
            </button>
            <h1 class="text-base font-semibold text-gray-900 dark:text-white flex-1 truncate">
              {{ activeApp ? t(activeApp.labelKey) : '' }}
            </h1>
          </template>
        </div>

        <!-- Sub-nav pill strip (mobile) -->
        <div
          v-if="navLinks.length"
          class="flex-none flex overflow-x-auto px-3 py-2 gap-1.5 border-b border-gray-100 dark:border-gray-800"
          style="-webkit-overflow-scrolling: touch; scrollbar-width: none"
        >
          <NuxtLink
            v-for="link in visibleLinks"
            :key="link.to"
            :to="link.to"
            class="flex-none px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
            :class="isLinkActive(link.to)
              ? 'text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
            :style="isLinkActive(link.to) ? 'background: var(--color-app-bar)' : ''"
          >
            {{ t(link.labelKey) }}
          </NuxtLink>
          <!-- Overflow pill button -->
          <button
            v-if="overflowLinks.length"
            class="flex-none flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            @click.stop="openSubNavMore"
          >
            <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          <slot />
        </div>

        <!-- Bottom app bar -->
        <div
          class="flex-none border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-stretch"
          style="padding-bottom: env(safe-area-inset-bottom)"
        >
          <button
            v-for="app in barApps"
            :key="app.id"
            class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all cursor-pointer active:opacity-70"
            :style="activeApp?.id === app.id ? 'color: var(--color-app-bar)' : 'color: #9ca3af'"
            @click="setApp(app)"
          >
            <UIcon :name="app.icon" class="w-6 h-6" />
            <span class="text-[10px] font-medium">{{ t(app.labelKey) }}</span>
          </button>
          <button
            v-if="overflowApps.length"
            class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-400 cursor-pointer"
            @click="openMorePopup"
          >
            <UIcon name="i-heroicons-ellipsis-horizontal-circle" class="w-6 h-6" />
            <span class="text-[10px] font-medium">{{ t('nav.more') }}</span>
          </button>
        </div>

      </div>

    </template>

    <!-- ══════════════════════════════════════════════════════════════════════
         SHARED: USER DRAWER
         ══════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200 ease-in"
        leave-to-class="opacity-0"
      >
        <div v-if="userDrawerOpen" class="fixed inset-0 z-50 flex">
          <div class="absolute inset-0" style="background: rgba(0,0,0,0.6)" @click="userDrawerOpen = false" />
          <div
            class="relative z-10 flex flex-col h-full shadow-2xl overflow-hidden w-4/5 sm:w-1/5"
            style="background: white; min-width: 240px; max-width: 360px; animation: slideInLeft 0.3s ease-out"
          >
            <!-- Header -->
            <div class="pr-5 py-6 flex items-center gap-3 flex-none" style="background: var(--color-app-bar)">
              <div
                class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/40 flex-none"
                style="margin-left: 20px"
              >
                {{ initials }}
              </div>
              <div class="min-w-0">
                <p class="text-white/70 text-xs truncate">{{ email }}</p>
              </div>
              <button class="ml-auto text-white/70 hover:text-white p-1 rounded cursor-pointer" @click="userDrawerOpen = false">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>

            <!-- Language -->
            <div class="flex items-center gap-3 px-6 py-3 border-b border-gray-100">
              <UIcon name="i-heroicons-language" class="w-5 h-5 text-gray-400 flex-none" />
              <span class="text-sm text-gray-700 flex-1">{{ t('nav.language') }}</span>
              <div class="flex gap-1">
                <button
                  v-for="loc in (locales as any[])"
                  :key="loc.code"
                  class="px-2 py-0.5 rounded text-xs font-medium transition-colors"
                  :class="locale === loc.code
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                  :style="locale === loc.code ? 'background: var(--color-app-bar)' : ''"
                  @click="setLocale(loc.code)"
                >
                  {{ FLAG[loc.code] ?? loc.code }}
                </button>
              </div>
            </div>

            <!-- Nav links -->
            <div class="flex-1 overflow-y-auto py-2">
              <NuxtLink
                v-if="isAdmin"
                to="/admin/seed"
                class="w-full flex items-center gap-3 pl-8 pr-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100"
                @click="userDrawerOpen = false"
              >
                <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-gray-400 flex-none" />
                {{ t('nav.adminSettings') }}
              </NuxtLink>
              <NuxtLink
                to="/settings"
                class="w-full flex items-center gap-3 pl-8 pr-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100"
                @click="userDrawerOpen = false"
              >
                <UIcon name="i-heroicons-user-circle" class="w-5 h-5 text-gray-400 flex-none" />
                {{ t('nav.userSettings') }}
              </NuxtLink>
              <NuxtLink
                to="/logout"
                class="w-full flex items-center gap-3 pl-8 pr-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                @click="userDrawerOpen = false"
              >
                <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5 text-gray-400 flex-none" />
                {{ t('auth.logout') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════════
         SHARED: MORE APPS POPUP
         ══════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="morePopupOpen" class="fixed inset-0 z-50" @click="morePopupOpen = false">
        <div
          class="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
          style="min-width: 208px"
          :style="morePopupPos.anchor === 'right'
            ? `left: ${morePopupPos.left}px; top: ${morePopupPos.top}px; transform: translateY(-50%)`
            : `left: ${morePopupPos.left}px; bottom: ${morePopupPos.bottom}px`"
          @click.stop
        >
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-1" style="padding-left: 24px">
            {{ t('nav.moreApps') }}
          </p>
          <button
            v-for="app in overflowApps"
            :key="app.id"
            class="w-full flex items-center gap-3 px-6 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            @click="setApp(app); morePopupOpen = false"
          >
            <UIcon :name="app.icon" class="w-5 h-5 flex-none" style="color: var(--color-app-bar)" />
            {{ t(app.labelKey) }}
          </button>
          <!-- Arrow pointing left (sidebar mode) -->
          <div
            v-if="morePopupPos.anchor === 'right'"
            class="absolute top-1/2"
            style="transform: translateY(-50%); left: -8px; width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-right: 8px solid white"
          />
          <!-- Arrow pointing down (bottom-bar mode) -->
          <div
            v-if="morePopupPos.anchor === 'above'"
            class="absolute left-1/2"
            style="transform: translateX(-50%); bottom: -8px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid white"
          />
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════════
         SHARED: SUB-NAV OVERFLOW POPUP (mobile pill strip)
         ══════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="subNavMoreOpen" class="fixed inset-0 z-50" @click="subNavMoreOpen = false">
        <div
          class="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
          style="min-width: 180px"
          :style="`left: ${subNavMorePos.left}px; top: ${subNavMorePos.top}px`"
          @click.stop
        >
          <NuxtLink
            v-for="link in overflowLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-3 px-5 py-3 text-sm transition-colors"
            :class="isLinkActive(link.to)
              ? 'font-semibold text-gray-900 dark:text-white'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
            :style="isLinkActive(link.to) ? 'color: var(--color-app-bar)' : ''"
            @click="subNavMoreOpen = false"
          >
            {{ t(link.labelKey) }}
          </NuxtLink>
        </div>
      </div>
    </Teleport>

    <UToaster />
  </UApp>
</template>

<style scoped>
@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
</style>
