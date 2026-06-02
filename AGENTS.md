# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this repository is

A **content-only repository** for *RxJS Mastery: Professional Course – Thinking in Streams* — a 20-module course on Functional Reactive Programming with RxJS. There is no application to build: every tracked file is Markdown under `docs/`. There is no `package.json` and no application to build or test; the only automated tooling is **Markdown CI** — a lint check and a link check that run in GitHub Actions (see [Continuous Integration](#continuous-integration)). "Working in this repo" means authoring and editing course Markdown.

The RxJS/TypeScript code that appears inside the modules is **course material** (lesson snippets and self-contained project demos), not a buildable project. Self-contained demos use RxJS 7 from a CDN (`https://unpkg.com/rxjs@7/...`) plus Tailwind via CDN, so a learner can run them by opening a single HTML file in a browser.

## File layout

Everything lives in `docs/`:
- `module-01.md` … `module-20.md` — the 20 modules, the primary content.
- `course-outline.md` — the authoritative lesson-by-lesson outline (5 lessons + 1 quiz per module). Treat this as the spec for what each module must cover.
- `readme.md` — course-level overview.
- `course-completion.md` — capstone/certificate material.
- `MODULE_IMPROVEMENT_PLAN_Module_03_10.md` and `MODULES_IMPROVEMENT_PLAN_11_TO_20.md` — review notes and quality roadmaps, now both marked ✅ completed. **All 20 modules have been brought to the "v2.0" quality bar** (5 lessons + a runnable project + quiz + summary each); Module 01 remains the reference template for structure and style. The plans are retained as a historical record of the original review — useful as polish direction if revising a module, not as a description of current state.

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

GitHub Actions runs Markdown-quality checks (there is no app build — the demos run from a CDN in the browser). Workflows live in `.github/workflows/`:

- **`markdownlint.yml`** — lints `docs/**/*.md` with `markdownlint-cli2` (config: `.markdownlint-cli2.jsonc`). It is a **required** status check on `main`: a PR cannot merge until it passes. The config keeps **MD040** (fenced code blocks must declare a language) enabled — catching the bare ` ``` ` fences the module stubs once shipped — and disables rules that conflict with the course's intentional style (e.g. MD013 long prose, MD036 bolded `Key Takeaway`, MD024 recurring lesson sub-headings). Runs on every push to `main` and every PR.
- **`link-check.yml`** — checks links in `docs/**/*.md` with `lychee` (ignore patterns in `.lycheeignore`). **Informational** (not required), so transient external failures never block merges. Note: lychee does not scan URLs inside code blocks, so the CDN `<script>` tags in the demos aren't checked; it mainly guards prose/relative links added later (`failIfEmpty: false`).

Run the lint locally before pushing (matches CI; needs Node):

```bash
npx markdownlint-cli2          # uses .markdownlint-cli2.jsonc; expect "0 error(s)"
```

CodeRabbit also auto-reviews each PR. The branch-protection rule on `main` requires the `markdownlint` check **by job name** — if you rename that job, update the protection rule or merges will wait on a check that never reports.
