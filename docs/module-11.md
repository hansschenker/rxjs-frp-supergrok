# Module 11: Advanced State Management

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module takes state management to the next level by adding **Undo/Redo**, **Time Travel**, and advanced patterns on top of the `scan` + reducer foundation. These features are what separate basic state management from professional-grade solutions used in tools like Redux DevTools, Figma, and many enterprise applications.

**Estimated Total Time:** 125–145 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Module 10 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Implement Undo/Redo functionality using state history
- Add Time Travel debugging capabilities
- Build an enhanced Todo application with full history support
- Understand optimistic updates and conflict resolution
- Prepare for production-grade state management systems

---

## Lesson 11.1: Undo/Redo Logic with History Management

**Estimated Time:** 22 minutes

### The Undo/Redo Pattern
We wrap the current state in a **history** of past, present, and future states:

```ts
interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const initialHistoryState: HistoryState<TodoState> = {
  past: [],
  present: initialTodoState,
  future: []
};
```

- **Undo** moves `present` into `future` and pops the last `past` into `present`.
- **Redo** does the reverse.
- Any *other* action pushes the old `present` onto `past`, sets the new present, and **clears `future`** (a new edit invalidates the redo branch).

### The `undoable` Higher-Order Reducer
The elegant trick: a function that *wraps any reducer* and gives it history — your base reducer never changes.

```ts
function undoable<T>(reducer: (s: T, a: any) => T, maxHistory = 50) {
  return (state: HistoryState<T>, action: any): HistoryState<T> => {
    const { past, present, future } = state;
    switch (action.type) {
      case 'UNDO': {
        if (past.length === 0) return state;
        const previous = past[past.length - 1];
        return { past: past.slice(0, -1), present: previous, future: [present, ...future] };
      }
      case 'REDO': {
        if (future.length === 0) return state;
        const next = future[0];
        return { past: [...past, present], present: next, future: future.slice(1) };
      }
      default: {
        const newPresent = reducer(present, action);
        if (newPresent === present) return state;       // no change → don't record history
        return { past: [...past, present].slice(-maxHistory), present: newPresent, future: [] };
      }
    }
  };
}
```

### Why Immutability (Module 10) Pays Off Here
Because every reducer update returns a **new** object, each entry in `past`/`future` is an independent snapshot. If you had mutated state, every history entry would point at the *same* mutated object — and undo would be meaningless. **Undo/redo is the reward for immutability.**

### Common Mistake
**Recording history for no-op actions.** If `reducer(present, action) === present` (nothing changed), don't push to `past` — otherwise undo appears to "do nothing" for several presses. The `newPresent === present` guard handles this.

