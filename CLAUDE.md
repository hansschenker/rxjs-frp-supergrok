# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A **content-first repository** for *RxJS Mastery: Professional Course – Thinking in Streams* — a 20-module course on Functional Reactive Programming with RxJS. The course is Markdown under `docs/`, and "working in this repo" still means authoring and editing that course Markdown.

That same Markdown is also published as a documentation site: a **VitePress** site (config in `docs/.vitepress/`) renders the 20 modules and deploys to GitHub Pages at <https://hansschenker.github.io/rxjs-frp-supergrok/>. So there now *is* a root `package.json` and a build step — but it is only VitePress packaging the existing Markdown; there is **no application source code**, and you never alter module content to satisfy the build. Automated tooling is **Markdown CI** (a lint check and a link check) plus a **Pages deploy** (see [Continuous Integration](#continuous-integration)).

The RxJS/TypeScript code that appears inside the modules is **course material** (lesson snippets and self-contained project demos), not a buildable project. Self-contained demos use RxJS 7 from a CDN (`https://unpkg.com/rxjs@7/...`) plus Tailwind via CDN, so a learner can run them by opening a single HTML file in a browser.

## File layout

The course content lives in `docs/`:
- `module-01.md` … `module-20.md` — the 20 modules, the primary content.
- `course-outline.md` — the authoritative lesson-by-lesson outline (5 lessons + 1 quiz per module). Treat this as the spec for what each module must cover.
- `readme.md` — course-level overview.
- `course-completion.md` — capstone/certificate material.
- `MODULE_IMPROVEMENT_PLAN_Module_03_10.md` and `MODULES_IMPROVEMENT_PLAN_11_TO_20.md` — review notes and quality roadmaps, now both marked ✅ completed. **All 20 modules have been brought to the "v2.0" quality bar** (5 lessons + a runnable project + quiz + summary each); Module 01 remains the reference template for structure and style. The plans are retained as a historical record of the original review — useful as polish direction if revising a module, not as a description of current state.

The VitePress site layer (rendering, not content) also lives under `docs/`:
- `.vitepress/config.ts` — site config: nav, the sidebar grouping all 20 modules into the 5 course tracks, local search, and the GitHub Pages `base` (`/rxjs-frp-supergrok/`). Build output (`.vitepress/dist`) and cache (`.vitepress/cache`) are git-ignored.
- `index.md` — the VitePress home page (hero + feature grid). It uses a `layout: home` front-matter block and intentionally has no `# H1`, so it is **excluded from markdownlint** (it would otherwise fail MD041).

Root-level tooling (outside `docs/`): `package.json` (VitePress as the only dependency, with `docs:dev` / `docs:build` / `docs:preview` scripts) and `.github/workflows/` (CI + the Pages deploy).

## Module structure (the template every module follows)

When creating or editing a module, match this exact shape — consistency across modules is a core goal:

1. `# Module NN: <Title>` heading, followed by the course subtitle line.
2. A version/last-updated blockquote (e.g. `> **Module Version:** 2.1`).
3. `## Module Overview` with **Estimated Total Time**, **Difficulty**, **Prerequisites**.
4. `## Learning Objectives` — a bulleted list.
5. Five `## Lesson NN.M: <Title>` sections. Each lesson carries an **Estimated Time** and tends to use these recurring sub-headings: `Why This Matters`, `Mental Model`, `Key Concept`, `Code Comparison`/code block, `Common Mistake(s)`, `Quick Exercise`, and a bolded `Key Takeaway`.
6. Lesson `NN.5` is always a **Project Workshop** with a goal, step-by-step build, and **Complete Working Code** (a single runnable HTML file for the foundational modules).
7. `## End-of-Module Quiz` — exactly 5 multiple-choice questions (options A–D), then a `**Correct Answers:**` line, then per-question `**Explanations:**`.
8. `## Module Summary & Next Steps` pointing to the next module, then a closing italic footer line.

The 5 lesson titles and the quiz topic for each module are fixed by `course-outline.md` — don't invent or renumber lessons; pull them from there.

## Authoring conventions

- **Code blocks:** label lesson/TypeScript snippets ` ```ts `, shell as ` ```bash `, full demos as ` ```html `. The marble-diagram notation used throughout is plain text: `next` as values on a `--1--2--3--|-->` line, `|` = complete, `X`/`#` = error.
- **State-management throughline:** the course deliberately threads the `scan` + reducer pattern from Module 01 onward and previews later concepts (e.g. a `scan` rolling-window in the Module 01 project explicitly flags "we'll go deeper in Module 10"). Preserve these forward references when editing.
- **Demo code is intentionally framework-free vanilla TS/JS** (DOM + RxJS UMD global `rxjs` / `rxjs.operators`), with framework integration (Angular `ngOnDestroy`, React `useEffect`) mentioned as notes rather than implemented. Keep that split.
- Course branding: "Created with SuperGrok"; dates are written as "June 2026". Keep this voice unless asked otherwise.

## Git

Work happens on per-module branches (e.g. `improve/module-01-foundations`, `feature/module-01-v2`) merged into `main` via pull request. When improving a module, branch per module rather than batching unrelated module edits together. Every PR must pass CI before it can merge (see below).

## Continuous Integration

GitHub Actions runs Markdown-quality checks and publishes the VitePress site. Workflows live in `.github/workflows/`:

- **`markdownlint.yml`** — lints `docs/**/*.md` with `markdownlint-cli2` (config: `.markdownlint-cli2.jsonc`, which now ignores `docs/index.md` — the VitePress hero home). It is a **required** status check on `main`: a PR cannot merge until it passes. The config keeps **MD040** (fenced code blocks must declare a language) enabled — catching the bare ` ``` ` fences the module stubs once shipped — and disables rules that conflict with the course's intentional style (e.g. MD013 long prose, MD036 bolded `Key Takeaway`, MD024 recurring lesson sub-headings). Runs on every push to `main` and every PR.
- **`link-check.yml`** — checks links in `docs/**/*.md` with `lychee` (ignore patterns in `.lycheeignore`). **Informational** (not required), so transient external failures never block merges. Note: lychee does not scan URLs inside code blocks, so the CDN `<script>` tags in the demos aren't checked; it mainly guards prose/relative links added later (`failIfEmpty: false`).
- **`deploy.yml`** — builds the VitePress site (`npm ci` → `npm run docs:build`) and deploys it to GitHub Pages. Triggered on every push to `main` (and manual `workflow_dispatch`), **after** merge — it is not a PR status check, so it never blocks a merge. GitHub Pages must be enabled with **Source = "GitHub Actions"** for it to publish; the workflow's `GITHUB_TOKEN` cannot enable Pages itself (`enablement: true` fails with "Resource not accessible by integration"), so the site was enabled once out-of-band.

Run the lint locally before pushing (matches CI; needs Node):

```bash
npx markdownlint-cli2          # uses .markdownlint-cli2.jsonc; expect "0 error(s)"
```

Preview or build the docs site locally (needs Node):

```bash
npm install
npm run docs:dev               # local preview at http://localhost:5173
npm run docs:build             # production build into docs/.vitepress/dist
```

CodeRabbit also auto-reviews each PR. The branch-protection rule on `main` requires the `markdownlint` check **by job name** — if you rename that job, update the protection rule or merges will wait on a check that never reports.
