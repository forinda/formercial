import { defineConfig } from 'vitepress'

// Published to GitHub Pages at https://forinda.github.io/formercial/
export default defineConfig({
  title: 'Formercial',
  description: 'Make short product commercials from programmable scenes, on your own machine.',
  base: '/formercial/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/formercial/favicon.svg' }],
    [
      'meta',
      { name: 'google-site-verification', content: '7K2ToZEha4-8GYymarMDrEi5pbiAa8Bl8vsAWp4sr2M' },
    ],
  ],
  sitemap: { hostname: 'https://forinda.github.io/formercial/' },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/configuration' },
      { text: 'Contributing', link: '/contributing/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Making a commercial', link: '/guide/making-a-commercial' },
          { text: 'Voice', link: '/guide/voice' },
          { text: 'Doodle videos', link: '/guide/doodles' },
          { text: 'Custom scenes', link: '/guide/custom-scenes' },
          { text: 'Rendering', link: '/guide/rendering' },
          { text: 'History', link: '/guide/history' },
          { text: 'Command line', link: '/guide/command-line' },
          { text: 'Agents (MCP)', link: '/guide/agents' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'project.json', link: '/reference/project-json' },
          { text: 'Blocks', link: '/reference/blocks' },
          { text: 'Render drivers and voice providers', link: '/reference/drivers' },
        ],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'How to contribute', link: '/contributing/' },
          { text: 'Architecture', link: '/contributing/architecture' },
          { text: 'Security', link: '/contributing/security' },
        ],
      },
    ],
    logo: '/logo.svg',
    socialLinks: [{ icon: 'github', link: 'https://github.com/forinda/formercial' }],
    editLink: {
      pattern: 'https://github.com/forinda/formercial/edit/main/site/:path',
      text: 'Edit this page on GitHub',
    },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the Apache License 2.0.',
      copyright: 'Copyright 2026 Felix Orinda and the Formercial contributors',
    },
  },
})
