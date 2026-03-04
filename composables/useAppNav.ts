const ALL_APPS = [
  {
    id: 'dashboard',
    labelKey: 'nav.apps.dashboard',
    icon: 'i-heroicons-squares-2x2',
    to: '/',
    inTopBar: true,
    links: [],
  },
  {
    id: 'reports',
    labelKey: 'nav.apps.reports',
    icon: 'i-heroicons-chart-bar-square',
    to: '/reports',
    inTopBar: true,
    links: [],
  },
  {
    id: 'recipes',
    labelKey: 'nav.apps.recipes',
    icon: 'i-heroicons-book-open',
    to: '/recipes',
    inTopBar: true,
    links: [
      { labelKey: 'nav.recipes',     to: '/recipes'      },
      { labelKey: 'nav.ingredients', to: '/ingredients'  },
      { labelKey: 'nav.allergens',   to: '/allergens'    },
      { labelKey: 'nav.units',       to: '/units'        },
    ],
  },
  {
    id: 'stock',
    labelKey: 'nav.apps.stock',
    icon: 'i-heroicons-cube',
    to: '/stock',
    inTopBar: true,
    links: [
      { labelKey: 'nav.apps.stock', to: '/stock' },
    ],
  },
]

const ROUTE_MAP: Record<string, string> = {
  '/reports':            'reports',
  '/recipes':            'recipes',
  '/ingredients':        'recipes',
  '/allergens':          'recipes',
  '/allergen-card':      'recipes',
  '/units':              'recipes',
  '/stock':              'stock',
  '/':                   'dashboard',
}

export function useAppNav() {
  const route = useRoute()

  const activeAppId = useState<string>('activeAppId', () => 'dashboard')
  const sidebarOpen = useState<boolean>('sidebarOpen', () => true)

  const barApps = ALL_APPS.filter(a => a.inTopBar)

  const activeApp = computed(
    () => ALL_APPS.find(a => a.id === activeAppId.value)
  )

  watch(
    () => route.path,
    (path) => {
      for (const [prefix, appId] of Object.entries(ROUTE_MAP)) {
        // Skip the root prefix last — it would match everything via startsWith
        if (prefix === '/') continue
        if (path === prefix || path.startsWith(prefix + '/')) {
          activeAppId.value = appId
          return
        }
      }
      // Root only matches exactly
      if (path === '/') { activeAppId.value = 'dashboard'; return }
      // No match — deselect all bar apps (e.g. /admin, /settings)
      activeAppId.value = ''
    },
    { immediate: true }
  )

  function setApp(app: (typeof ALL_APPS)[number]) {
    activeAppId.value = app.id
    navigateTo(app.to)
  }

  const overflowApps = ALL_APPS.filter(a => !a.inTopBar)

  return { barApps, overflowApps, activeApp, activeAppId, sidebarOpen, setApp }
}
