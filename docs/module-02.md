# Module 02: Core Concepts

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.1  
> **Last Updated:** June 2026

---

## Module Overview

This module takes you deeper into the **foundational mental models** that make RxJS so powerful and intuitive. You will understand the mathematical duality behind Observables, become fluent in marble diagrams, master schedulers for precise timing control, learn to manage the subscription lifecycle safely, and build a real interactive visualization tool.

**Estimated Total Time:** 120–140 minutes (video + exercises)  
**Difficulty:** Beginner to Intermediate  
**Prerequisites:** Module 01 (Foundations) completed

---

## Learning Objectives

By the end of this module you will be able to:

- Clearly explain the Observer vs Iterator duality
- Read, draw, and reason with marble diagrams fluently
- Explain the main scheduler choices and choose one for common timing, animation, and testing needs
- Implement proper subscription cleanup to prevent memory leaks
- Build a fully functional interactive marble diagram visualizer

---

## Lesson 2.1: Observer vs Iterator Patterns – The Duality Explained

**Estimated Time:** 20 minutes

### Why This Matters
Most developers treat Observables as "fancy event emitters." In reality, the Observable is the **mathematical dual** of the Iterator pattern. This single insight explains why RxJS feels so natural and composable.

### The Core Duality
- **Iterator (Pull model)**: Consumer controls the flow (`next()`, `hasNext()`)
- **Observer (Push model)**: Producer controls the flow (`next(value)`, `error(err)`, `complete()`)

Erik Meijer (creator of Rx) famously said:  
> "**Subject/Observer is dual to Iterator.**"

### Code Side-by-Side

```ts
// Iterator (Pull)
const arr = [1, 2, 3];
const iterator = arr[Symbol.iterator]();
console.log(iterator.next().value); // 1
console.log(iterator.next().value); // 2

// Observable (Push)
import { of } from 'rxjs';
of(1, 2, 3).subscribe(value => console.log(value));
```

In the **pull** model, *you* ask for each value (`iterator.next()`). In the **push** model, the producer decides when values arrive — you simply react.

### The Duality Table

Every method on one side has a mirror on the other. That mirror is what "dual" means:

| Concept            | Iterator (Pull)        | Observable (Push)         |
|--------------------|------------------------|---------------------------|
| Get a value        | `next()` returns value | `observer.next(value)`    |
| Signal "no more"   | `{ done: true }`       | `observer.complete()`     |
| Signal a failure   | `throw` on `next()`    | `observer.error(err)`     |
| Who drives time?   | The **consumer**       | The **producer**          |

### Mental Model
> An Iterator is a collection you **walk through**. An Observable is a collection that **walks through you**.

Because the Observable controls timing, it can model things an Iterator never could: clicks, WebSocket messages, timers, HTTP responses — anything that arrives *when it is ready*, not when you ask.

### Key Concept
The push model is why RxJS can compose **time-based** operations as easily as arrays compose value-based ones (`map`, `filter`, `reduce`). The operators you already know from arrays have reactive twins — and they exist precisely *because* of this duality.

### Common Mistake
**Treating an Observable like a Promise that you `await` once.** A Promise resolves a single value; an Observable can push zero, one, or infinitely many values over time. Reaching for `firstValueFrom()` everywhere throws away the entire point of the push model.

### Quick Exercise
Write an iterator that yields `10, 20, 30` by hand (`arr[Symbol.iterator]()`), then reproduce the same output with `from([10, 20, 30]).subscribe(...)`. Notice which side decides *when* each value appears.

**Key Takeaway:** Observables are the push-based dual of pull-based Iterators — that duality is the source of RxJS's composability.

---

## Lesson 2.2: Marble Diagrams – Reading and Creating Visual Stream Representations

**Estimated Time:** 22 minutes

### Why This Matters
Streams are invisible — they happen over time, so you cannot "see" them in a debugger the way you see an array. **Marble diagrams** are the universal visual language for streams. Every RxJS operator's documentation uses them, and being fluent in them is the single fastest way to reason about complex pipelines.

### Anatomy of a Marble Diagram
A marble diagram draws **time** as a horizontal line flowing left to right:

```text
--1---2---3---|-->
```

| Symbol    | Meaning                                   |
|-----------|-------------------------------------------|
| `-`       | Passage of time (a "frame"), nothing emitted |
| `1 2 3`   | A `next` emission (the value)             |
| `\|`      | `complete` — the stream ends gracefully   |
| `X` or `#`| `error` — the stream terminates with a failure |
| `(ab)`    | Values `a` and `b` emitted **synchronously** at the same frame |
| `-->`     | The arrow of time continuing             |

