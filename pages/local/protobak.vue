<script setup lang="ts">
definePageMeta({ layout: false })

// ── Mock data ──────────────────────────────────────────────────────────────

const MAX_VISIBLE_APPS = 5   // total slots incl. More button
const MAX_VISIBLE_TABS = 5   // total slots incl. ▼ button

const ALL_APPS = [
  { id: 'dashboard', icon: 'i-heroicons-squares-2x2',    label: 'Dashboard' },
  { id: 'recipes',   icon: 'i-heroicons-book-open',      label: 'Recipes'   },
  { id: 'stock',     icon: 'i-heroicons-cube',            label: 'Stock'     },
  { id: 'app1',      icon: 'i-heroicons-beaker',          label: 'App1'      },
  { id: 'app2',      icon: 'i-heroicons-bolt',            label: 'App2'      },
  { id: 'app3',      icon: 'i-heroicons-flag',            label: 'App3'      },
]

const APP_TABS: Record<string, string[]> = {
  recipes:   ['Production', 'Recipes', 'Ingredients', 'Allergens', 'Units', 'Menu1', 'Menu2', 'Menu3'],
  stock:     ['Overview', 'Movements', 'Alerts'],
  dashboard: ['Home', 'Recent'],
  app1:      [],
  app2:      [],
  app3:      [],
}

const TAB_ENTRIES: Record<string, string[]> = {
  Production:  ['Pasta Carbonara', 'Margherita Pizza', 'Tiramisu', 'Bruschetta al Pomodoro', 'Risotto ai Funghi', 'Gnocchi al Pesto', 'Osso Buco'],
  Recipes:     ['Pasta Base', 'Pizza Dough', 'Cream Sauce', 'Tomato Base', 'Béchamel', 'Pesto Genovese'],
  Ingredients: ['Flour (00)', 'Eggs', 'Tomatoes', 'Mozzarella', 'Basil', 'Olive Oil', 'Parmesan', 'Garlic', 'Onion', 'Butter'],
  Allergens:   ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Shellfish', 'Fish'],
  Units:       ['g', 'kg', 'ml', 'l', 'pcs', 'tsp', 'tbsp'],
  Overview:    ['Flour (00) — 12 kg', 'Mozzarella — 3.5 kg', 'Tomatoes — 8 kg', 'Olive Oil — 2 l'],
  Movements:   ['2024-01-15 — Flour +20 kg', '2024-01-14 — Mozzarella −1.5 kg', '2024-01-13 — Tomatoes +10 kg'],
  Alerts:      ['Flour below minimum', 'Olive Oil low stock'],
  Home:        ['Recipes: 15', 'Ingredients: 42', 'Suppliers: 6', 'Low stock alerts: 2'],
  Recent:      ['Pasta Carbonara edited', 'New ingredient: Truffle', 'Stock updated'],
}

const MOCK_USER = { name: 'John Doe', initials: 'JD', email: 'john@zenpire.app' }

const USER_MENU_ITEMS = [
  { label: 'Profile',   icon: 'i-heroicons-user'                     },
  { label: 'Settings',  icon: 'i-heroicons-cog-6-tooth'              },
  { label: 'Admin',     icon: 'i-heroicons-shield-check'             },
  { label: 'Sign out',  icon: 'i-heroicons-arrow-right-on-rectangle' },
]

// ── State ──────────────────────────────────────────────────────────────────

const activeAppId     = ref('dashboard')
const tabMemory       = ref<Record<string, number>>({})  // remembers last tab per app
const activeTabIdx    = computed({
  get: () => tabMemory.value[activeAppId.value] ?? 0,
  set: (v: number) => { tabMemory.value[activeAppId.value] = v },
})
const selectedEntry   = ref<string | null>(null)
const showDetail      = ref(false)
const userDrawerOpen  = ref(false)
const morePopupOpen   = ref(false)
const morePopupPos    = ref({ left: 0, top: 0, bottom: 0, anchor: 'right' as 'right' | 'above' })
const tabOverflowOpen = ref(false)
const tabOverflowPos  = ref({ top: 0, right: 0, maxWidth: 200 })

