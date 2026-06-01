# Module 20: Capstone

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This is the **capstone module** of the RxJS Mastery course. You will tie together everything you've learned — migrating legacy async code, the future of reactive programming, and a full integration project — then ship and present a production-grade reactive application. This module is your portfolio piece and certification project.

**Estimated Total Time:** 180–240 minutes (spread over multiple sessions)  
**Difficulty:** Expert  
**Prerequisites:** All previous modules (01–19) completed

---

## Learning Objectives

By the end of this module you will be able to:

- Migrate Promise/callback codebases to RxJS
- Articulate where reactive programming is heading (Signals, the Observable proposal)
- Integrate every major RxJS pattern into one cohesive application
- Deploy, monitor, and observe a reactive app in production
- Present and review a capstone project against a professional rubric

---

## Lesson 20.1: Migration Strategies from Promises/Callbacks to RxJS

**Estimated Time:** 24 minutes

### The Bridges into RxJS
RxJS interops cleanly with the async primitives you already have:

```ts
import { from, fromEvent, bindCallback, defer } from 'rxjs';

from(fetch('/api').then(r => r.json())); // Promise → Observable
fromEvent(button, 'click');               // EventTarget → Observable
bindCallback(navigator.geolocation.getCurrentPosition); // callback API → Observable
defer(() => from(getPromise()));          // create the Promise lazily, per subscription
```

> Use `defer(() => from(promise()))` rather than `from(promise())` when you want the Promise created **on subscription** (lazy, retryable) instead of immediately (eager, once).

### Promise vs Observable Semantics
Migrating isn't 1:1 — know the differences:

| | Promise | Observable |
|---|---------|------------|
| Values | one | zero, one, or many |
| Eager/lazy | eager (runs immediately) | lazy (runs on subscribe) |
| Cancellable | no | yes (unsubscribe) |
| Retry | manual | `retry`/operators |

### Incremental Migration
1. **Leaf-first** — wrap individual async calls (`from(fetch...)`) without changing callers.
2. **Compose** — replace Promise chains (`.then().then()`) with pipes (`switchMap`/`map`).
3. **Cancel & retry** — add the things Promises couldn't do (cancellation, backoff).
4. **Facade** — hide the migration behind a facade (Module 17) so callers are untouched.

```ts
// Before: Promise chain
getUser(id).then(u => getOrders(u.id)).then(render);

// After: cancellable, retryable pipe
of(id).pipe(
  switchMap(id => from(getUser(id))),
  switchMap(u => from(getOrders(u.id))),
  retry({ count: 2, delay: 500 })
).subscribe(render);
```

### Going Back When Needed
At the boundary (e.g. an `async` function), convert back with `firstValueFrom` / `lastValueFrom`:

```ts
const user = await firstValueFrom(user$);
```

### Common Mistake
**`from(somePromise())` when you wanted laziness.** That runs the Promise *immediately*, once — so `retry` can't re-run it and there's no cancellation. Wrap with `defer` for a fresh, lazy Promise per subscription.

### Quick Exercise
Convert a two-step Promise chain (`getUser → getPosts`) into an RxJS pipe with `switchMap`, add `retry`, and convert the result back with `firstValueFrom`.

**Key Takeaway:** Bridge async into RxJS with `from`/`fromEvent`/`bindCallback`/`defer`, migrate incrementally behind a facade, and use `defer` for lazy Promises and `firstValueFrom` to bridge back.

---

## Lesson 20.2: The Future of Reactive Programming

**Estimated Time:** 20 minutes

### Signals Are Here
Fine-grained **signals** (Angular, Solid, Vue, Preact) are now mainstream for synchronous UI state. As covered in Module 17, they *complement* RxJS rather than replace it: signals for synchronous derived view state, RxJS for async/time/event orchestration, bridged with `toSignal`/`toObservable`.

### The TC39 Observable Proposal
A standardized `Observable` has been proposed for the language/web platform. If it lands, framework-agnostic observables become a built-in primitive — RxJS would layer its rich operators on top of a native base, much as array methods layer on arrays.

