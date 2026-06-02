# Module 10: State Management Basics

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

State management is one of the most important topics in modern frontend development. This module teaches you how to build predictable, scalable state management systems using RxJS. You will learn the **BehaviorSubject pattern** and the powerful **scan + reducer pattern**, which forms the foundation of many production state management solutions (including NgRx and custom implementations).

> This is the payoff for the `scan` rolling-window you met all the way back in Module 01 — here it grows into a full reducer-based state container.

**Estimated Total Time:** 120–140 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 01–09 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Use `BehaviorSubject` for simple shared state
- Implement the `scan` + Reducer pattern for predictable state updates
- Build a complete Todo application with reactive state
- Understand the benefits of immutable state management
- Prepare for advanced state management patterns

---

## Lesson 10.1: Why RxJS Excels at State Management

**Estimated Time:** 18 minutes

### The Problem with Traditional State
- Mutable state leads to bugs that are hard to reproduce
- Difficult to track *when* and *why* state changed
- Hard to implement features like Undo/Redo and Time Travel (Module 11)

### Why RxJS is Perfect for State
- **Observable streams** naturally represent "state over time"
- **Immutable updates** with `scan` + reducer
- **Powerful composition** — derive new state with operators
- **Built-in reactivity** — the UI updates automatically when state changes

### How It Compares to Other Libraries
You already have the primitives other state libraries are built on:

| Library | Core idea | RxJS equivalent |
|---------|-----------|-----------------|
| Redux   | actions → reducer → store | `action$.pipe(scan(reducer, init))` |
| NgRx    | Redux + RxJS effects | `scan` store + flattening operators for effects |
| Zustand | a subscribable store | a `BehaviorSubject` |

> RxJS isn't a competitor to these. It gives you the same reactive primitives and mental model many state libraries expose: a subscribable source, pure updates, derived reads, and side-effect boundaries. Once you see `scan` + reducer, NgRx stops being magic.

**Key Takeaway:** RxJS brings functional, immutable, time-aware state management — the same model you will recognize in Redux, NgRx, Zustand, and similar stores.

---

## Lesson 10.2: BehaviorSubject Pattern for Simple Shared State

**Estimated Time:** 22 minutes

### What is BehaviorSubject?
`BehaviorSubject` is a Subject that:
- Requires an **initial value**
- Always emits the **current value** to new subscribers immediately
- Exposes the latest value synchronously via `.value`

This makes it ideal for "the current state of X" shared across an app.

### Basic Example

```ts
import { BehaviorSubject } from 'rxjs';

const count$ = new BehaviorSubject<number>(0);

count$.subscribe(count => console.log('Current count:', count)); // logs 0 immediately
count$.next(1); // logs 1
count$.next(2); // logs 2
console.log(count$.value); // 2  (synchronous read)
```

### A Tiny State Service
Encapsulate the subject so consumers can only read the stream, not push arbitrary values:

```ts
class CounterStore {
  private state$ = new BehaviorSubject(0);
  readonly value$ = this.state$.asObservable();   // expose read-only stream

  increment() { this.state$.next(this.state$.value + 1); }
  reset()     { this.state$.next(0); }
}
```

### BehaviorSubject vs scan + Reducer
- **`BehaviorSubject`** — great for *simple* shared values (a toggle, current user, theme). You mutate it imperatively with `.next()`.
- **`scan` + reducer** — better for *structured* state with many action types, where you want a single, auditable update path (next lesson).

### Common Mistake
**Exposing the raw `BehaviorSubject`.** If everyone can call `.next()`, any code can corrupt state from anywhere. Expose `.asObservable()` and provide intent-named methods.

### Quick Exercise
Build a `ThemeStore` with a `BehaviorSubject<'light' | 'dark'>` initialized to `'light'`, a read-only `theme$`, and a `toggle()` method.

**Key Takeaway:** `BehaviorSubject` holds and broadcasts current state with an initial value and a synchronous `.value`; hide it behind a read-only stream and intent methods.

---

