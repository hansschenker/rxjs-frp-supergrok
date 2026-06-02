# Module 19: Testing

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

Testing is essential for building reliable reactive applications. This module provides a comprehensive guide to testing RxJS code, with a deep focus on **marble diagram testing** using `TestScheduler`. You will learn how to write fast, reliable, and maintainable tests for operators, effects, and complete state management systems. Proper testing is what separates professional reactive code from fragile implementations.

**Estimated Total Time:** 120–140 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 09, 16 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Write marble diagram tests using `TestScheduler`
- Test custom operators thoroughly
- Test effects and side effects
- Test complete state management systems
- Build a comprehensive testing suite for an operator library

---

## Lesson 19.1: Marble Diagram Testing Fundamentals

**Estimated Time:** 22 minutes

### Why Marble Testing?
Marble tests let you assert **time-based** behavior **synchronously** — a 10-second debounce verifies instantly, deterministically, and reads like the diagram it tests.

### Basic Marble Test Structure

```ts
import { TestScheduler } from 'rxjs/testing';
import { map } from 'rxjs/operators';

describe('map operator', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);   // the framework's deep-equal
    });
  });

  it('doubles each value', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const source$  = cold('-a-b-c-|', { a: 1, b: 2, c: 3 });
      const expected =      '-a-b-c-|';
      expectObservable(source$.pipe(map(x => x * 2)))
        .toBe(expected, { a: 2, b: 4, c: 6 });
    });
  });
});
```

> Note the output keeps the **same timing** as the input (`map` is synchronous), only the *values* change. A common mistake is shifting the output marbles when the operator doesn't add delay.

### Marble Syntax (recap)
- `-` one frame of virtual time · letters = `next` · `|` = complete · `#` = error
- `(abc)` synchronous group · `^` subscription point (hot) · spaces are ignored (alignment only)

### Common Mistake
**Misaligned marbles.** The expected diagram's emission positions must match the operator's actual timing. For a synchronous operator, the output aligns with the input; only time operators shift it.

### Quick Exercise
Write a marble test asserting `filter(x => x % 2 === 0)` over `cold('-a-b-c-d-|', {a:1,b:2,c:3,d:4})` yields `'---b---d-|'` with `{b:2, d:4}`.

**Key Takeaway:** Marble tests assert time-based behavior synchronously via `TestScheduler`; keep the expected timing aligned with the operator's actual timing (only time operators shift the marbles).

---

## Lesson 19.2: Deep Dive into TestScheduler for Virtual Time

**Estimated Time:** 24 minutes

### The `run` Helpers
Inside `scheduler.run(helpers => { ... })` you get:
- `cold(marble, values?, error?)` — a cold Observable; subscription starts when you subscribe.
- `hot(marble, values?, error?)` — already running; `^` marks subscription start.
- `expectObservable(obs, subscription?)` — assert emissions.
- `expectSubscriptions(subs)` — assert *when* subscriptions open/close.

### Cold vs Hot in Tests
```ts
scheduler.run(({ hot, expectObservable }) => {
  const source$ = hot('--a--b--c--|'); // values before ^ are missed by the subscriber
  const sub =         '---^--------!'; // subscribe at frame 3, unsubscribe at the end
  expectObservable(source$, sub).toBe('-----b--c--|');
});
```

### Testing Time Operators
```ts
scheduler.run(({ cold, expectObservable }) => {
  const source$ = cold('a 9ms b 9ms c|');          // time progression syntax
  expectObservable(source$.pipe(debounceTime(5)))
    .toBe('5ms a 9ms b 5ms (c|)');
});
```

The `<n>ms` / `<n>s` syntax advances virtual time precisely — no real waiting.

### Asserting Subscriptions
`expectSubscriptions` proves an operator subscribes/unsubscribes when it should — critical for `switchMap` (cancels previous) or `shareReplay` (refCount):

```ts
const sub1 = '^------!';   // first inner subscribed then unsubscribed
expectSubscriptions(source$.subscriptions).toBe(sub1);
```

### Common Mistake
**Real async inside `run`.** Promises/`setTimeout` don't obey virtual time and will desync the test. Keep the body purely RxJS; pass the test scheduler to time operators that accept one.

### Quick Exercise
Use `hot` with a `^` subscription point to prove a subscriber misses values emitted before it subscribed.

**Key Takeaway:** `TestScheduler.run` gives `cold`/`hot`/`expectObservable`/`expectSubscriptions`; use `<n>ms` timing and subscription assertions to verify exact timing and (un)subscription behavior in virtual time.