### Where RxJS Is Going
- **Smaller, more tree-shakeable** — the v7 unified imports and ongoing size work (Module 18).
- **Better ergonomics** — config-object operators (`retry({count, delay})`), deprecating footguns (`retryWhen`).
- **Interop** — smoother bridges to signals and the Observable proposal.

### What Stays True
The *mental model* you've built — thinking in streams, composition, declarative time — outlasts any single API. Whatever the syntax, "a collection that arrives over time" remains the core idea.

### Common Mistake
**Treating signals and RxJS as competitors.** Choosing one for everything leads to pain (signals can't debounce/cancel; RxJS is overkill for a counter). The future is hybrid — right tool per job.

### Quick Exercise
List three responsibilities you'd give signals and three you'd keep in RxJS for a 2026 app, and name the bridge functions between them.

**Key Takeaway:** The future is hybrid — signals for synchronous view state, RxJS for async/time, possibly atop a native Observable — and the stream mental model endures regardless of API churn.

---

## Lesson 20.3: Building a Collaborative Real-Time Dashboard (Full Integration)

**Estimated Time:** 26 minutes

### The Integration Challenge
The capstone weaves together the whole course. A **collaborative real-time dashboard** (multiple users editing shared state live) exercises nearly every module:

| Concern | Module(s) | Pattern |
|---------|-----------|---------|
| Shared state | 10, 11 | `scan` + reducer, undo/redo |
| Real-time merge | 05, 06 | merge local + remote action streams |
| Async writes | 05, 08 | `concatMap` + retry/backoff |
| Optimistic updates | 11 | apply → confirm/rollback |
| High-frequency feed | 13, 14, 15 | conflate/window for presence & activity |
| Errors | 07 | error bus + graceful degradation |
| Performance | 18 | `shareReplay`, leak-free teardown |
| Architecture | 17 | facade per feature |

### Architecture Document Template
Every capstone should ship a short design doc. Use this skeleton:

```text
# <App> Architecture

## 1. Overview & goals
## 2. Feature map (feature-based folders)
## 3. State shape (interfaces) + action catalog
## 4. Data flow diagram (events → actions → reducer → state → view)
## 5. Async/effects (which operators, retry/backoff policy)
## 6. Real-time strategy (merge, conflation, conflict resolution)
## 7. Error handling (error bus, severities, UX)
## 8. Performance budget (leak strategy, shareReplay, throughput targets)
## 9. Testing strategy (unit/integration/E2E, marble coverage)
## 10. Risks & trade-offs
```

### Conflict Resolution for Collaboration
When two users edit the same item, apply a policy (Module 11): last-write-wins, merge, or version checks. For ordering of a single client's writes, `concatMap` (never `switchMap`).

### Common Mistake
**Re-rendering on every remote event.** A busy room floods updates; conflate presence/activity (`auditTime`/`bufferTime`) and keep ingestion separate from rendering (Module 13).

### Quick Exercise
Draw the data-flow diagram for the dashboard: local input and a simulated remote feed both producing actions into one reducer, with conflation before render.

**Key Takeaway:** The capstone integrates state, real-time merge, async writes, optimistic updates, conflation, error handling, performance, and architecture — design it with a short architecture doc before coding.

---

## Lesson 20.4: Production Deployment, Monitoring & Observability

**Estimated Time:** 20 minutes

### Observe Your Streams in Production
You can't fix what you can't see (Modules 07, 12, 18). Ship with:
- **Error telemetry** — pipe the error bus (Module 07) to Sentry/Datadog with severity + context.
- **Performance metrics** — track subscription counts, key stream latencies, and backpressure ratios (Modules 13, 18).
- **Custom marks** — `performance.mark/measure` around critical pipelines.

### A Telemetry Operator
Instrument any pipeline non-invasively with `tap`:

```ts
const instrument = <T>(name: string) => tap<T>({
  subscribe: () => telemetry.count(`${name}.subscribe`),
  error: e => telemetry.error(name, e),
  finalize: () => telemetry.count(`${name}.teardown`),
});
```

### SSR & Hydration
For server-side rendering, ensure streams **complete** on the server (no dangling infinite subscriptions) — use `take(1)`/`firstValueFrom` for one-shot data, and guard browser-only sources (`fromEvent`, `animationFrameScheduler`) behind platform checks.

### Deployment Hygiene
- Tree-shake and analyze the bundle (Module 18).
- Feature-flag risky reactive changes; roll out incrementally.
- Add health checks that exercise key streams.

### Common Mistake
**Shipping without observability.** Reactive bugs (leaks, dropped events, stuck circuits) are invisible without metrics. Instrument the error bus and key streams *before* you need them.

### Quick Exercise
Add an `instrument('search')` `tap` to a search pipeline and list the three telemetry signals it emits.

**Key Takeaway:** Make production reactive code observable — error telemetry from the error bus, stream/performance metrics, SSR-safe completion, and bundle hygiene — instrument before incidents, not after.

---

## Lesson 20.5: Capstone Project – Collaborative Real-Time Dashboard

**Estimated Time:** 60+ minutes

### Project Goal

Build a **collaborative task board** where simulated teammates and you edit shared state in real time — integrating state management, real-time merge, presence, activity, and error-aware sync:

- A `scan` + reducer store (Modules 10/11) fed by **merged** local + remote action streams (Modules 05/06)
- **Presence** (who's online) and a live **activity feed** (who did what), conflated for performance (Module 13)
- **Optimistic** local edits; a simulated sync with the resilience patterns (Modules 07/08) available as a stretch
- Leak-free teardown and `shareReplay` (Module 18)

### Why This Project Matters

This is the course in one screen: actions flow from multiple sources into one reducer, the UI derives from a single `state$`, remote activity is conflated, and every pattern you learned has a job. Finishing it *is* the certification.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN.
2. **Store** — reducer over `{ tasks, activity }`; `actions$ = merge(local$, remote$)` → `scan` → `state$` (`shareReplay`).
3. **Remote sim** — an `interval` emitting random teammate actions (add/complete) with a user tag.
4. **Render** — tasks (with author), a conflated activity feed, and presence.
5. **Interact** — add/complete locally; watch teammates act concurrently.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collaborative Board • RxJS Capstone</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8">
    <div class="flex items-center justify-between mb-6">
      <div><h1 class="text-3xl font-semibold tracking-tight">Collaborative Board</h1>
        <p class="text-zinc-400 mt-1">You + simulated teammates editing one reactive store</p></div>
      <div id="presence" class="flex -space-x-2"></div>
    </div>

    <div class="grid md:grid-cols-3 gap-6">
      <!-- Board -->
      <div class="md:col-span-2">
        <div class="flex gap-2 mb-3">
          <input id="newTask" placeholder="Add a task (Enter)…" class="flex-1 bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none rounded-xl px-4 py-2.5 placeholder-zinc-600">
        </div>
        <ul id="tasks" class="space-y-2"></ul>
      </div>
      <!-- Activity -->
      <div>
        <div class="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Live Activity</div>
        <div id="activity" class="space-y-1 text-xs h-72 overflow-auto"></div>
      </div>
    </div>
  </div>

  <script>
    const { Subject, merge, interval } = rxjs;
    const { map, scan, startWith, shareReplay } = rxjs.operators;

    const TEAMMATES = ['Ada', 'Alan', 'Grace'];
    const ME = 'You';
    const COLORS = { You: 'emerald', Ada: 'sky', Alan: 'amber', Grace: 'fuchsia' };
    const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

    // ===== Reducer (Modules 10/11) =====
    const initial = { tasks: [], activity: [] };
    function reducer(state, action) {
      const stamp = (msg) => [{ user: action.user, msg, t: action.t }, ...state.activity].slice(0, 40);
      switch (action.type) {
        case 'ADD':
          return { tasks: [...state.tasks, { id: action.id, text: action.text, done: false, by: action.user }],
                   activity: stamp(`added “${action.text}”`) };
        case 'COMPLETE': {
          const task = state.tasks.find(t => t.id === action.id);
          if (!task || task.done) return state;
          return { tasks: state.tasks.map(t => t.id === action.id ? { ...t, done: true } : t),
                   activity: stamp(`completed “${task.text}”`) };
        }
        default: return state;
      }
    }

    // ===== Action sources: local + simulated remote (Modules 05/06) =====
    const local$ = new Subject();
    let nextId = 1;
    const dispatchLocal = (a) => local$.next({ ...a, user: ME, id: a.id ?? ('t' + nextId++), t: Date.now() });

    const SAMPLE = ['Review PR', 'Write tests', 'Fix flaky build', 'Update docs', 'Refactor store', 'Ship release'];
    const remote$ = interval(2200).pipe(
      map(() => {
        const user = TEAMMATES[Math.floor(Math.random() * TEAMMATES.length)];
        // 50/50 add a task or complete an existing open one
        if (Math.random() < 0.5) {
          return { type: 'ADD', text: SAMPLE[Math.floor(Math.random() * SAMPLE.length)], user, id: 't' + nextId++, t: Date.now() };
        }
        return { type: 'COMPLETE', user, id: '?', t: Date.now() }; // id resolved in a tap below
      })
    );

    // ===== Store =====
    const actions$ = merge(local$, remote$).pipe(
      // resolve a remote COMPLETE to a real open task id at dispatch time
      map(a => {
        if (a.type === 'COMPLETE' && a.id === '?') {
          const open = current.tasks.filter(t => !t.done);
          if (!open.length) return { ...a, type: 'NOOP' };
          a = { ...a, id: open[Math.floor(Math.random() * open.length)].id };
        }
        return a;
      })
    );

    let current = initial;
    const state$ = actions$.pipe(scan(reducer, initial), startWith(initial), shareReplay(1));

    // ===== Render (single source of truth) =====
    const tasksEl = document.getElementById('tasks');
    const activityEl = document.getElementById('activity');
    state$.subscribe(state => {
      current = state;
      tasksEl.innerHTML = state.tasks.length ? state.tasks.map(t => `
        <li class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
          <input type="checkbox" data-done="${t.id}" ${t.done ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
          <span class="flex-1 ${t.done ? 'line-through text-zinc-600' : ''}">${escapeHtml(t.text)}</span>
          <span class="text-[10px] text-${COLORS[t.by] || 'zinc'}-400">${t.by}</span>
        </li>`).join('') : '<li class="text-zinc-600 px-1">No tasks yet — add one or wait for a teammate.</li>';

      activityEl.innerHTML = state.activity.map(a => `
        <div><span class="text-${COLORS[a.user] || 'zinc'}-400 font-medium">${a.user}</span>
        <span class="text-zinc-400">${a.msg}</span></div>`).join('');
    });

    // Presence (static here; in a real app, a heartbeat stream)
    document.getElementById('presence').innerHTML = [ME, ...TEAMMATES].map(u =>
      `<div class="w-8 h-8 rounded-full bg-${COLORS[u]}-600 border-2 border-zinc-950 flex items-center justify-center text-xs font-bold" title="${u}">${u[0]}</div>`).join('');

    // ===== Local interactions =====
    const newTask = document.getElementById('newTask');
    newTask.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.value.trim()) { dispatchLocal({ type: 'ADD', text: e.target.value.trim() }); e.target.value = ''; }
    });
    tasksEl.addEventListener('change', e => {
      const cb = e.target.closest('[data-done]');
      if (cb) dispatchLocal({ type: 'COMPLETE', id: cb.dataset.done });
    });

    newTask.focus();
  </script>