## Lesson 10.3: The Scan + Reducer Pattern for Predictable, Immutable State

**Estimated Time:** 24 minutes

### Actions In, State Out
The pattern is exactly Redux, expressed in RxJS: a stream of **actions** runs through a pure **reducer** via `scan`, producing a stream of **states**.

```ts
import { Subject } from 'rxjs';
import { scan, startWith, shareReplay } from 'rxjs/operators';

type Action = { type: 'INCREMENT' } | { type: 'ADD'; by: number } | { type: 'RESET' };

const initial = { count: 0 };

function reducer(state: typeof initial, action: Action) {
  switch (action.type) {
    case 'INCREMENT': return { ...state, count: state.count + 1 };
    case 'ADD':       return { ...state, count: state.count + action.by };
    case 'RESET':     return { ...state, count: 0 };
    default:          return state;
  }
}

const actions$ = new Subject<Action>();
const state$ = actions$.pipe(
  scan(reducer, initial),
  startWith(initial),     // emit initial state before any action
  shareReplay(1)          // one shared execution; late subscribers get current state
);

state$.subscribe(s => console.log(s));
actions$.next({ type: 'INCREMENT' });   // { count: 1 }
actions$.next({ type: 'ADD', by: 5 });  // { count: 6 }
```

### Immutability Is the Whole Point
`scan` keeps an accumulator across emissions. If you **mutate** that accumulator, you break change detection, time travel, and shared subscribers. Always return a **new** object.

```ts
// ❌ MUTATION — same reference; UIs may not update; history is corrupted
case 'ADD_TODO':
  state.todos.push(action.todo);   // mutates the array in place
  return state;                    // same reference!

// ✅ IMMUTABLE — new array, new state object
case 'ADD_TODO':
  return { ...state, todos: [...state.todos, action.todo] };
```

Common immutable updates:
```ts
// update one item in an array
todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
// remove an item
todos: state.todos.filter(t => t.id !== id)
// update nested object
user: { ...state.user, profile: { ...state.user.profile, name } }
```

### Selectors — Derived State
Derive slices with `map`, and avoid redundant renders with `distinctUntilChanged`:

```ts
const activeCount$ = state$.pipe(
  map(s => s.todos.filter(t => !t.done).length),
  distinctUntilChanged()
);
```

For selectors that return new arrays or objects, the default `distinctUntilChanged()` only compares references. Add a comparator or memoize the selector when you want to suppress equivalent derived values.

### Async Actions (Effects) — Preview
Side effects (HTTP) live *outside* the reducer (reducers must stay pure). An "effect" listens for an action, does async work, and dispatches a result action — using the flattening operators from Module 05:

```ts
actions$.pipe(
  filter(a => a.type === 'LOAD'),
  switchMap(() => api.getTodos().pipe(
    map(todos => ({ type: 'LOADED', todos })),
    catchError(() => of({ type: 'LOAD_FAILED' }))
  ))
).subscribe(a => actions$.next(a));  // feed results back as actions
```

### Common Mistake
**Doing side effects inside the reducer.** Reducers must be pure (`(state, action) => state`). HTTP, logging, and randomness belong in effects, not the reducer.

### Quick Exercise
Write a `reducer` for `{ items: string[] }` handling `ADD`, `REMOVE` (by index), and `CLEAR` — all immutable. Test it with `of(...actions).pipe(scan(reducer, initial))`.

**Key Takeaway:** `actions$ → scan(reducer) → state$` is Redux in RxJS — keep reducers pure and immutable, derive with selectors, and push side effects into effects.

---

## Lesson 10.4: Building a Todo App with Reactive State Streams

**Estimated Time:** 20 minutes

### The Architecture
Every reactive state app has the same five parts:

```text
 UI events ──► dispatch(action) ──► actions$ ──► scan(reducer) ──► state$ ──► render
                                                                     │
                                                          selectors (map + distinct)
```