---

## Lesson 19.3: Unit Testing Operators, Effects, and State Streams

**Estimated Time:** 24 minutes

### Operators — Value Logic with `toArray`
For non-timing logic, collect output and assert (no scheduler needed):

```ts
it('dedupeById removes duplicates', (done) => {
  of({ id: 1 }, { id: 2 }, { id: 1 }).pipe(dedupeById(), toArray())
    .subscribe(r => { expect(r.map(x => x.id)).toEqual([1, 2]); done(); });
});
```

### Reducers — Pure Functions, Trivial Tests
Reducers (Module 10) are pure, so test them directly — no RxJS at all:

```ts
expect(reducer({ count: 0 }, { type: 'INCREMENT' })).toEqual({ count: 1 });
```

### State Streams — Dispatch and Assert
Drive actions through the store and assert the emitted states with marbles or `toArray`:

```ts
scheduler.run(({ expectObservable }) => {
  const actions = cold('-i-i-|', { i: { type: 'INCREMENT' } });
  const state$ = actions.pipe(scan(reducer, { count: 0 }));
  expectObservable(state$).toBe('-a-b-|', { a: { count: 1 }, b: { count: 2 } });
});
```

### Effects (Side Effects) — Mock the Boundary
Effects do async work; inject a **mock** dependency so the test is deterministic:

```ts
it('search effect dispatches RESULTS', (done) => {
  const api = { search: () => of(['x']) };          // mock
  searchEffect(actions$, api).subscribe(action => {
    expect(action).toEqual({ type: 'RESULTS', results: ['x'] });
    done();
  });
  actions$.next({ type: 'SEARCH', q: 'a' });
});
```

> Test effects by **controlling their inputs** (mock the API/clock) and asserting the **actions they dispatch** — never hit a real network in a unit test.

### Property-Based Testing (Intro)
Beyond hand-picked cases, **property-based** tests (e.g. `fast-check`) generate many random inputs and assert invariants — great for operators:

```ts
import * as fc from 'fast-check';
fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
  // invariant: map(identity) preserves the input
  let out: number[] = [];
  from(arr).pipe(map(x => x)).subscribe(v => out.push(v));
  return JSON.stringify(out) === JSON.stringify(arr);
}));
```

### Common Mistake
**Testing effects against the real network.** It's slow, flaky, and non-deterministic. Inject a mock and assert the dispatched actions.

### Quick Exercise
Write three tests for a counter store: reducer purity, a `toArray` state-sequence test, and an effect test with a mocked API.

**Key Takeaway:** Test operators with `toArray`, reducers as pure functions, state streams by dispatching actions, and effects by mocking their dependencies and asserting dispatched actions; add property-based tests for invariants.

---

## Lesson 19.4: Integration & E2E Testing Strategies

**Estimated Time:** 18 minutes

### The Testing Pyramid for Reactive Apps
- **Unit** (many) — operators, reducers, effects in isolation (Lesson 19.3).
- **Integration** (some) — a facade/feature with a mocked data layer: dispatch through the real store + effects, assert the `viewModel$`.
- **E2E** (few) — the running app in a browser (Playwright/Cypress), asserting user-visible behavior.

### Integration Testing a Facade
Because the data layer is swappable (Module 17), inject a mock API and test the whole feature's observable behavior:

```ts
const facade = new UsersFacade(mockApi);
facade.search('ada');
facade.viewModel$.pipe(skipWhile(vm => vm.loading), take(1))
  .subscribe(vm => expect(vm.users).toHaveLength(1));
```

### E2E with Virtual-Time Caveats
E2E uses **real** time, so debounces/animations actually elapse. Prefer asserting *outcomes* (the result appears) over exact timing, and use the framework's auto-waiting.

### Testing Side Effects at the Edge
DOM updates, storage, analytics — assert their *effect* (the DOM changed, `localStorage` was written) rather than the stream internals, in integration tests.

### Common Mistake
**Only writing E2E tests.** They're slow and brittle. Push logic into unit-testable operators/reducers (the pyramid's base) and keep E2E for a few critical user journeys.

### Quick Exercise
Outline three tests for a search feature: a unit test (the debounce pipeline), an integration test (facade + mock API), and an E2E test (type → results appear).

**Key Takeaway:** Follow the pyramid — many unit tests, some integration tests (facade + mock data), few E2E; assert outcomes (not timing) in E2E and side effects at the edge.