### Reading a Diagram
Read left to right. Each character is a moment in time. This stream emits `1`, waits, emits `2`, waits, emits `3`, then completes:

```text
source: --1---2---3---|-->
```

An **error** ends the stream just like complete, but signals failure — note that nothing comes after it:

```text
source: --1---2---X-->
```

### Operators Transform Diagrams
The real power: an operator takes an **input** diagram and produces an **output** diagram. This is `map(x => x * 10)`:

```text
source: --1---2---3---|-->
            map(x => x * 10)
output: --10--20--30--|-->
```

And this is `filter(x => x % 2 === 0)`:

```text
source: --1---2---3---4---|-->
            filter(even)
output: ------2-------4---|-->
```

Notice the odd values simply **disappear** from the output line, while the timing of the survivors is preserved.

### Synchronous Emissions
Parentheses group values that fire in the **same frame** — common with `of()`:

```text
of(1, 2, 3): (123)|
```

All three values and the completion happen at frame zero, synchronously.

### Common Mistakes
- **Forgetting the completion bar `|`.** A diagram without `|` (or `X`) implies an *infinite* stream — that is meaningful, not optional.
- **Putting emissions after a `|` or `X`.** Nothing can ever emit after termination; a diagram showing this is simply wrong.
- **Confusing spacing with exact timing.** Dashes represent relative passage of time, not millisecond-accurate intervals (unless you are writing testing marbles in `TestScheduler`).

### Quick Exercise
On paper, draw the output marble diagram for:
```text
source: --1---2---3---4---5---|-->
```
after applying `filter(x => x > 2)` then `map(x => x * 100)`. Check yourself: the first two emissions vanish, and the rest become `300 400 500`.

**Key Takeaway:** Marble diagrams turn invisible, time-based streams into something you can read, draw, and reason about — learn them and every operator becomes obvious.

---

## Lesson 2.3: Schedulers Deep Overview

**Estimated Time:** 25 minutes

### Why This Matters
By default, RxJS decides *when* work happens for you — and usually it gets it right. But for **performance-critical** UIs, **animations**, and **testing**, you sometimes need explicit control over timing and concurrency. That control is a **Scheduler**.

### What Is a Scheduler?
A Scheduler is the component that answers one question: **"when should this work run?"** It controls the execution context (sync vs async) and the clock used for delays. Most operators that involve time accept a scheduler as their last argument.

### The Four Schedulers You Must Know

| Scheduler                   | Executes work...                          | Best for |
|-----------------------------|-------------------------------------------|----------|
| `queueScheduler`            | Synchronously, but queued (avoids recursion) | Recursive/iterative work that must stay sync |
| `asapScheduler`             | As soon as possible — usually before later macrotasks/render work | High-priority async work after the current task |
| `asyncScheduler`            | Asynchronously — macrotask (`setTimeout`) | `delay`, `interval`, `timer`, general async timing |
| `animationFrameScheduler`   | Right before the browser repaints (`requestAnimationFrame`) | Repaint-aligned animations driven by streams |

> The **default** (no scheduler passed) is synchronous for `of`/`from`, and `asyncScheduler` for time operators like `interval` and `timer`.

### Code Example

```ts
import { of, asapScheduler, queueScheduler } from 'rxjs';
import { observeOn } from 'rxjs/operators';

console.log('start');

of('async value')
  .pipe(observeOn(asapScheduler)) // defer emission to a microtask
  .subscribe(v => console.log(v));

console.log('end');

// Output order:
// start
// end
// async value   <-- emitted asynchronously, AFTER synchronous code
```

### subscribeOn vs observeOn
These two operators are frequently confused:

- **`subscribeOn(scheduler)`** controls **when the subscription itself happens** (when the producer starts) — affects the *beginning* of the stream.
- **`observeOn(scheduler)`** controls **when emissions are delivered** to downstream operators and the observer — affects *everything after* it in the pipe.

```text
source: ---a---b---c-->
            observeOn(animationFrameScheduler)
output: ---a---b---c-->   (same values, delivered in sync with repaints)
```

### Common Mistakes
- **Reaching for schedulers too early.** 95% of code never needs an explicit scheduler. Default behavior is correct — only override when you have a measured timing or performance reason.
- **Using `asyncScheduler` for animations.** It rides on `setTimeout`, which is not synced to the display refresh — you get jank. Use `animationFrameScheduler`.
- **Blocking the main thread with `queueScheduler`.** It is still synchronous; a long queued task will freeze the UI just like any sync loop.

