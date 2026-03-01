const ALL_APPS = [
  {
    id: 'dashboard',
    labelKey: 'nav.apps.dashboard',
    icon: 'i-heroicons-squares-2x2',
    to: '/',
    inTopBar: true,
    links: [
      { labelKey: 'nav.apps.recipes', to: '/recipes' },
      { labelKey: 'nav.apps.stock',   to: '/stock'   },
    ],
  },
  {
    id: 'recipes',
    labelKey: 'nav.apps.recipes',
    icon: 'i-heroicons-book-open',
    to: '/recipes-production',
    inTopBar: true,
    links: [
      { labelKey: 'nav.production',  to: '/recipes-production' },
      { labelKey: 'nav.recipes',     to: '/recipes',      requireManage: true },
      { labelKey: 'nav.ingredients', to: '/ingredients' },
      { labelKey: 'nav.allergens',   to: '/allergens'   },
      { labelKey: 'nav.allergenCard', to: '/allergen-card' },
      { labelKey: 'nav.units',       to: '/units'       },
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
  {
    id: 'admin',
    labelKey: 'nav.apps.admin',
    icon: 'i-heroicons-cog-6-tooth',
    to: '/admin/db-tools',
    inTopBar: false,
    links: [
      { labelKey: 'nav.dbTools', to: '/admin/db-tools' },
      { labelKey: 'nav.rbac',    to: '/admin/rbac'     },
    ],
  },
  {
    id: 'settings',
    labelKey: 'nav.apps.settings',
    icon: 'i-heroicons-user-circle',
    to: '/settings',
    inTopBar: false,
    links: [
      { labelKey: 'nav.personalSettings', to: '/settings' },
    ],
  },
]

const ROUTE_MAP: Record<string, string> = {
  '/recipes-production': 'recipes',
  '/recipes':            'recipes',
  '/ingredients':        'recipes',
  '/allergens':          'recipes',
  '/allergen-card':      'recipes',
  '/units':              'recipes',
  '/stock':       'stock',
  '/admin':       'admin',
  '/settings':    'settings',
  '/':            'dashboard',
}

export function useAppNav() {
  const route = useRoute()

  const activeAppId = useState<string>('activeAppId', () => 'dashboard')
  const sidebarOpen = useState<boolean>('sidebarOpen', () => true)

  const barApps = ALL_APPS.filter(a => a.inTopBar)

  const activeApp = computed(
    () => ALL_APPS.find(a => a.id === activeAppId.value) ?? ALL_APPS[0]
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
      if (path === '/') activeAppId.value = 'dashboard'
    },
    { immediate: true }
  )

  function setApp(app: (typeof ALL_APPS)[number]) {
    activeAppId.value = app.id
    navigateTo(app.to)
  }

  return { barApps, activeApp, activeAppId, sidebarOpen, setApp }
}