---

## Lesson 19.5: Project Workshop – Complete Library Testing Suite (In-Browser Runner)

**Estimated Time:** 30 minutes

### Project Goal

Build a **runnable, in-browser marble-test runner** that tests a small operator library with `TestScheduler` and shows pass/fail live:

- A tiny test harness wrapping `TestScheduler` with a deep-equal assertion
- Marble tests for `map`, `filter`, `scan`, and a time operator (`delay`)
- A green/red results panel with expected-vs-actual on failure
- One intentionally failing test, to prove the runner really checks

### Why This Project Matters

Tests usually run in a terminal; here you *watch them run*. Seeing `TestScheduler` flush virtual time and report green (and catch a deliberate red) makes marble testing concrete — and the harness is the real thing, not a toy.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN (the UMD bundle includes `rxjs.testing`).
2. **Harness** — `runTest(name, body)` creates a `TestScheduler` whose assert compares actual vs expected (deep-equal) and records pass/fail.
3. **Tests** — define marble tests for several operators.
4. **Run & render** — run all on click; show a summary and per-test results.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marble Test Runner • RxJS TestScheduler</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <div class="flex items-center justify-between mb-6">
      <div><h1 class="text-3xl font-semibold tracking-tight">Marble Test Runner</h1>
        <p class="text-zinc-400 mt-1">Real <code class="text-emerald-400">TestScheduler</code> tests, in the browser</p></div>
      <button id="run" class="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 rounded-xl">Run Tests</button>
    </div>
    <div id="summary" class="text-sm text-zinc-400 mb-4"></div>
    <div id="results" class="space-y-2"></div>
  </div>

  <script>
    const { map, filter, scan, delay } = rxjs.operators;
    const { TestScheduler } = rxjs.testing;

    // Deep-equal good enough for marble notification frames
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // Test harness: build a TestScheduler whose assertion records pass/fail
    function runTest(name, body) {
      let pass = true, detail = '';
      const scheduler = new TestScheduler((actual, expected) => {
        if (!eq(actual, expected)) {
          pass = false;
          detail = `expected ${JSON.stringify(expected)}\n got      ${JSON.stringify(actual)}`;
        }
      });
      try {
        scheduler.run(helpers => body(helpers));
      } catch (e) {
        pass = false; detail = String(e && e.message || e);
      }
      return { name, pass, detail };
    }

    // ===== The test suite =====
    const SUITE = [
      ['map doubles values', ({ cold, expectObservable }) => {
        const s = cold('-a-b-c-|', { a: 1, b: 2, c: 3 });
        expectObservable(s.pipe(map(x => x * 2))).toBe('-a-b-c-|', { a: 2, b: 4, c: 6 });
      }],
      ['filter keeps evens', ({ cold, expectObservable }) => {
        const s = cold('-a-b-c-d-|', { a: 1, b: 2, c: 3, d: 4 });
        expectObservable(s.pipe(filter(x => x % 2 === 0))).toBe('---b---d-|', { b: 2, d: 4 });
      }],
      ['scan accumulates a running total', ({ cold, expectObservable }) => {
        const s = cold('-a-b-c-|', { a: 1, b: 2, c: 3 });
        expectObservable(s.pipe(scan((acc, x) => acc + x, 0))).toBe('-a-b-c-|', { a: 1, b: 3, c: 6 });
      }],
      ['delay shifts every emission (and completion) by 3 frames', ({ cold, expectObservable }) => {
        const s = cold('-a-|', { a: 1 });
        // delay(3) moves a from frame 1→4 and complete from frame 3→6
        expectObservable(s.pipe(delay(3))).toBe('----a-|', { a: 1 });
      }],
      ['INTENTIONAL FAIL (wrong expected values)', ({ cold, expectObservable }) => {
        const s = cold('-a-|', { a: 1 });
        expectObservable(s.pipe(map(x => x + 1))).toBe('-a-|', { a: 999 }); // should be 2
      }],
    ];

    function render(results) {
      const passed = results.filter(r => r.pass).length;
      document.getElementById('summary').innerHTML =
        `<span class="font-semibold ${passed === results.length ? 'text-emerald-400' : 'text-amber-400'}">${passed}/${results.length} passed</span>`;
      document.getElementById('results').innerHTML = results.map(r => `
        <div class="rounded-xl px-4 py-3 border ${r.pass ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-red-500/10 border-red-500/40'}">
          <div class="flex items-center gap-2">
            <span class="${r.pass ? 'text-emerald-400' : 'text-red-400'} font-bold">${r.pass ? '✓' : '✗'}</span>
            <span>${r.name}</span>
          </div>
          ${r.detail ? `<pre class="text-xs text-red-300/80 mt-2 whitespace-pre-wrap">${r.detail}</pre>` : ''}
        </div>`).join('');
    }

    document.getElementById('run').addEventListener('click', () => {
      render(SUITE.map(([name, body]) => runTest(name, body)));
    });
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **`TestScheduler` runs in the browser too** — the same harness your CI uses, flushing virtual time instantly.
- **The assertion is the gate** — the scheduler calls your `(actual, expected)` function at flush; comparing them is what makes a test pass or fail.
- **Marble values carry the data** — the value object (`{ a: 2, b: 4 }`) maps marble letters to emissions; timing and values are asserted together.
- **The intentional failure proves it works** — a green-only runner could be a no-op; the red test confirms real checking.