### Quick Exercise
Run the code example above and predict the log order *before* running it. Then swap `asapScheduler` for `asyncScheduler` and observe that the relative order does not change — but the *delay class* (microtask vs macrotask) does.

**Key Takeaway:** Schedulers answer "when does this run?" — default behavior is right most of the time, but `animationFrameScheduler` for animation and `asyncScheduler` for timing are the two you will reach for first.

---

## Lesson 2.4: Subscription Lifecycle, Unsubscribe, and Memory Safety

**Estimated Time:** 20 minutes

### Why This Matters
Every `.subscribe()` opens a resource. If you never close it, long-lived streams (timers, DOM events, WebSockets) keep firing — and keep your component, its closures, and its DOM references **alive forever**. This is the #1 source of memory leaks in reactive applications.

### The Lifecycle of a Subscription
```text
subscribe() ──► next ──► next ──► next ──► complete  (auto-cleanup)
                                   └────► error      (auto-cleanup)
                                   └────► unsubscribe (manual cleanup)
```

A subscription ends in exactly one of three ways: it **completes**, it **errors**, or you **unsubscribe**. The first two clean up automatically. The third is your responsibility.

### Four Ways to Manage Cleanup

**1. Manual unsubscribe** (the foundational pattern from Module 01):
```ts
const sub = interval(1000).subscribe(console.log);
// later...
sub.unsubscribe();
```

**2. Composite subscriptions** — group many and tear them all down at once:
```ts
import { Subscription } from 'rxjs';

const subs = new Subscription();
subs.add(stream1$.subscribe(/* ... */));
subs.add(stream2$.subscribe(/* ... */));

// One call cleans up ALL of them:
subs.unsubscribe();
```

**3. `takeUntil(notifier$)`** — the most declarative pattern; let a stream end itself:
```ts
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

const destroy$ = new Subject<void>();

interval(1000)
  .pipe(takeUntil(destroy$))
  .subscribe(console.log);

// Trigger cleanup of every stream piped through takeUntil(destroy$):
destroy$.next();
destroy$.complete();
```

**4. Operators that complete on their own** — `take(n)`, `first()`, `takeWhile(...)` end the stream after a condition, so there is nothing to unsubscribe:
```ts
interval(1000).pipe(take(5)).subscribe(console.log); // completes after 5
```

### Framework Cleanup (Notes)
You rarely call `unsubscribe()` by hand in real apps — frameworks give you hooks:

- **Angular:** call `destroy$.next()` in `ngOnDestroy`, or use the modern `takeUntilDestroyed()`, or the `async` pipe (which subscribes and unsubscribes for you).
- **React:** return a cleanup function from `useEffect` that calls `sub.unsubscribe()`.

> These are mentioned as integration notes — the course demos stay framework-free vanilla TypeScript so the RxJS concepts stay front and center.

### Common Mistakes
- **Subscribing inside a subscribe.** Nesting `.subscribe()` calls leaks inner subscriptions and breaks composition. Use a flattening operator (`switchMap`, `mergeMap`) instead — covered in later modules.
- **Forgetting `destroy$.complete()`.** Calling `.next()` triggers cleanup, but the `Subject` itself should be completed too so *it* does not linger.
- **Assuming `complete` always fires.** Infinite streams (`interval`, `fromEvent`) never complete on their own — without `takeUntil`/`take`/manual unsubscribe, they leak.

### Quick Exercise
Create two `interval(500)` subscriptions, add both to a single `Subscription`, and tear them down together after 3 seconds with one `unsubscribe()` call. Confirm both timers stop.

**Key Takeaway:** Every subscription must end by complete, error, or unsubscribe — for infinite streams, `takeUntil` is the cleanest, most declarative way to guarantee it.

---

## Lesson 2.5: Project Workshop – Interactive Marble Diagram Visualizer

**Estimated Time:** 30 minutes

### Project Goal

Build an interactive tool that **animates a live marble diagram** so you can *see* a stream and watch an operator transform it in real time:

- Emit a source stream of marbles on a timeline using `interval` + `take`
- Apply a selectable operator (`map`, `filter`, or `take`) and render the transformed **result** stream beneath it
- Control emission speed with a slider (a practical tie-in to scheduling and timing)
- Start, stop, and clear the visualization with proper subscription control
- Stop the stream declaratively with `takeUntil` — directly applying Lesson 2.4