### Quick Exercise
Trace `past`/`present`/`future` through: ADD "a", ADD "b", UNDO, ADD "c". What is in `future` after the final ADD? (Answer: it's cleared.)

**Key Takeaway:** Wrap any reducer with `undoable` to get past/present/future history — UNDO/REDO shuffle between the three lists, and a new edit clears the redo branch.

---

## Lesson 11.2: Time Travel Support and State Snapshots

**Estimated Time:** 22 minutes

### From Undo/Redo to Time Travel
Undo/redo step one at a time. **Time travel** jumps directly to *any* point. The full timeline is simply:

```ts
const timeline = [...past, present, ...future];
const currentIndex = past.length;   // where "present" sits in the timeline
```

### A `JUMP` Action
Add one case to `undoable` to teleport to any index:

```ts
case 'JUMP': {
  const timeline = [...past, present, ...future];
  const i = Math.max(0, Math.min(action.index, timeline.length - 1));
  return {
    past: timeline.slice(0, i),
    present: timeline[i],
    future: timeline.slice(i + 1),
  };
}
```

A slider bound to `currentIndex` now scrubs through history — exactly how Redux DevTools' time-travel works.

### Snapshots & Serialization
Because each state is an immutable plain object, a snapshot is just a copy you can store or serialize:

```ts
const snapshot = structuredClone(historyState);     // capture
localStorage.setItem('snapshot', JSON.stringify(snapshot));
// ...restore later by dispatching a RESTORE action that sets state to the snapshot
```

### Bounding History (Memory)
Unbounded history grows forever. Cap `past` to the last N entries:

```ts
const MAX = 50;
const past = [...state.past, present].slice(-MAX);
```

### Common Mistake
**Storing derived data in history.** Keep history to the *source* state. Snapshotting computed values (filtered lists, totals) bloats memory and risks inconsistency — recompute derived data with selectors instead.

### Quick Exercise
Add the `JUMP` case and a `RESTORE` case (sets the whole `HistoryState` from a snapshot). What index does the slider show right after a `RESTORE`?

**Key Takeaway:** The full timeline is `[...past, present, ...future]`; a `JUMP` action enables direct time travel, snapshots are plain-object copies, and history should be bounded and source-only.

---

## Lesson 11.3: Combining scan with Higher-Order State Streams

**Estimated Time:** 22 minutes

### Composing State from Slices
Large apps split state into slices, each with its own reducer, then combine — the `combineReducers` idea:

```ts
function combineReducers(reducers: Record<string, Function>) {
  return (state: any = {}, action: any) => {
    const next: any = {};
    let changed = false;
    for (const key in reducers) {
      next[key] = reducers[key](state[key], action);
      if (next[key] !== state[key]) changed = true;
    }
    return changed ? next : state;   // preserve reference if nothing changed
  };
}

const rootReducer = combineReducers({ todos: todosReducer, ui: uiReducer });
```

### Combining State Streams
You can also keep slices as separate streams and merge them reactively with `combineLatest`:

```ts
import { combineLatest } from 'rxjs';

const viewModel$ = combineLatest([todos$, filter$, user$]).pipe(
  map(([todos, filter, user]) => ({ todos: applyFilter(todos, filter), user }))
);
```

### Higher-Order State: scan Feeding Effects
State changes can *trigger* async work, whose results feed back as actions — `scan` and the flattening operators (Module 05) working together:

```ts
state$.pipe(
  map(s => s.query),
  distinctUntilChanged(),
  switchMap(query => api.search(query)),   // higher-order: state → stream of results
  map(results => ({ type: 'RESULTS', results }))
).subscribe(action => actions$.next(action));
```

### Common Mistake
**One giant reducer for everything.** A 300-line reducer is unmaintainable. Split into slice reducers and `combineReducers`, just as you split components — and keep the reference-equality optimization so unchanged slices don't trigger renders.

### Quick Exercise
Split a `{ todos, filter }` state into `todosReducer` and `filterReducer`, combine them with `combineReducers`, and confirm a `SET_FILTER` action leaves the `todos` slice reference unchanged.

**Key Takeaway:** Compose state from slice reducers (`combineReducers`) or combine slice streams (`combineLatest`), and let `scan` + flattening operators turn state changes into async effects.

---

## Lesson 11.4: Optimistic Updates and Conflict Resolution

**Estimated Time:** 20 minutes

### What Is an Optimistic Update?
Instead of waiting for the server, you update the UI **immediately** (optimistically), fire the request, then **confirm** or **roll back** based on the result. It makes apps feel instant.

```text
user acts ──► optimistic state (instant UI) ──► request ──┬─ success → CONFIRM
                                                          └─ failure → ROLLBACK
```

### Implementing It
```ts
function save(todo) {
  const prev = getCurrentState().todos.find(t => t.id === todo.id);

  dispatch({ type: 'UPDATE_OPTIMISTIC', todo });          // 1) instant UI update
  api.update(todo).pipe(
    map(() => ({ type: 'UPDATE_CONFIRMED', id: todo.id })),
    catchError(() => of({ type: 'UPDATE_ROLLBACK', id: todo.id, prev }))  // 3) restore the pre-update value
  ).subscribe(dispatch);
}
```

The rollback is essentially an automatic, targeted **undo** — which is why this module follows the history lesson.

### Conflict Resolution
When two sources change the same data, you need a policy:

| Strategy | How it works | Good for |
|----------|--------------|----------|
| Last-write-wins | newest timestamp/version wins | simple fields, low contention |
| Merge | combine non-conflicting fields | documents, forms |
| Version check | reject stale writes (optimistic concurrency) | inventory, money |

### Handling Concurrent Updates
Attach a **version** (or sequence number) to each entity. Reject or merge a write whose base version is stale:

```ts
case 'APPLY_REMOTE': {
  const local = state.byId[action.entity.id];
  if (local && local.version > action.entity.version) return state; // ignore stale remote
  return { ...state, byId: { ...state.byId, [action.entity.id]: action.entity } };
}
```

For ordering, recall Module 05: use `concatMap` for writes that must apply **in order**, never `switchMap` (which would cancel an in-flight save).

### Common Mistake
**Optimistic updates with no rollback path.** If you update the UI immediately but don't handle failure, a rejected save leaves the UI lying. Always pair the optimistic action with a confirm/rollback.

### Quick Exercise
Add `UPDATE_OPTIMISTIC` / `UPDATE_ROLLBACK` cases to a reducer where rollback restores the previous value passed in the action.

**Key Takeaway:** Optimistic updates apply instantly then confirm or roll back; resolve concurrent changes with last-write-wins, merge, or version checks, and order writes with `concatMap`.

---

## Lesson 11.5: Project Workshop – Enhanced Todo App with Full Undo/Redo & Time Travel

**Estimated Time:** 30 minutes

### Project Goal

Take the Module 10 Todo reducer and wrap it with `undoable` to add professional history features:

- **Undo / Redo** buttons (disabled when there's nothing to undo/redo)
- A **time-travel slider** that scrubs through the entire history
- **Keyboard shortcuts** — Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) to redo
- Bounded history info (steps back / forward) and a no-op guard so trivial actions don't pollute history

### Why This Project Matters

You will see that adding undo/redo/time-travel required **zero changes to the base reducer** — you just wrapped it. That is the power of pure, immutable reducers from Module 10.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; reuse the Todo reducer from Module 10.
2. **Wrap** — `undoable(todoReducer, 50)` with `UNDO` / `REDO` / `JUMP`.
3. **Store** — `actions$ → scan(undoable(reducer), initialHistory) → history$`.
4. **Render** — present todos + history controls (undo/redo/slider) from `history$`.
5. **Shortcuts** — a keyboard stream dispatches UNDO/REDO.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Todo • Undo/Redo + Time Travel</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-lg mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Enhanced Todo</h1>
    <p class="text-zinc-400 mb-6">Undo / Redo / Time Travel on a wrapped <code class="text-emerald-400">scan</code> reducer</p>

    <input id="newTodo" type="text" autocomplete="off" placeholder="Add a todo (Enter)…"
           class="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none
                  rounded-xl px-4 py-3 mb-4 placeholder-zinc-600">

    <!-- History controls -->
    <div class="flex items-center gap-2 mb-4">
      <button id="undo" class="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-40">↶ Undo</button>
      <button id="redo" class="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-40">Redo ↷</button>
      <div class="flex-1 flex items-center gap-2">
        <input id="travel" type="range" min="0" max="0" value="0" class="w-full">
      </div>
      <span id="histInfo" class="text-xs text-zinc-500 tabular-nums w-20 text-right">0 / 0</span>
    </div>

    <ul id="list" class="space-y-2"></ul>
    <p class="text-xs text-zinc-600 mt-4">Shortcuts: Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z (or Ctrl+Y) redo</p>
  </div>

  <script>
    const { Subject, fromEvent } = rxjs;
    const { scan, startWith, shareReplay } = rxjs.operators;

    // --- Base reducer (from Module 10) ---
    function todoReducer(state, action) {
      switch (action.type) {
        case 'ADD':
          if (!action.text.trim()) return state;
          return { todos: [...state.todos, { id: Date.now(), text: action.text.trim(), done: false }] };
        case 'TOGGLE':
          return { todos: state.todos.map(t => t.id === action.id ? { ...t, done: !t.done } : t) };
        case 'DELETE':
          return { todos: state.todos.filter(t => t.id !== action.id) };
        default:
          return state;
      }
    }

    // --- undoable higher-order reducer (Lessons 11.1–11.2) ---
    const MAX_HISTORY = 50;

    function undoable(reducer, maxHistory = MAX_HISTORY) {
      return (state, action) => {
        const { past, present, future } = state;
        switch (action.type) {
          case 'UNDO': {
            if (!past.length) return state;
            return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };
          }
          case 'REDO': {
            if (!future.length) return state;
            return { past: [...past, present], present: future[0], future: future.slice(1) };
          }
          case 'JUMP': {
            const timeline = [...past, present, ...future];
            const i = Math.max(0, Math.min(action.index, timeline.length - 1));
            return { past: timeline.slice(0, i), present: timeline[i], future: timeline.slice(i + 1) };
          }
          default: {
            const newPresent = reducer(present, action);
            if (newPresent === present) return state;   // no-op guard
            return { past: [...past, present].slice(-maxHistory), present: newPresent, future: [] };
          }
        }
      };
    }

    const initial = { past: [], present: { todos: [] }, future: [] };

    // --- Store ---
    const actions$ = new Subject();
    const dispatch = a => actions$.next(a);
    const history$ = actions$.pipe(scan(undoable(todoReducer, MAX_HISTORY), initial), startWith(initial), shareReplay(1));

    // --- DOM ---
    const listEl = document.getElementById('list');
    const newTodo = document.getElementById('newTodo');
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    const travel = document.getElementById('travel');
    const histInfo = document.getElementById('histInfo');

    const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

    history$.subscribe(h => {
      const todos = h.present.todos;
      listEl.innerHTML = todos.length ? todos.map(t => `
        <li class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
          <input type="checkbox" data-toggle="${t.id}" ${t.done ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
          <span class="flex-1 ${t.done ? 'line-through text-zinc-600' : ''}">${escapeHtml(t.text)}</span>
          <button data-delete="${t.id}" class="text-zinc-600 hover:text-red-400">✕</button>
        </li>`).join('')
        : `<li class="text-zinc-600 px-1">No todos. Add one, then try Undo.</li>`;

      undoBtn.disabled = h.past.length === 0;
      redoBtn.disabled = h.future.length === 0;

      const timelineLen = h.past.length + 1 + h.future.length;
      travel.max = String(timelineLen - 1);
      travel.value = String(h.past.length);          // current index in the timeline
      histInfo.textContent = `${h.past.length} / ${timelineLen - 1}`;
    });

    // --- Dispatch from UI ---
    fromEvent(newTodo, 'keydown').subscribe(e => {
      if (e.key === 'Enter') { dispatch({ type: 'ADD', text: newTodo.value }); newTodo.value = ''; }
    });
    fromEvent(listEl, 'click').subscribe(e => {
      const del = e.target.closest('[data-delete]');
      if (del) dispatch({ type: 'DELETE', id: Number(del.dataset.delete) });
    });
    fromEvent(listEl, 'change').subscribe(e => {
      const tog = e.target.closest('[data-toggle]');
      if (tog) dispatch({ type: 'TOGGLE', id: Number(tog.dataset.toggle) });
    });
    fromEvent(undoBtn, 'click').subscribe(() => dispatch({ type: 'UNDO' }));
    fromEvent(redoBtn, 'click').subscribe(() => dispatch({ type: 'REDO' }));
    fromEvent(travel, 'input').subscribe(() => dispatch({ type: 'JUMP', index: Number(travel.value) }));

    // --- Keyboard shortcuts ---
    fromEvent(document, 'keydown').subscribe(e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); dispatch({ type: 'REDO' }); }
    });

    newTodo.focus();
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **The base reducer was untouched** — `undoable` wraps it; history is a *cross-cutting* concern added by composition.
- **Time travel is just an index into `[...past, present, ...future]`** — the slider dispatches `JUMP`.
- **The no-op guard keeps history clean** — actions that change nothing don't create dead history entries.
- **Keyboard shortcuts are a stream too** — `fromEvent(document, 'keydown')` dispatches UNDO/REDO like any other input.