### 1. State Shape & Actions
```ts
interface Todo { id: number; text: string; done: boolean; }
interface State { todos: Todo[]; filter: 'all' | 'active' | 'completed'; }

type Action =
  | { type: 'ADD'; text: string }
  | { type: 'TOGGLE'; id: number }
  | { type: 'DELETE'; id: number }
  | { type: 'SET_FILTER'; filter: State['filter'] }
  | { type: 'CLEAR_COMPLETED' };
```

### 2. The Reducer (pure, immutable)
```ts
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD':    return { ...state, todos: [...state.todos, { id: Date.now(), text: action.text, done: false }] };
    case 'TOGGLE': return { ...state, todos: state.todos.map(t => t.id === action.id ? { ...t, done: !t.done } : t) };
    case 'DELETE': return { ...state, todos: state.todos.filter(t => t.id !== action.id) };
    case 'SET_FILTER':      return { ...state, filter: action.filter };
    case 'CLEAR_COMPLETED': return { ...state, todos: state.todos.filter(t => !t.done) };
    default: return state;
  }
}
```

### 3. The Store + Selectors
```ts
const actions$ = new Subject<Action>();
const state$ = actions$.pipe(scan(reducer, initial), startWith(initial), shareReplay(1));

const visibleTodos$ = state$.pipe(
  map(s => s.todos.filter(t =>
    s.filter === 'all' ? true : s.filter === 'active' ? !t.done : t.done)),
  distinctUntilChanged((a, b) =>
    a.length === b.length && a.every((todo, i) => todo === b[i])
  )
);
```

### 4. Dispatch from the UI, Render from the Stream
The UI only ever **dispatches** actions and **renders** state — never touches state directly. That one-way flow is what makes the app predictable.

### Common Mistake
**Reading and writing state in the UI directly.** Keep it one-directional: events → actions → reducer → state → render. No shortcuts.

### Quick Exercise
Add an `EDIT` action (`{ type:'EDIT'; id; text }`) to the reducer that immutably updates a todo's text.

**Key Takeaway:** A reactive app is dispatch → `actions$` → `scan(reducer)` → `state$` → render, with selectors for derived views — strictly one-directional.

---

## Lesson 10.5: Project Workshop – Complete Todo Application with scan + Reducer

**Estimated Time:** 30 minutes

### Project Goal

Build a **complete, persistent Todo app** on the `scan` + reducer pattern:

- Add, toggle, delete todos; filter by all / active / completed; clear completed
- A single pure reducer and an immutable `state$` stream
- **localStorage persistence** — survive a refresh
- **Keyboard support** — Enter to add, Escape to clear the input
- Derived counts (active / completed) via selectors

### Why This Project Matters