This project ties together every concept in the module: the push model (2.1), marble notation (2.2), timing (2.3), and lifecycle/cleanup (2.4).

### Why This Project Matters

Reading static marble diagrams is one thing; *watching* values flow and transform makes the mental model click. This visualizer simulates operator behavior for learning; exact timing assertions still belong in `TestScheduler` tests. Building it also forces you to practice the correct `takeUntil` teardown pattern on an infinite-ish source — exactly the habit that prevents leaks in production.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; two horizontal "tracks" (source and result).
2. **Create the source stream** — `interval(speed)` mapped to `1, 2, 3, …`, limited with `take(total)`.
3. **Stop declaratively** — Pipe through `takeUntil(stop$)` so Stop/Clear end the stream cleanly with no leaks.
4. **Render marbles** — On each emission, append an animated marble to the source track.
5. **Transform** — Apply the chosen operator's logic to drive the result track, and show the equivalent marble notation as a caption.
6. **Polish** — Prevent double-starts, render the completion bar `|`, add a speed slider and reset.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marble Diagram Visualizer • RxJS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
  <style>
    .marble {
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      animation: pop 0.3s ease;
    }
    @keyframes pop {
      0%   { transform: scale(0); opacity: 0; }
      60%  { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }
    .track-line {
      background-image: linear-gradient(to right, #3f3f46 50%, transparent 50%);
      background-size: 16px 2px;
      background-repeat: repeat-x;
      background-position: left center;
    }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">Marble Diagram Visualizer</h1>
        <p class="text-zinc-400 mt-1">Watch a stream transform in real time</p>
      </div>
      <div id="status"
           class="px-4 py-1.5 rounded-full text-sm font-medium bg-zinc-900 border border-zinc-800">
        Idle
      </div>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-3 mb-8">
      <button id="start"
              class="bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-medium py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
        Start
      </button>
      <button id="stop"
              class="bg-zinc-800 hover:bg-zinc-700 transition-colors font-medium py-3 px-6 rounded-xl border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed">
        Stop
      </button>
      <button id="clear"
              class="bg-zinc-900 hover:bg-zinc-800 transition-colors font-medium py-3 px-6 rounded-xl border border-zinc-700">
        Clear
      </button>

      <label class="flex items-center gap-2 ml-auto text-sm text-zinc-400">
        Operator
        <select id="operator"
                class="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200">
          <option value="map">map(x =&gt; x * 10)</option>
          <option value="filter">filter(even)</option>
          <option value="take">take(4)</option>
        </select>
      </label>

      <label class="flex items-center gap-2 text-sm text-zinc-400">
        Speed
        <input id="speed" type="range" min="300" max="1500" value="800" step="100">
      </label>
    </div>

    <!-- Source track -->
    <div class="mb-6">
      <div class="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Source Stream</div>
      <div id="sourceTrack"
           class="track-line flex items-center gap-2 min-h-[64px] bg-zinc-900/40 border border-zinc-800 rounded-2xl px-4">
      </div>
    </div>

    <!-- Result track -->
    <div class="mb-6">
      <div class="text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Result Stream</div>
      <div id="resultTrack"
           class="track-line flex items-center gap-2 min-h-[64px] bg-zinc-900/40 border border-zinc-800 rounded-2xl px-4">
      </div>
    </div>

    <!-- Notation caption -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-mono text-sm text-zinc-400">
      <div id="notation" class="whitespace-pre-line">source: --1--2--3--…</div>
    </div>

    <div class="mt-8 text-xs text-zinc-500 text-center">
      Built with RxJS • Demonstrates marble diagrams, interval/take/map/filter, and takeUntil cleanup
    </div>
  </div>

  <script>
    const { interval, fromEvent, Subject } = rxjs;
    const { map, take, takeUntil, tap } = rxjs.operators;

    // DOM references
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const clearBtn = document.getElementById('clear');
    const sourceTrack = document.getElementById('sourceTrack');
    const resultTrack = document.getElementById('resultTrack');
    const operatorSel = document.getElementById('operator');
    const speedInput = document.getElementById('speed');
    const statusEl = document.getElementById('status');
    const notationEl = document.getElementById('notation');

    const TOTAL = 6; // how many source marbles to emit

    // We use a Subject + takeUntil to stop the stream declaratively (Lesson 2.4).
    let stop$ = null;
    let resultEmitted = 0;

    function setStatus(text, color = 'zinc') {
      statusEl.textContent = text;
      statusEl.className =
        `px-4 py-1.5 rounded-full text-sm font-medium bg-zinc-900 border border-${color}-700 text-${color}-400`;
    }

    function addMarble(track, value, color) {
      const el = document.createElement('div');
      el.className =
        `marble flex items-center justify-center w-12 h-12 rounded-full ` +
        `bg-${color}-600 text-white font-semibold tabular-nums shadow-lg`;
      el.textContent = value;
      track.appendChild(el);
    }

    function addComplete(track) {
      const bar = document.createElement('div');
      bar.className = 'w-1.5 h-10 bg-zinc-300 rounded-sm';
      bar.title = 'complete';
      track.appendChild(bar);
    }

    // Apply the chosen operator's marble semantics to the result track.
    // Conceptually each branch is: result$ = source$.pipe(<operator>)
    function applyOperator(op, value, isLast) {
      if (op === 'map') {
        addMarble(resultTrack, value * 10, 'sky');
        if (isLast) addComplete(resultTrack);
      } else if (op === 'filter') {
        if (value % 2 === 0) addMarble(resultTrack, value, 'sky');
        if (isLast) addComplete(resultTrack);
      } else if (op === 'take') {
        if (resultEmitted < 4) {
          addMarble(resultTrack, value, 'sky');
          resultEmitted++;
          if (resultEmitted === 4) addComplete(resultTrack); // take(4) completes early
        }
      }
    }

    function notationFor(op) {
      switch (op) {
        case 'map':    return 'source: --1--2--3--4--5--6--|\n  map(x => x * 10)\nresult: --10--20--30--40--50--60--|';
        case 'filter': return 'source: --1--2--3--4--5--6--|\n  filter(x => x % 2 === 0)\nresult: -----2-----4-----6--|';
        case 'take':   return 'source: --1--2--3--4--5--6--|\n  take(4)\nresult: --1--2--3--4--|';
      }
    }

    function clearTracks() {
      sourceTrack.innerHTML = '';
      resultTrack.innerHTML = '';
      resultEmitted = 0;
    }

    function stopStream() {
      if (stop$) {
        // Capture and null first: stop$.next() completes the source synchronously
        // (via takeUntil), and that complete handler also clears stop$ — so we must
        // not touch the shared variable again afterward.
        const notifier = stop$;
        stop$ = null;
        notifier.next();      // triggers takeUntil → unsubscribes the source
        notifier.complete();  // complete the notifier itself so it doesn't linger
      }
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }

    // === Start ===
    fromEvent(startBtn, 'click').subscribe(() => {
      if (stop$) return; // prevent double-starts

      clearTracks();
      const op = operatorSel.value;
      const speed = Number(speedInput.value);
      notationEl.textContent = notationFor(op);

      stop$ = new Subject();
      setStatus('Streaming', 'emerald');
      startBtn.disabled = true;
      stopBtn.disabled = false;

      interval(speed).pipe(
        map(i => i + 1),       // 1, 2, 3, ...
        take(TOTAL),           // limit the source to TOTAL marbles
        takeUntil(stop$),      // stop early on demand (Lesson 2.4)
        tap({
          subscribe: () => console.log('%c[RxJS] source subscribed', 'color:#10b981'),
          complete:  () => console.log('%c[RxJS] source completed', 'color:#64748b')
        })
      ).subscribe({
        next: value => {
          const isLast = value === TOTAL;
          addMarble(sourceTrack, value, 'emerald');
          if (isLast) addComplete(sourceTrack);
          applyOperator(op, value, isLast);
        },
        complete: () => {
          setStatus('Completed', 'zinc');
          stop$ = null;
          startBtn.disabled = false;
          stopBtn.disabled = true;
        }
      });
    });

    // === Stop ===
    fromEvent(stopBtn, 'click').subscribe(() => {
      stopStream();
      setStatus('Stopped', 'amber');
    });

    // === Clear ===
    fromEvent(clearBtn, 'click').subscribe(() => {
      stopStream();
      clearTracks();
      notationEl.textContent = notationFor(operatorSel.value);
      setStatus('Cleared — Ready', 'zinc');
    });

    // Initial state
    stopBtn.disabled = true;
    setStatus('Idle', 'zinc');
    notationEl.textContent = notationFor(operatorSel.value);

    // Keyboard support (S = Start, X = Stop, C = Clear)
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 's' && !startBtn.disabled) startBtn.click();
      if (k === 'x' && !stopBtn.disabled) stopBtn.click();
      if (k === 'c') clearBtn.click();
    });
  </script>