### Stretch Goals (Recommended Practice)

1. Change `MAX_HISTORY` and confirm old history drops off at the configured limit.
2. Add nested/array state (todos with sub-tasks) and verify undo still works (immutability!).
3. Persist the whole `HistoryState` to localStorage and restore on load.
4. Add an optimistic "sync" that randomly fails and rolls back via a targeted action (Lesson 11.4).

### Deliverable

An enhanced Todo app with working undo/redo, a time-travel slider, keyboard shortcuts, and accurate history info — all from wrapping the Module 10 reducer.

**Key Takeaway:** You added undo/redo and time travel by *wrapping* a pure reducer — proving that immutable `scan` state scales to professional-grade features without rewrites.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. In the `HistoryState` pattern, what happens to `future` when a brand-new action (not UNDO/REDO) is applied?
   - A) It is cleared, because a new edit invalidates the redo branch
   - B) It is preserved
   - C) It is copied into `past`
   - D) It is merged with `past`

2. What is the key advantage of the `undoable` higher-order reducer?
   - A) It makes the base reducer asynchronous
   - B) It adds history without modifying the base reducer at all
   - C) It removes the need for `scan`
   - D) It mutates state in place for speed

3. How is "time travel" to an arbitrary point implemented?
   - A) By replaying every action from the start each time
   - B) By mutating the present state
   - C) With a `JUMP` action that re-slices the `[...past, present, ...future]` timeline around an index
   - D) By storing the DOM at each step