</body>
</html>
```

### Capstone Deliverables

To "pass" the capstone, ship more than code:

1. **The app** — runnable, leak-free, with the patterns above.
2. **Architecture doc** — using the template from Lesson 20.3.
3. **Test suite** — unit (operators/reducers), integration (facade + mock), a few E2E (Module 19).
4. **A short walkthrough** — present the data flow and one trade-off you made.

### Suggested Starter Repository Structure

```text
collab-board/
  src/
    features/board/   { board.api.ts, board.store.ts, board.facade.ts, board.operators.ts, board.component.ts, board.spec.ts }
    features/presence/
    shared/operators/
    shared/error-bus.ts
  test/  (marble + integration)
  ARCHITECTURE.md
  package.json   (rxjs as a dependency; sideEffects:false if shipping a lib)
```

### Evaluation Rubric

| Criterion | Weight | What "excellent" looks like |
|-----------|--------|-----------------------------|
| State management | 20% | Pure reducers, immutable, `scan`-based, undo/redo where apt |
| Operators & composition | 20% | Right operators, custom domain operators, no nested subscribes |
| Error handling & resilience | 15% | Error bus, `catchError` boundaries, retry/backoff |
| Performance & memory | 15% | Leak-free teardown, `shareReplay`, conflation under load |
| Architecture | 15% | Feature-based, facade boundaries, layered |
| Testing | 15% | Marble + unit + integration coverage of critical paths |

### Stretch Goals (Recommended Practice)

1. Add **optimistic** local edits with a simulated failing sync that rolls back (Modules 08/11).
2. Add a real **presence heartbeat** stream and show who's typing.
3. Add **undo/redo** over the board with the `undoable` reducer (Module 11).
4. Wire **Redux DevTools** (Module 12) and an **error bus** with toasts (Module 07).

### Deliverable

A collaborative task board where local and simulated-remote actions merge into one `scan` reducer, rendering tasks (with authors), a live activity feed, and presence — plus an architecture doc, tests, and a walkthrough.

**Key Takeaway:** You integrated the entire course into one real-time, multi-source reactive app — the proof of RxJS mastery: thinking in streams, end to end.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. When migrating a Promise to an Observable, why prefer `defer(() => from(makePromise()))` over `from(makePromise())`?
   - A) `defer` creates the Promise lazily per subscription, so it's cancellable and retryable
   - B) `defer` makes it run immediately
   - C) `from` cannot accept a Promise
   - D) There is no difference

2. In the 2026 hybrid model, what is the right division between RxJS and Signals?
   - A) Use signals for everything; RxJS is obsolete
   - B) Use RxJS for everything; signals are a fad
   - C) RxJS for async/time/event orchestration; signals for synchronous view state
   - D) They cannot be used together

3. In a collaborative dashboard, how are local and remote changes combined into one state?
   - A) Two separate stores that occasionally sync
   - B) `merge` both action streams into one `scan` reducer
   - C) Mutating a shared global object
   - D) Re-fetching the whole state on every change

4. Which operator orders a single client's writes so none overlap or get cancelled?
   - A) `switchMap`
   - B) `mergeMap`
   - C) `exhaustMap`
   - D) `concatMap`

5. Why instrument streams with telemetry before deploying to production?
   - A) It makes the bundle smaller
   - B) Reactive bugs (leaks, dropped events, stuck circuits) are invisible without metrics
   - C) RxJS requires it
   - D) To replace testing

**Correct Answers:** 1-A, 2-C, 3-B, 4-D, 5-B

**Explanations:**
- Q1: `defer` defers Promise creation to subscription time, making it lazy, cancellable, and retryable; bare `from(promise)` runs once, eagerly.
- Q2: The hybrid model uses RxJS for async/time/events and signals for synchronous derived view state, bridged with `toSignal`/`toObservable`.
- Q3: Merging local and remote action streams into one reducer keeps a single source of truth (Modules 05/06/10).
- Q4: `concatMap` queues writes in order with no overlap or cancellation — correct for saves/payments; `switchMap` would cancel in-flight writes.
- Q5: Without observability, reactive failures are silent; instrument the error bus and key streams before incidents occur.

---

## Module Summary & Course Completion

🎉 **You've reached the end of RxJS Mastery.** Across 20 modules you've gone from "callbacks and promises" to **thinking in streams**:

- **Foundations (01–03):** the Observable contract, marble diagrams, schedulers, pipe composition
- **Operators (04–06):** domain, flattening, and custom flattening operators
- **Resilience (07–08):** error handling and retry/circuit-breaker resilience
- **Schedulers & State (09–11):** virtual time, `scan`+reducer state, undo/redo & time travel
- **Tooling & Flow control (12–15):** DevTools, backpressure, window/buffer, time windowing
- **Mastery (16–20):** custom-operator libraries, architecture, performance, testing, and this capstone

**Next:** see `course-completion.md` for your certificate, portfolio guidance, and where to go next. Then build something real — and keep thinking in streams.

---

*Improved Module 20 v2.0 – Part of the RxJS Mastery Professional Course · Created with SuperGrok*