### Stretch Goals (Recommended Practice)

1. Add `expectSubscriptions` tests proving `switchMap` unsubscribes the previous inner.
2. Add a custom-operator test (`dedupeById`) using `toArray` instead of marbles.
3. Add a property-based check (bundle `fast-check`) asserting `map(identity)` preserves input.
4. Make the suite editable in a textarea and `eval` it (sandbox caveats noted) for a live playground.

### Deliverable

A runnable in-browser test runner executing real `TestScheduler` marble tests for `map`/`filter`/`scan`/`delay`, with a pass/fail panel and a deliberate failing test proving the harness checks correctly.

**Key Takeaway:** You built a working `TestScheduler` harness and a marble-test suite — the exact mechanism behind professional RxJS test suites, made visible in the browser.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is the main benefit of marble testing with `TestScheduler`?
   - A) It runs time-based behavior synchronously in virtual time, deterministically
   - B) It tests the UI's CSS
   - C) It replaces the need for assertions
   - D) It only works in the browser

2. For a synchronous operator like `map`, how should the expected marble timing compare to the input?
   - A) Shifted later by one frame
   - B) Compressed to half the frames
   - C) Aligned with the input (same timing, different values)
   - D) Always `(abc)` grouped

3. How should you unit-test an **effect** that calls an API?
   - A) Hit the real API and hope it's up
   - B) Inject a mock dependency and assert the actions it dispatches
   - C) Only test it end-to-end
   - D) Skip testing effects

4. Which `TestScheduler` helper proves an operator subscribes/unsubscribes at the right time?
   - A) `expectObservable`
   - B) `cold`
   - C) `toArray`
   - D) `expectSubscriptions`

5. In the testing pyramid for reactive apps, which kind of test should be the most numerous?
   - A) End-to-end (E2E)
   - B) Manual tests
   - C) Unit tests (operators, reducers, effects in isolation)
   - D) Visual regression tests

**Correct Answers:** 1-A, 2-C, 3-B, 4-D, 5-C

**Explanations:**
- Q1: `TestScheduler` runs virtual time, so time-based operators are tested instantly and deterministically.
- Q2: `map` adds no delay, so the expected diagram keeps the input's timing and only changes the values.
- Q3: Inject a mock API/clock and assert the dispatched actions — unit tests must be deterministic and offline.
- Q4: `expectSubscriptions` asserts when subscriptions open and close (e.g. `switchMap` cancelling the previous inner).
- Q5: Unit tests form the broad base of the pyramid; integration and E2E are progressively fewer.

---

## Module Summary & Next Steps

You can now test reactive code thoroughly:
- Marble testing fundamentals and the `TestScheduler.run` helpers (`cold`/`hot`/`expectObservable`/`expectSubscriptions`)
- Unit testing operators (`toArray`), reducers (pure), state streams (dispatch + assert), and effects (mock + assert actions); plus property-based testing
- The testing pyramid: many unit, some integration (facade + mock data), few E2E
- A runnable in-browser marble-test runner — the real harness, made visible

**Next Module:** Module 20 – Capstone (migration strategies, the future of reactive programming, and a full collaborative real-time dashboard integrating everything)

**Recommended Practice:** Extend the runner with `expectSubscriptions` and a `toArray` custom-operator test, then add a property-based check with `fast-check`.

---

*Improved Module 19 v2.0 – Part of the RxJS Mastery Professional Course*