4. Why does undo/redo depend on the immutability rules from Module 10?
   - A) It doesn't; immutability is optional here
   - B) Because immutability makes the app faster
   - C) Because reducers must be async
   - D) Because mutable updates would make every history entry point at the same object

5. In an optimistic update, what must always accompany the immediate UI change?
   - A) A page reload
   - B) A `BehaviorSubject`
   - C) A confirm/rollback path for when the request fails
   - D) A `switchMap` to cancel the write

**Correct Answers:** 1-A, 2-B, 3-C, 4-D, 5-C

**Explanations:**
- Q1: Applying a new action clears `future` — once you branch off, the old redo path no longer applies.
- Q2: `undoable` wraps any reducer to add past/present/future history without changing the base reducer — a cross-cutting concern via composition.
- Q3: A `JUMP` action rebuilds past/present/future by slicing the combined timeline around the target index.
- Q4: Immutable updates make each history entry an independent snapshot; mutation would make them all reference the same object, breaking undo.
- Q5: Optimistic UI must pair with confirm/rollback so a failed request doesn't leave the UI showing a lie.

---

## Module Summary & Next Steps

You can now build professional-grade state features:
- Undo/redo via the `undoable` higher-order reducer (past/present/future)
- Time travel with a `JUMP` action over the full timeline, plus snapshots and bounded history
- Composing state with `combineReducers` / `combineLatest`, and effects from state via flattening operators
- Optimistic updates with confirm/rollback, and conflict resolution (last-write-wins, merge, version checks)

**Next Module:** Module 12 – DevTools & Debugging (inspecting streams, custom operators for logging, and debugging reactive applications)

**Recommended Practice:** Add bounded history and localStorage persistence to the Enhanced Todo, then introduce an optimistic sync that occasionally fails and rolls back.

---

*Improved Module 11 v2.0 – Part of the RxJS Mastery Professional Course*
