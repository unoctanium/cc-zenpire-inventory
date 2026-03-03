// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
    compatibilityDate: '2026-01-01',
    
    devtools: { enabled: true },

    app: {
      head: {
        link: [
          { rel: 'icon', type: 'image/png', href: '/logo.png' },
          { rel: 'apple-touch-icon', href: '/logo.png' },
          { rel: 'manifest', href: '/manifest.json' },
        ],
        meta: [
          { name: 'theme-color', content: '#0082c9' },
          // iOS standalone mode: hides Safari chrome when launched from home screen
          { name: 'apple-mobile-web-app-capable', content: 'yes' },
          // 'default' = status bar stays visible with dark content; app content sits below it
          // (use 'black-translucent' only if you want content to extend under the status bar)
          { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
          { name: 'apple-mobile-web-app-title', content: 'Zenpire' },
        ],
      },
    },
        
    modules: [
      '@nuxt/ui',
      '@nuxtjs/i18n',  // add this
    ],
    css: ['~/assets/css/main.css'],
   
    i18n: {
      locales: [
        { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
        { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
        { code: 'ja', language: 'ja-JP', name: '日本語',  file: 'ja.json' },
      ],
      defaultLocale: 'en',
      lazy: true,
      langDir: 'locales/',
      strategy: 'no_prefix',
    },

    runtimeConfig: {
      devMode: process.env.DEV_MODE === '1',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
      public: {
          supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
          supabasePublishableKey: process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          siteUrl: process.env.NUXT_PUBLIC_SITE_URL,
      },
    },
    vite: {
        server: {
          allowedHosts: ['dev.zenpire.eu'],
          host: true,
          port: 3000
        }
    }
})