</body>
</html>
```

### Important Note on the Development Setup

The single-file HTML approach (with CDN) is excellent for learning and quick demos.  
**For any real application**, use a modern setup:

```bash
npm create vite@latest my-rxjs-project -- --template vanilla-ts
npm install rxjs
```

This gives you full TypeScript support, tree-shaking, and a much better development experience.

### Key Lessons from This Project

- **`takeUntil(stop$)` is the cleanest teardown** — a single `stop$.next()` ends the source with no manual `unsubscribe()` bookkeeping (Lesson 2.4).
- **Operators reshape the marble diagram** — `map` transforms every value, `filter` drops some, `take` ends the stream early. You watched each one happen.
- **`take(n)` completes on its own** — the result track's completion bar appears *before* the source finishes, exactly as the marble notation predicts.
- **Speed is a timing concern** — changing the `interval` period is the everyday version of the scheduling control from Lesson 2.3.
- **UI updates are a side effect at the edge** — the subscription is the boundary where marbles hit the DOM; the stream stays pure.

### Stretch Goals (Recommended Practice)

1. Add a `debounceTime` or `delay` operator option and visualize how it shifts marbles along the timeline.
2. Drive the marble animation with `animationFrameScheduler` and compare smoothness against the default.
3. Add an "error" button that pushes an `X` marble via `throwError`, and render the error termination.
4. Position marbles by *actual elapsed time* (using timestamps) instead of insertion order for a true-to-scale timeline.

### Deliverable

A working visualizer that:
- Animates a source stream of marbles on demand
- Transforms it live with a selectable operator
- Starts, stops, and clears with leak-free `takeUntil` cleanup
- Shows the equivalent marble notation for the chosen operator

**Key Takeaway:** You have built a tool that makes invisible streams visible — and in doing so applied the push model, marble notation, timing, and safe subscription cleanup all at once.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. The Observable is described as the "dual" of which pattern?
   - A) The Singleton pattern
   - B) The Iterator pattern
   - C) The Factory pattern
   - D) The Decorator pattern

2. In a marble diagram, what does the `|` symbol represent?
   - A) An error that terminates the stream
   - B) A value emission
   - C) The `complete` notification
   - D) A paused stream

3. Which scheduler should you use to drive repaint-aligned animation from a stream?
   - A) `asyncScheduler`
   - B) `queueScheduler`
   - C) `asapScheduler`
   - D) `animationFrameScheduler`

4. What is the most declarative way to stop an infinite stream when a component is destroyed?
   - A) Wrap it in a `try/catch`
   - B) Pipe it through `takeUntil(destroy$)` and call `destroy$.next()`
   - C) Set the subscription variable to `null`
   - D) Call `complete()` on the source observable

5. In the Marble Diagram Visualizer project, why does the `take(4)` result track show its completion bar before the source finishes?
   - A) Because `take` errors after 4 values
   - B) Because `take(4)` completes the stream as soon as the 4th value arrives
   - C) Because the source only emits 4 values
   - D) Because `takeUntil` fires automatically

**Correct Answers:** 1-B, 2-C, 3-D, 4-B, 5-B

**Explanations:**
- Q1: The Observer/Observable is the mathematical dual of the Iterator — pull becomes push.
- Q2: `|` marks `complete`; `X` (or `#`) marks `error`; bare values are `next` emissions.
- Q3: `animationFrameScheduler` syncs work to the browser's repaint cycle via `requestAnimationFrame`, the only one suited to smooth animation.
- Q4: `takeUntil(destroy$)` ends the stream declaratively when the notifier emits — no manual subscription bookkeeping.
- Q5: `take(4)` emits up to four values and then **completes immediately**, so the result stream ends earlier than the six-marble source.

---

## Module Summary & Next Steps

You now understand the **core mental models** that the rest of the course builds on:
- The Observer/Iterator duality and why push-based streams compose so well
- How to read, draw, and reason with marble diagrams
- What schedulers do and which to reach for (`asyncScheduler`, `animationFrameScheduler`)
- The subscription lifecycle and leak-free cleanup with `takeUntil`, composite `Subscription`, and self-completing operators

**Next Module:** Module 03 – Pipe Composition (the `pipe()` method, pure vs impure operators, transformation & filtering operators, and refactoring callback hell into clean pipes)

**Recommended Practice:** Rebuild the Marble Diagram Visualizer from memory, then add a fourth operator of your choice and draw its marble diagram *before* you implement it.

---

*Improved Module 02 v2.1 – Part of the RxJS Mastery Professional Course*
