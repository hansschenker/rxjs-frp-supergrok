import { defineConfig } from 'vitepress'

// VitePress configuration for "RxJS Mastery: Thinking in Streams".
// The course content lives as Markdown directly in docs/ (module-01.md … module-20.md);
// this config turns it into a navigable documentation site.
//
// Local dev:   npm run docs:dev      (serves docs/ at http://localhost:5173)
// Build:       npm run docs:build     (output: docs/.vitepress/dist)
// Preview:     npm run docs:preview
export default defineConfig({
  title: 'RxJS Mastery',
  description:
    'Thinking in Streams — a 20-module professional course on Functional Reactive Programming with RxJS.',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,

  // The course Markdown contains many code samples and marble diagrams; relax dead-link
  // checking so the build never fails on a `[...]( )`-shaped string inside a snippet.
  // Tighten this later if you want strict cross-module link validation.
  ignoreDeadLinks: true,

  // Deployed to GitHub Pages at https://hansschenker.github.io/rxjs-frp-supergrok/,
  // so asset URLs must resolve under the repo sub-path. If you later serve from a
  // custom domain or the repo root, set this back to '/'.
  base: '/rxjs-frp-supergrok/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Overview', link: '/readme' },
      { text: 'Course Outline', link: '/course-outline' },
      {
        text: 'Modules',
        items: [
          { text: 'Foundations · 01–04', link: '/module-01' },
          { text: 'Advanced Operators · 05–08', link: '/module-05' },
          { text: 'State & DevTools · 09–12', link: '/module-09' },
          { text: 'Windowing · 13–16', link: '/module-13' },
          { text: 'Architecture & Capstone · 17–20', link: '/module-17' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Course Overview', link: '/readme' },
          { text: 'Course Outline', link: '/course-outline' },
        ],
      },
      {
        text: 'Foundations & Core Concepts',
        collapsed: false,
        items: [
          { text: '01 · Foundations of RxJS', link: '/module-01' },
          { text: '02 · Core Concepts', link: '/module-02' },
          { text: '03 · Pipe Composition', link: '/module-03' },
          { text: '04 · Domain Operators', link: '/module-04' },
        ],
      },
      {
        text: 'Advanced Operators & Error Handling',
        collapsed: false,
        items: [
          { text: '05 · Flattening Operators', link: '/module-05' },
          { text: '06 · Custom Flattening', link: '/module-06' },
          { text: '07 · Error Handling', link: '/module-07' },
          { text: '08 · Retry & Resilience', link: '/module-08' },
        ],
      },
      {
        text: 'Schedulers, State & DevTools',
        collapsed: false,
        items: [
          { text: '09 · Schedulers Deep Dive', link: '/module-09' },
          { text: '10 · State Management Basics', link: '/module-10' },
          { text: '11 · Advanced State Management', link: '/module-11' },
          { text: '12 · DevTools & Debugging', link: '/module-12' },
        ],
      },
      {
        text: 'Backpressure, Windowing & Custom Operators',
        collapsed: false,
        items: [
          { text: '13 · Backpressure Strategies', link: '/module-13' },
          { text: '14 · Window & Buffer', link: '/module-14' },
          { text: '15 · Time Windowing', link: '/module-15' },
          { text: '16 · Custom Operators Mastery', link: '/module-16' },
        ],
      },
      {
        text: 'Architecture, Performance, Testing & Capstone',
        collapsed: false,
        items: [
          { text: '17 · Architecture Patterns', link: '/module-17' },
          { text: '18 · Performance', link: '/module-18' },
          { text: '19 · Testing', link: '/module-19' },
          { text: '20 · Capstone', link: '/module-20' },
        ],
      },
      {
        text: 'Wrap-up',
        items: [{ text: '🎓 Course Completion', link: '/course-completion' }],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/hansschenker/rxjs-frp-supergrok' },
    ],

    search: { provider: 'local' },

    outline: { level: [2, 3], label: 'On this page' },

    docFooter: { prev: true, next: true },

    footer: {
      message: 'Created with SuperGrok · Released under the MIT License.',
      copyright: 'RxJS Mastery: Thinking in Streams · June 2026',
    },
  },
})