// ── Computed ───────────────────────────────────────────────────────────────

const hasMore      = computed(() => ALL_APPS.length > MAX_VISIBLE_APPS)
const visibleApps  = computed(() => ALL_APPS.slice(0, hasMore.value ? MAX_VISIBLE_APPS - 1 : MAX_VISIBLE_APPS))
const overflowApps = computed(() => hasMore.value ? ALL_APPS.slice(MAX_VISIBLE_APPS - 1) : [])

const activeApp     = computed(() => ALL_APPS.find(a => a.id === activeAppId.value) ?? ALL_APPS[0])
const activeTabs    = computed(() => APP_TABS[activeAppId.value] ?? [])
const activeTab     = computed(() => activeTabs.value[activeTabIdx.value] ?? '')
const activeEntries = computed(() => TAB_ENTRIES[activeTab.value] ?? [])

const hasMoreTabs         = computed(() => activeTabs.value.length > MAX_VISIBLE_TABS)
const visibleTabs         = computed(() =>
  hasMoreTabs.value ? activeTabs.value.slice(0, MAX_VISIBLE_TABS - 1) : activeTabs.value
)
const overflowTabs        = computed(() =>
  hasMoreTabs.value ? activeTabs.value.slice(MAX_VISIBLE_TABS - 1) : []
)
const activeTabInOverflow = computed(() =>
  hasMoreTabs.value && activeTabIdx.value >= MAX_VISIBLE_TABS - 1
)

// ── Methods ────────────────────────────────────────────────────────────────

function selectApp(id: string) {
  activeAppId.value     = id
  selectedEntry.value   = null
  showDetail.value      = false
  morePopupOpen.value   = false
  tabOverflowOpen.value = false
}

function selectTab(idx: number) {
  activeTabIdx.value    = idx
  selectedEntry.value   = null
  showDetail.value      = false
  tabOverflowOpen.value = false
}

function selectOverflowTab(overflowIdx: number) {
  selectTab((MAX_VISIBLE_TABS - 1) + overflowIdx)
}