This is a real, production-shaped state container in ~80 lines — no framework, no library. You will reuse this exact pattern (and extend it with undo/redo) in Module 11.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN.
2. **State** — shape + reducer (pure, immutable); load initial state from `localStorage`.
3. **Store** — `actions$` Subject → `scan(reducer)` → `state$` (`startWith` + `shareReplay(1)`).
4. **Persist** — subscribe `state$` to write `localStorage`.
5. **Render** — subscribe `state$`; dispatch actions from UI events + keyboard.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reactive Todo • RxJS scan + reducer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-lg mx-auto p-8">
    <h1 class="text-3xl font-semibold tracking-tight mb-1">Reactive Todo</h1>
    <p class="text-zinc-400 mb-6">State via <code class="text-emerald-400">scan</code> + reducer · persisted to localStorage</p>

    <input id="newTodo" type="text" autocomplete="off" placeholder="What needs doing? (Enter to add)"
           class="w-full bg-zinc-900 border border-zinc-700 focus:border-emerald-500 outline-none
                  rounded-xl px-4 py-3 mb-4 placeholder-zinc-600">

    <ul id="list" class="space-y-2 mb-4"></ul>

    <div class="flex items-center justify-between text-sm text-zinc-400 border-t border-zinc-800 pt-3">
      <span id="count">0 active</span>
      <div class="flex gap-1" id="filters">
        <button data-filter="all"       class="px-2 py-1 rounded">All</button>
        <button data-filter="active"    class="px-2 py-1 rounded">Active</button>
        <button data-filter="completed" class="px-2 py-1 rounded">Completed</button>
      </div>
      <button id="clear" class="px-2 py-1 rounded hover:text-red-400">Clear completed</button>
    </div>
  </div>

  <script>
    const { Subject, fromEvent } = rxjs;
    const { scan, startWith, shareReplay, map } = rxjs.operators;

    // --- Initial state (from localStorage if present) ---
    const DEFAULT = { todos: [], filter: 'all' };
    let initial = DEFAULT;
    try { initial = JSON.parse(localStorage.getItem('rx-todos')) || DEFAULT; } catch { initial = DEFAULT; }

    // --- Pure, immutable reducer ---
    function reducer(state, action) {
      switch (action.type) {
        case 'ADD':
          if (!action.text.trim()) return state;
          return { ...state, todos: [...state.todos, { id: Date.now(), text: action.text.trim(), done: false }] };
        case 'TOGGLE':
          return { ...state, todos: state.todos.map(t => t.id === action.id ? { ...t, done: !t.done } : t) };
        case 'DELETE':
          return { ...state, todos: state.todos.filter(t => t.id !== action.id) };
        case 'SET_FILTER':
          return { ...state, filter: action.filter };
        case 'CLEAR_COMPLETED':
          return { ...state, todos: state.todos.filter(t => !t.done) };
        default:
          return state;
      }
    }

    // --- The store ---
    const actions$ = new Subject();
    const dispatch = action => actions$.next(action);
    const state$ = actions$.pipe(
      scan(reducer, initial),
      startWith(initial),
      shareReplay(1)
    );

    // --- Persist (a side effect at the edge) ---
    state$.subscribe(s => localStorage.setItem('rx-todos', JSON.stringify(s)));

    // --- Render ---
    const listEl = document.getElementById('list');
    const countEl = document.getElementById('count');
    const newTodo = document.getElementById('newTodo');

    function visible(state) {
      return state.todos.filter(t =>
        state.filter === 'all' ? true : state.filter === 'active' ? !t.done : t.done);
    }

    state$.subscribe(state => {
      const todos = visible(state);
      listEl.innerHTML = todos.length ? todos.map(t => `
        <li class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
          <input type="checkbox" data-toggle="${t.id}" ${t.done ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
          <span class="flex-1 ${t.done ? 'line-through text-zinc-600' : ''}">${escapeHtml(t.text)}</span>
          <button data-delete="${t.id}" class="text-zinc-600 hover:text-red-400">✕</button>
        </li>`).join('')
        : `<li class="text-zinc-600 px-1">Nothing here. Add a todo above.</li>`;

      const active = state.todos.filter(t => !t.done).length;
      countEl.textContent = `${active} active`;

      document.querySelectorAll('#filters button').forEach(b =>
        b.className = `px-2 py-1 rounded ${b.dataset.filter === state.filter ? 'bg-zinc-800 text-emerald-400' : 'hover:text-zinc-200'}`);
    });

    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    // --- Dispatch from UI events ---
    fromEvent(newTodo, 'keydown').subscribe(e => {
      if (e.key === 'Enter') { dispatch({ type: 'ADD', text: newTodo.value }); newTodo.value = ''; }
      if (e.key === 'Escape') { newTodo.value = ''; }
    });

    // Event delegation for toggle/delete (list is re-rendered each state)
    fromEvent(listEl, 'click').subscribe(e => {
      const del = e.target.closest('[data-delete]');
      if (del) dispatch({ type: 'DELETE', id: Number(del.dataset.delete) });
    });
    fromEvent(listEl, 'change').subscribe(e => {
      const tog = e.target.closest('[data-toggle]');
      if (tog) dispatch({ type: 'TOGGLE', id: Number(tog.dataset.toggle) });
    });

    fromEvent(document.getElementById('filters'), 'click').subscribe(e => {
      const btn = e.target.closest('[data-filter]');
      if (btn) dispatch({ type: 'SET_FILTER', filter: btn.dataset.filter });
    });
    fromEvent(document.getElementById('clear'), 'click').subscribe(() => dispatch({ type: 'CLEAR_COMPLETED' }));

    newTodo.focus();
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **One reducer, one state stream** — every change flows through `actions$ → scan(reducer) → state$`.
- **Immutability everywhere** — each case returns a new object/array, so `shareReplay` subscribers and future history features stay correct.
- **Persistence is just another subscriber** — `state$.subscribe(write localStorage)` adds durability without touching the reducer.
- **The UI is dumb** — it dispatches actions and renders state; it never mutates state directly.

