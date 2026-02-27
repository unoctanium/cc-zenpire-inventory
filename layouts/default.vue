<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const route  = useRoute()
const { locale, locales, setLocale, t } = useI18n({ useScope: 'global' })

const auth     = useAuth()
const isAuthed = computed(() => Boolean(auth.value?.ok))
const email    = computed(() => auth.value?.email ?? '')
const isAdmin  = computed(() => Boolean(auth.value?.is_admin))
const initials = computed(() => initialsFromEmail(email.value))

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

const nav = computed(() => [
  { label: t('nav.home'),        to: '/'            },
  { label: t('nav.recipes'),     to: '/recipes'     },
  { label: t('nav.ingredients'), to: '/ingredients' },
  { label: t('nav.allergens'),   to: '/allergens'   },
  { label: t('nav.units'),       to: '/units'       },
])

const visibleNav = computed(() =>
  isAuthed.value ? nav.value : [{ label: t('nav.home'), to: '/' }]
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
    group1.push({ label: t('nav.adminSettings'), to: '/admin/tools' })
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
</script>

<template>
  <UApp>
    <div class="min-h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header class="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="font-semibold tracking-tight">Zenpire Inventory</div>
            <UBadge color="gray" variant="soft" size="xs">MVP</UBadge>
          </div>

          <div class="flex items-center gap-2">
            <UDropdownMenu :items="[langOptions]">
              <UButton color="gray" variant="ghost" size="sm">
                {{ (locales as any[]).find(l => l.code === locale)?.name }}
              </UButton>
            </UDropdownMenu>

            <UDropdownMenu v-if="isAuthed" :items="userMenuItems">
              <div
                class="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm
                       text-zinc-800 bg-white/70 cursor-pointer select-none
                       hover:bg-zinc-50 transition-colors
                       dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
              >
                <div
                  class="flex h-7 w-7 items-center justify-center rounded-full
                         bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900
                         text-xs font-semibold"
                  aria-hidden="true"
                >
                  {{ initials }}
                </div>
                <span class="max-w-[220px] truncate">{{ email }}</span>
                <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 text-zinc-400" />
              </div>
            </UDropdownMenu>
          </div>
        </div>

        <div v-if="route.path !== '/login'" class="mx-auto max-w-6xl px-4 pb-3">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in visibleNav"
              :key="item.to"
              :to="item.to"
              size="xs"
              color="gray"
              :variant="route.path === item.to ? 'solid' : 'soft'"
            >
              {{ item.label }}
            </UButton>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-4 py-6">
        <slot />
      </main>
    </div>

    <UToaster />
  </UApp>
</template>