function openMorePopup(event: MouseEvent) {
  const btn    = event.currentTarget as HTMLElement
  const rect   = btn.getBoundingClientRect()
  const popupW = 208
  if (window.innerWidth - rect.right >= popupW + 16) {
    // enough room to the right (iPad sidebar)
    morePopupPos.value = { left: rect.right + 10, top: rect.top + rect.height / 2, bottom: 0, anchor: 'right' }
  } else {
    // bottom bar (iPhone) — open above, centred on button
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

function openTabOverflow(event: MouseEvent) {
  const btn  = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  // maxWidth: popup must not extend past the left edge of the left pane (sidebar is ~80px)
  const maxWidth = Math.max(140, rect.right - 84)
  tabOverflowPos.value = { top: rect.bottom + 4, right: window.innerWidth - rect.right, maxWidth }
  tabOverflowOpen.value = !tabOverflowOpen.value
}

function selectEntry(entry: string) {
  selectedEntry.value = entry
  showDetail.value    = true
}
</script>

<template>
  <UApp>
  <!-- Root wrapper -->
  <div class="overflow-hidden" style="height: 100dvh">

    <!-- ══════════════════════════════════════════════════════════════════════
         TABLET / DESKTOP  (≥ sm · 640 px)
         ══════════════════════════════════════════════════════════════════════ -->
    <div class="hidden sm:flex overflow-hidden bg-white dark:bg-gray-900" style="height: 100dvh">

      <!-- ── Vertical app bar ──────────────────────────────────────────── -->
      <div class="w-20 flex-none flex flex-col items-center pt-4 pb-4 gap-2 z-10 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

        <!-- User pill -->
        <button
          class="w-10 h-10 aspect-square shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all active:scale-95 mb-1"
          style="background: var(--color-app-bar)"
          @click="userDrawerOpen = true"
        >
          {{ MOCK_USER.initials }}
        </button>

        <div class="w-10 border-t border-gray-200 dark:border-gray-700 mb-1" />

        <!-- App icons -->
        <button
          v-for="app in visibleApps"
          :key="app.id"
          :title="app.label"
          class="flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
          :class="activeAppId === app.id ? '' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'"
          :style="activeAppId === app.id ? 'color: var(--color-app-bar)' : ''"
          @click="selectApp(app.id)"
        >
          <UIcon :name="app.icon" class="w-6 h-6" />
          <span class="text-[9px] leading-none font-medium">{{ app.label }}</span>
          <div class="h-0.5 w-6 rounded-full mt-0.5 transition-all"
               :style="activeAppId === app.id ? 'background: var(--color-app-bar)' : 'background: transparent'" />
        </button>

        <!-- More icon -->
        <button
          v-if="hasMore"
          title="More"
          class="flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
          @click="openMorePopup"
        >
          <UIcon name="i-heroicons-ellipsis-horizontal-circle" class="w-6 h-6" />
          <span class="text-[9px] leading-none font-medium">More</span>
        </button>

      </div>

      <!-- ── Right section ──────────────────────────────────────────────── -->
      <div class="flex flex-1 min-w-0 overflow-hidden">

        <!-- Left panel — 30% -->
        <div class="flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden flex-none"
             style="width: 30%; min-width: 220px; max-width: 320px">

          <!-- App name heading -->
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-none">
            <h1 class="text-base font-semibold text-gray-900 dark:text-white">{{ activeApp.label }}</h1>
          </div>

          <!-- Tab button group -->
          <div class="flex overflow-x-auto px-3 py-2 gap-1.5 flex-none border-b border-gray-100 dark:border-gray-800"
               style="-webkit-overflow-scrolling: touch; scrollbar-width: none">
            <button
              v-for="(tab, idx) in visibleTabs"
              :key="tab"
              class="flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer"
              :class="activeTabIdx === idx
                ? 'text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
              :style="activeTabIdx === idx ? 'background: var(--color-app-bar)' : ''"
              @click="selectTab(idx)"
            >{{ tab }}</button>
            <!-- ▼ as part of the group -->
            <button
              v-if="hasMoreTabs"
              class="flex-none px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
              :class="activeTabInOverflow ? 'text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
              :style="activeTabInOverflow ? 'background: var(--color-app-bar)' : ''"
              @click="openTabOverflow"
            >▼</button>
          </div>

          <!-- Entry list -->
          <div class="flex-1 overflow-y-auto">
            <button
              v-for="entry in activeEntries"
              :key="entry"
              class="w-full text-left px-4 py-3 text-sm border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors relative"
              :class="selectedEntry === entry
                ? 'bg-blue-50 dark:bg-blue-950/30 font-medium'
                : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'"
              :style="selectedEntry === entry ? 'color: var(--color-app-bar)' : ''"
              @click="selectEntry(entry)"
            >
              <span v-if="selectedEntry === entry"
                    class="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                    style="background: var(--color-app-bar)" />
              {{ entry }}
            </button>
          </div>

        </div>

        <!-- Content panel -->
        <div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            leave-active-class="transition-all duration-150 ease-in"
            leave-to-class="opacity-0"
            mode="out-in"
          >
            <div v-if="selectedEntry" :key="selectedEntry" class="p-8">
              <div class="max-w-2xl">
                <p class="text-xs font-medium mb-1" style="color: var(--color-app-bar)">
                  {{ activeApp.label }} › {{ activeTab }}
                </p>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ selectedEntry }}</h2>
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p class="text-gray-400 dark:text-gray-500 italic text-sm">
                    Content for "{{ selectedEntry }}" will appear here.
                  </p>
                </div>
              </div>
            </div>
            <div v-else key="empty" class="flex items-center justify-center h-full">
              <div class="text-center text-gray-300 dark:text-gray-700">
                <UIcon :name="activeApp.icon" class="w-14 h-14 mx-auto mb-3" />
                <p class="text-sm">Select an item from the list</p>
              </div>
            </div>
          </Transition>
        </div>

      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         MOBILE / PHONE  (< sm · 640 px)
         ══════════════════════════════════════════════════════════════════════ -->
    <div class="flex sm:hidden flex-col overflow-hidden bg-white dark:bg-gray-900" style="height: 100dvh">

      <!-- Top bar -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-none">
        <template v-if="showDetail">
          <button
            class="flex items-center gap-1 text-sm font-medium cursor-pointer active:opacity-70 flex-none"
            style="color: var(--color-app-bar)"
            @click="showDetail = false"
          >
            <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
            {{ activeTab }}
          </button>
          <h1 class="text-base font-semibold text-gray-900 dark:text-white flex-1 truncate">
            {{ selectedEntry }}
          </h1>
        </template>
        <template v-else>
          <button
            class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-opacity-30 transition-all active:scale-95 flex-none"
            style="background: var(--color-app-bar); ring-color: var(--color-app-bar)"
            @click="userDrawerOpen = true"
          >
            {{ MOCK_USER.initials }}
          </button>
          <h1 class="text-base font-semibold text-gray-900 dark:text-white flex-1 truncate">
            {{ activeApp.label }}
          </h1>
        </template>
      </div>

      <!-- Tab button group -->
      <div v-show="!showDetail"
           class="flex overflow-x-auto px-3 py-2 gap-1.5 flex-none border-b border-gray-100 dark:border-gray-800"
           style="-webkit-overflow-scrolling: touch; scrollbar-width: none">
        <button
          v-for="(tab, idx) in visibleTabs"
          :key="tab"
          class="flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer"
          :class="activeTabIdx === idx
            ? 'text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
          :style="activeTabIdx === idx ? 'background: var(--color-app-bar)' : ''"
          @click="selectTab(idx)"
        >{{ tab }}</button>
        <!-- ▼ as part of the group -->
        <button
          v-if="hasMoreTabs"
          class="flex-none px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
          :class="activeTabInOverflow ? 'text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'"
          :style="activeTabInOverflow ? 'background: var(--color-app-bar)' : ''"
          @click="openTabOverflow"
        >▼</button>
      </div>

      <!-- Sliding content area -->
      <div class="flex-1 overflow-hidden">
        <div
          class="flex h-full transition-transform duration-300 ease-in-out"
          :class="showDetail ? '-translate-x-1/2' : 'translate-x-0'"
          style="width: 200%"
        >
          <div class="overflow-y-auto bg-white dark:bg-gray-900" style="width: 50%; height: 100%">
            <button
              v-for="entry in activeEntries"
              :key="entry"
              class="w-full flex items-center gap-3 px-4 py-4 text-sm border-b border-gray-100 dark:border-gray-800 cursor-pointer text-left active:bg-gray-50 dark:active:bg-gray-800"
              @click="selectEntry(entry)"
            >
              <span class="flex-1 text-gray-800 dark:text-gray-200">{{ entry }}</span>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-300 flex-none" />
            </button>
          </div>
          <div class="overflow-y-auto bg-gray-50 dark:bg-gray-950" style="width: 50%; height: 100%">
            <div v-if="selectedEntry" class="p-5">
              <p class="text-xs text-gray-400 mb-5">{{ activeApp.label }} › {{ activeTab }}</p>
              <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                <p class="text-gray-400 italic text-sm">Content for "{{ selectedEntry }}" will appear here.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom app bar -->
      <div
        class="flex-none border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-stretch"
        style="padding-bottom: env(safe-area-inset-bottom)"
      >
        <button
          v-for="app in visibleApps"
          :key="app.id"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all cursor-pointer active:opacity-70"
          :style="activeAppId === app.id ? 'color: var(--color-app-bar)' : 'color: #9ca3af'"
          @click="selectApp(app.id)"
        >
          <UIcon :name="app.icon" class="w-6 h-6" />
          <span class="text-[10px] font-medium">{{ app.label }}</span>
        </button>
        <button
          v-if="hasMore"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-400 cursor-pointer"
          @click="openMorePopup"
        >
          <UIcon name="i-heroicons-ellipsis-horizontal-circle" class="w-6 h-6" />
          <span class="text-[10px] font-medium">More</span>
        </button>
      </div>

    </div>

  </div><!-- /root clip wrapper -->

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
          <div class="pr-5 py-6 flex items-center gap-3 flex-none" style="background: var(--color-app-bar)">
            <div class="w-12 h-12 aspect-square rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/40 flex-none" style="margin-left: 20px">
              {{ MOCK_USER.initials }}
            </div>
            <div class="min-w-0">
              <p class="text-white font-semibold text-sm truncate">{{ MOCK_USER.name }}</p>
              <p class="text-white/70 text-xs truncate">{{ MOCK_USER.email }}</p>
            </div>
            <button class="ml-auto text-white/70 hover:text-white p-1 rounded cursor-pointer" @click="userDrawerOpen = false">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto py-2">
            <button
              v-for="item in USER_MENU_ITEMS"
              :key="item.label"
              class="w-full flex items-center gap-3 pl-8 pr-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
            >
              <UIcon :name="item.icon" class="w-5 h-5 text-gray-400 flex-none" />
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════════
         SHARED: TAB OVERFLOW POPUP
         ══════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="tabOverflowOpen" class="fixed inset-0 z-40" @click="tabOverflowOpen = false">
        <div
          class="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
          style="min-width: 160px"
          :style="`top: ${tabOverflowPos.top}px; right: ${tabOverflowPos.right}px; max-width: ${tabOverflowPos.maxWidth}px`"
          @click.stop
        >
          <button
            v-for="(tab, i) in overflowTabs"
            :key="tab"
            class="w-full text-left px-6 py-3 text-sm font-medium cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
            :style="activeTabIdx === (MAX_VISIBLE_TABS - 1 + i) ? 'color: var(--color-app-bar)' : 'color: #374151'"
            @click="selectOverflowTab(i)"
          >{{ tab }}</button>
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════════
         SHARED: MORE APPS TALK-BUBBLE POPUP
         ══════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="morePopupOpen" class="fixed inset-0 z-50" @click="morePopupOpen = false">
        <!-- Talk-bubble panel -->
        <div
          class="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
          style="min-width: 208px"
          :style="morePopupPos.anchor === 'right'
            ? `left: ${morePopupPos.left}px; top: ${morePopupPos.top}px; transform: translateY(-50%)`
            : `left: ${morePopupPos.left}px; bottom: ${morePopupPos.bottom}px`"
          @click.stop
        >
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-1" style="padding-left: 24px">More Apps</p>
          <button
            v-for="app in overflowApps"
            :key="app.id"
            class="w-full flex items-center gap-3 px-6 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            @click="selectApp(app.id)"
          >
            <UIcon :name="app.icon" class="w-5 h-5 flex-none" style="color: var(--color-app-bar)" />
            {{ app.label }}
          </button>
          <!-- Arrow pointing left (sidebar mode) -->
          <div v-if="morePopupPos.anchor === 'right'" class="absolute top-1/2"
               style="transform: translateY(-50%); left: -8px; width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-right: 8px solid white" />
          <!-- Arrow pointing down (bottom-bar mode) -->
          <div v-if="morePopupPos.anchor === 'above'" class="absolute left-1/2"
               style="transform: translateX(-50%); bottom: -8px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid white" />
        </div>
      </div>
    </Teleport>

  </UApp>
</template>

<style scoped>
@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
</style>