### Stretch Goals (Recommended Practice)

1. Add an `EDIT` action (double-click a todo to rename it) — immutably.
2. Add a derived `completed$` selector and show "X completed" with `distinctUntilChanged`.
3. Add an async effect: a "Load samples" button that `switchMap`s a fake fetch into `ADD` actions (Lesson 10.3).
4. Add keyboard filter shortcuts (1 = All, 2 = Active, 3 = Completed).

### Deliverable

A complete, persistent Todo app whose entire state lives in one immutable `scan` + reducer stream, with filtering, counts, localStorage, and keyboard support.

**Key Takeaway:** You built a real, framework-free state container with `scan` + reducer — the exact foundation Module 11 extends with undo/redo and time travel.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What makes `BehaviorSubject` well-suited to holding "current state"?
   - A) It requires an initial value and emits the current value to new subscribers (with a synchronous `.value`)
   - B) It buffers every value ever emitted
   - C) It can only have one subscriber
   - D) It automatically persists to localStorage

2. In the `scan` + reducer pattern, what must a reducer always be?
   - A) An async function
   - B) A method on a class
   - C) A pure function that returns new state without side effects
   - D) Wrapped in a `BehaviorSubject`

3. Why must reducer updates be immutable?
   - A) To make the code shorter
   - B) Because RxJS forbids objects
   - C) To avoid using TypeScript
   - D) Mutating the accumulator breaks change detection, shared subscribers, and time travel

4. Where should asynchronous side effects (e.g. HTTP) live in this pattern?
   - A) Inside the reducer
   - B) Inside `scan`
   - C) In an effect that listens for actions and dispatches result actions
   - D) In the `BehaviorSubject` constructor

5. In the Todo project, how does data flow when a user adds a todo?
   - A) The UI mutates the state object directly
   - B) `dispatch(ADD)` → `actions$` → `scan(reducer)` → new `state$` → render
   - C) localStorage updates first, then the UI reads it
   - D) The reducer calls the DOM directly

**Correct Answers:** 1-A, 2-C, 3-D, 4-C, 5-B

**Explanations:**
- Q1: `BehaviorSubject` needs an initial value, replays the current value to new subscribers, and exposes `.value` — ideal for current state.
- Q2: Reducers must be pure `(state, action) => newState` with no side effects, so updates are predictable and replayable.
- Q3: Mutating the `scan` accumulator yields the same reference, breaking change detection and corrupting history/time travel.
- Q4: Side effects belong in effects — listen for an action, do async work (with flattening operators), dispatch a result action; the reducer stays pure.
- Q5: Flow is strictly one-directional: dispatch → `actions$` → `scan(reducer)` → `state$` → render.

---

## Module Summary & Next Steps

You can now manage application state reactively:
- `BehaviorSubject` for simple shared values (hidden behind a read-only stream)
- The `scan` + reducer pattern — Redux, expressed in RxJS — with pure reducers and immutable updates
- Selectors for derived state; effects for async actions
- A complete, persistent Todo app built on one state stream

**Next Module:** Module 11 – Advanced State Management (undo/redo, time travel, state snapshots, and optimistic updates — built directly on this reducer)

**Recommended Practice:** Add an `EDIT` action and an async "Load samples" effect to the Todo app, keeping the reducer pure throughout.

---

*Improved Module 10 v2.0 – Part of the RxJS Mastery Professional Course*
