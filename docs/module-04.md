# Module 04: Domain Operators

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module teaches you how to move beyond generic operators and create **domain-specific operators** that speak the language of your business. This is a key skill used by senior engineers to make code more readable, maintainable, and expressive.

You will learn to name, build, type, compose, and test custom operators, then assemble them into a small reusable library.

**Estimated Total Time:** 110–130 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 01–03 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Apply consistent business domain naming conventions
- Build a reusable domain operator library with a clean public API
- Create and correctly type custom domain-specific operators
- Compose complex business logic from small, single-purpose operators
- Unit test custom operators
- Deliver a complete Blog Platform operator library

---

## Lesson 4.1: Business Domain Naming Conventions

**Estimated Time:** 18 minutes

### Why Naming Matters
Good naming is one of the most underrated skills in reactive programming. When your operators have clear, business-oriented names, your code becomes self-documenting. A reviewer should understand *what* a pipeline does without decoding *how*.

### Recommended Naming Patterns

**Good Examples:**
- `searchUsers$`
- `validateOrder()`
- `enrichWithProfile()`
- `retryWithBackoff()`
- `debounceUserInput()`

**Bad Examples:**
- `map1$`, `filter2$`, `customOp$`

### Mental Model
> A generic operator (`filter`, `map`) describes a **mechanism**. A domain operator (`activeUsersOnly`, `applyTax`) describes an **intention**. You build the second on top of the first.

### Best Practices
- Use **domain language** (not technical language)
- End a stream variable with `$` when it holds an Observable (`users$`); name operator *factories* as verbs (`activeUsersOnly()`)
- Use verbs that describe the **business action**

### Common Mistake
**Naming after the operators used instead of the result.** `debouncedDistinctFiltered$` leaks implementation; `searchQuery$` describes intent. If you rewrite the internals, an intent-based name still fits — a mechanism-based name lies.

### Quick Exercise
Rename these generic operators to domain-specific ones:
- `map(x => x * 1.2)` → `applyTax()`
- `filter(x => x.status === 'active')` → `activeUsersOnly()`

**Key Takeaway:** Great naming turns technical code into business-readable code — name the intention, not the mechanism.

---

## Lesson 4.2: Building a Reusable Domain Operator Library

**Estimated Time:** 22 minutes

### The Power of a Domain Library
Instead of repeating the same operator chains across your application, extract them into a shared library. The key tool is the **operator factory**: a function that returns a pipeable operator built with `pipe()`.

### The Operator Factory Pattern

```ts
// operators/user.operators.ts
import { pipe } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { User, Profile } from '../models';

// Pure, parameterless: keep only active users
export const activeUsersOnly = () => pipe(
  filter((user: User) => user.status === 'active')
);

// Parameterized: a reusable search-input transform
export const searchTerms = (minLength = 3) => pipe(
  debounceTime(300),
  distinctUntilChanged(),
  filter((term: string) => term.length >= minLength)
);

// Dependency passed in (NOT `this`) so the operator stays portable & testable.
// Note: mergeMap is a flattening operator — covered fully in Module 05.
export const enrichWithProfile = (getProfile: (id: string) => Observable<Profile>) => pipe(
  mergeMap((user: User) =>
    getProfile(user.id).pipe(map(profile => ({ ...user, profile })))
  )
);
```

> Each factory returns a value you can drop straight into any `.pipe(...)`. Because the dependency in `enrichWithProfile` is a parameter (not `this.profileService`), the operator has no hidden coupling — you can reuse and unit-test it anywhere.

### The Barrel File (Public API)
Expose your library through a single `index.ts` barrel so consumers import from one place:

```ts
// operators/index.ts
export * from './user.operators';
export * from './order.operators';
export * from './search.operators';
```

```ts
// Consumer code — clean, one import, business-readable
import { activeUsersOnly, enrichWithProfile } from '@/operators';

users$.pipe(
  activeUsersOnly(),
  enrichWithProfile(profileApi.getProfile)
).subscribe(render);
```

### Suggested Folder Structure

```text
src/
  operators/
    index.ts            <- barrel (public API)
    user.operators.ts
    order.operators.ts
    search.operators.ts
    operators.spec.ts   <- tests (Lesson 4.3)
  models/
    index.ts
```

### Common Mistake
**Referencing `this` inside an exported operator factory.** Standalone exported arrow functions have no meaningful `this`. Pass collaborators (services, fetchers) as parameters instead — it keeps the operator pure and testable.

### Quick Exercise
Create an `order.operators.ts` with `paidOrdersOnly()` (`filter(o => o.paid)`) and `applyDiscount(rate: number)` (`map(o => ({ ...o, total: o.total * (1 - rate) }))`), then export both through the barrel.

**Key Takeaway:** Operator factories + a barrel file turn scattered operator chains into a clean, importable domain library.

---

## Lesson 4.3: Creating Custom Domain-Specific Operators (search$, validate$)

**Estimated Time:** 24 minutes

### Two Ways to Build a Custom Operator
1. **Compose existing operators with `pipe()`** — 95% of the time. Readable and safe.
2. **Write a raw operator** — a function `source => new Observable(...)` — only when no combination of existing operators expresses your logic.

### 1. Composed Operator — `validateOrder`

```ts
import { pipe } from 'rxjs';
import { map, filter, tap } from 'rxjs/operators';

export const validateOrder = () => pipe(
  filter((order: Order) => order.items.length > 0),         // must have items
  filter((order: Order) => order.total > 0),                // must cost something
  tap((order: Order) => console.debug('valid order', order.id))
);
```

### Typing Custom Operators Correctly
RxJS gives you two precise types:

- **`MonoTypeOperatorFunction<T>`** — input and output are the same type (e.g. `filter`, `tap`, `debounceTime`).
- **`OperatorFunction<T, R>`** — the type changes (e.g. `map`).

```ts
import { OperatorFunction, MonoTypeOperatorFunction } from 'rxjs';
import { filter, map } from 'rxjs/operators';

// Same type in and out → MonoType
export function activeOnly<T extends { status: string }>(): MonoTypeOperatorFunction<T> {
  return filter((item: T) => item.status === 'active');
}

// Type changes (T → string) → OperatorFunction<T, string>
export function namesOf<T extends { name: string }>(): OperatorFunction<T, string> {
  return map((item: T) => item.name);
}
```

### 2. Raw Operator (Advanced) — When `pipe()` Isn't Enough
A pipeable operator is *just* a function from `Observable<T>` to `Observable<R>`. Writing one by hand makes that concrete — note the explicit teardown:

```ts
import { Observable, OperatorFunction } from 'rxjs';

export function doubleEvens(): OperatorFunction<number, number> {
  return (source: Observable<number>) =>
    new Observable<number>(subscriber => {
      const sub = source.subscribe({
        next: n => { if (n % 2 === 0) subscriber.next(n * 2); },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete()
      });
      return () => sub.unsubscribe();   // teardown — prevents leaks (Module 02)
    });
}
```

> Prefer the composed form. Reach for the raw form only for genuinely novel behavior — and always return the teardown function.

### Testing Custom Operators
Custom operators are plain functions, so they are easy to test. For **value logic**, emit known input and collect the output with `toArray`:

```ts
import { of } from 'rxjs';
import { toArray } from 'rxjs/operators';

it('activeOnly keeps only active items', (done) => {
  const items = [
    { status: 'active' }, { status: 'inactive' }, { status: 'active' }
  ];
  of(...items).pipe(activeOnly(), toArray()).subscribe(result => {
    expect(result.length).toBe(2);
    done();
  });
});
```

For **time-based** operators (`debounceTime`, `delay`), use RxJS's `TestScheduler` with marble syntax so virtual time runs instantly:

```ts
import { TestScheduler } from 'rxjs/testing';

const scheduler = new TestScheduler((actual, expected) => {
  expect(actual).toEqual(expected);
});

scheduler.run(({ cold, expectObservable }) => {
  const source$ = cold('--a--b--|');
  const expected =     '--a--b--|';
  expectObservable(source$.pipe(activeOnly())).toBe(expected);
});
```

### Common Mistake
**Forgetting teardown in a raw operator.** If you subscribe to `source` but never return an unsubscribe function, you leak the inner subscription every time someone unsubscribes from yours.

### Quick Exercise
Write and type a `minLength(n: number): MonoTypeOperatorFunction<string>` operator using `filter`, then test it with `of('a', 'abc', 'abcd').pipe(minLength(3), toArray())`.

**Key Takeaway:** Compose custom operators from existing ones and type them with `OperatorFunction`/`MonoTypeOperatorFunction`; drop to a raw `Observable` only when nothing else fits — and always tear down.

---

## Lesson 4.4: Composing Domain Operators for Complex Business Logic

**Estimated Time:** 22 minutes

### Small Operators, Big Logic
The real payoff arrives when you compose small, single-purpose operators into higher-level ones that encode an entire business rule — readable top to bottom.

```ts
import { pipe } from 'rxjs';

// Small building blocks (each does ONE thing)
const paidOrdersOnly   = () => pipe(filter((o: Order) => o.paid));
const inRegion         = (region: string) => pipe(filter((o: Order) => o.region === region));
const applyLoyalty     = () => pipe(map((o: Order) => ({ ...o, total: o.total * 0.95 })));

// A composed business rule, expressed as one domain operator
export const eligibleEuropeanOrders = () => pipe(
  paidOrdersOnly(),
  inRegion('EU'),
  applyLoyalty()
);

orders$.pipe(eligibleEuropeanOrders()).subscribe(fulfil);
```

### Why This Scales
- **Single responsibility** — each small operator is trivial to read and test.
- **Reusable** — `paidOrdersOnly()` appears in many rules; write it once.
- **Refactor-safe** — change a rule's internals without touching call sites.

### A Search Operator, Visualized
Domain operators often wrap timing behavior. A `searchQuery()` operator collapses bursts of typing into a single clean query:

```text
keystrokes: --r-e-a-c-------react--|
                searchQuery()  (debounce + distinct)
queries:    ----------react-------- (one emission after the pause)
```

### Real-World Note
Large product teams (streaming services, booking platforms, marketplaces) maintain shared operator libraries exactly like this: a `recommendations.operators.ts`, a `pricing.operators.ts`, and so on. New features compose existing domain operators instead of re-deriving low-level chains — which is how a big codebase stays readable.

### Common Mistake
**Building one giant operator instead of composing small ones.** A 40-line custom operator that filters, maps, validates, and enriches is impossible to test or reuse. Break it into named pieces and compose them.

### Quick Exercise
Compose `publishedOnly()`, `taggedWith(tag)`, and `mostRecentFirst()` into a single `featuredPosts(tag)` domain operator. (You will use exactly this idea in the project.)

**Key Takeaway:** Build complex business logic by composing small, named, single-purpose operators — not by writing one monolith.

---

## Lesson 4.5: Project Workshop – Blog Platform Library: Domain Operators in Action

**Estimated Time:** 30 minutes

### Project Goal

Build a small **Blog Platform** that filters and enriches posts entirely through a library of composable **domain operators** — so the data pipeline reads like a product spec:

```ts
from(POSTS).pipe(
  publishedOnly(),
  taggedWith(criteria.tag),
  matchingSearch(criteria.search),
  withReadingTime()
)
// …then sort by date for display (a sort needs the full list — see the build below)
```

- Define each domain operator as a small factory built on `map`/`filter`
- Drive them from a live search box and a tag filter
- Render enriched posts (with a derived reading-time badge)
- Keep every operator pure and single-purpose

### Why This Project Matters

This is the module's thesis made runnable: the *consumer* code names business intentions, and the operator *library* hides the mechanics. Adding a rule later (e.g. `authoredBy(user)`) is a one-line change at the call site.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; a search input, a tag `<select>`, and a results list.
2. **Define the library** — `publishedOnly`, `taggedWith`, `matchingSearch`, `withReadingTime`, `mostRecentFirst` as operator factories.
3. **Capture criteria** — `merge` the input and select streams into a single criteria stream (debounced).
4. **Run the pipeline** — for each criteria change, push `from(POSTS)` through the composed domain operators and `toArray()`.
5. **Render** — the one side effect, at the edge.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Platform • RxJS Domain Operators</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-2xl mx-auto p-8">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold tracking-tight">Blog Platform</h1>
      <p class="text-zinc-400 mt-1">Filtering posts through a domain operator library</p>
    </div>

    <!-- Controls -->
    <div class="flex flex-wrap gap-3 mb-3">
      <input id="search" type="text" autocomplete="off"
             placeholder="Search posts…"
             class="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 focus:border-emerald-500
                    outline-none rounded-xl px-4 py-3 placeholder-zinc-600">
      <select id="tag"
              class="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-3 text-zinc-200">
        <option value="">All tags</option>
        <option value="rxjs">rxjs</option>
        <option value="angular">angular</option>
        <option value="testing">testing</option>
        <option value="career">career</option>
      </select>
    </div>
    <div id="status" class="text-xs text-zinc-500 mb-4 h-4"></div>

    <ul id="results" class="space-y-2"></ul>
  </div>

  <script>
    const { from, fromEvent, merge } = rxjs;
    const { map, filter, debounceTime, startWith, toArray } = rxjs.operators;

    // --- Mock data ---
    const POSTS = [
      { id: 1, title: 'Thinking in Streams',        tags: ['rxjs'],            published: true,  words: 1200, date: '2026-05-20' },
      { id: 2, title: 'Testing RxJS with Marbles',  tags: ['rxjs','testing'],  published: true,  words: 900,  date: '2026-05-28' },
      { id: 3, title: 'Angular Signals vs RxJS',    tags: ['angular','rxjs'],  published: true,  words: 1600, date: '2026-06-01' },
      { id: 4, title: 'Draft: Backpressure Notes',  tags: ['rxjs'],            published: false, words: 400,  date: '2026-05-30' },
      { id: 5, title: 'Breaking Into Senior Roles', tags: ['career'],          published: true,  words: 2200, date: '2026-04-15' },
      { id: 6, title: 'Unit Testing Custom Operators', tags: ['testing'],      published: true,  words: 750,  date: '2026-05-10' }
    ];

    // === Domain Operator Library ===
    // Each factory returns a pipeable operator built from generic operators.
    const publishedOnly   = () => filter(p => p.published);
    const taggedWith      = (tag) => filter(p => !tag || p.tags.includes(tag));
    const matchingSearch  = (term) => filter(p =>
      term === '' || p.title.toLowerCase().includes(term)
    );
    const withReadingTime = () => map(p => ({ ...p, readingTime: Math.max(1, Math.round(p.words / 200)) }));

    // Sorting needs the WHOLE list, so it runs after toArray() — not as an in-stream operator.
    const sortRecent = (posts) => [...posts].sort((a, b) => b.date.localeCompare(a.date));

    // --- DOM ---
    const searchInput = document.getElementById('search');
    const tagSelect = document.getElementById('tag');
    const resultsEl = document.getElementById('results');
    const statusEl = document.getElementById('status');

    function renderPosts(posts) {
      statusEl.textContent = `${posts.length} post${posts.length === 1 ? '' : 's'}`;
      if (posts.length === 0) {
        resultsEl.innerHTML = `<li class="text-zinc-500 px-1">No posts match your filters.</li>`;
        return;
      }
      resultsEl.innerHTML = posts.map(p => `
        <li class="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div class="font-medium text-zinc-100">${p.title}</div>
            <div class="text-xs text-zinc-500 mt-0.5">
              ${p.tags.map(t => `<span class="text-emerald-400">#${t}</span>`).join(' ')} · ${p.date}
            </div>
          </div>
          <span class="shrink-0 text-xs bg-zinc-800 border border-zinc-700 rounded-full px-2 py-1">
            ${p.readingTime} min read
          </span>
        </li>`).join('');
    }

    // Run the composed domain pipeline for a given criteria object.
    function runPipeline(criteria) {
      from(POSTS).pipe(
        publishedOnly(),
        taggedWith(criteria.tag),
        matchingSearch(criteria.search),
        withReadingTime(),
        toArray()                       // collect survivors into an array
      ).subscribe(posts => renderPosts(sortRecent(posts)));  // sort needs the full list
    }

    // === Reactive criteria stream ===
    // merge both control streams into one; flattening and combination patterns continue in Modules 05-06.
    const search$ = fromEvent(searchInput, 'input');
    const tag$ = fromEvent(tagSelect, 'change');

    merge(search$, tag$).pipe(
      startWith(null),                  // run once on load
      debounceTime(120),
      map(() => ({
        search: searchInput.value.trim().toLowerCase(),
        tag: tagSelect.value
      }))
    ).subscribe(runPipeline);
  </script>
</body>
</html>
```

### Important Note on Async Data

Our `POSTS` are local, so `from(POSTS)` completes immediately and `toArray()` is perfect. With a **real API**, `withReadingTime` might call a service per post — that is where `mergeMap`/`switchMap` from Module 05 and the custom flattening patterns from Module 06 come in. The domain-operator *structure* stays identical; only the inner data source changes.

### Key Lessons from This Project

- **The pipeline reads like a spec** — `publishedOnly()`, `taggedWith()`, `matchingSearch()` describe intent, not mechanism.
- **Small operators compose** — each factory is one `filter`/`map`; together they express the whole feature.
- **Library vs consumer split** — mechanics live in the factories; call sites stay business-readable.
- **Know where order matters** — sorting needs the full array, so it runs after `toArray()`, not as an in-stream operator.

### Stretch Goals (Recommended Practice)

1. Add an `authoredBy(author)` operator and an author filter control.
2. Extract the operators into real files (`blog.operators.ts` + barrel `index.ts`) and add Jest tests with `toArray`.
3. Add a `minReadingTime(mins)` operator and a slider control.
4. Replace `sortRecent` with a proper `mostRecentFirst()` that uses `toArray()` internally + `map(sort)` so the sort lives in the library too.

### Deliverable

A working blog filter whose data pipeline is composed entirely of named domain operators, driven by a debounced search + tag stream, rendering enriched posts.

**Key Takeaway:** You built a domain operator library and consumed it in a pipeline that reads like business language — the senior-engineer skill this module is all about.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. What is the primary benefit of a domain-specific operator like `activeUsersOnly()` over a raw `filter(...)`?
   - A) It expresses business intent and is reusable/self-documenting
   - B) It runs faster
   - C) It avoids the need to subscribe
   - D) It automatically handles errors

2. What is an "operator factory" in RxJS?
   - A) A class that extends Observable
   - B) A function that returns a pipeable operator (often built with `pipe()`)
   - C) A built-in RxJS service
   - D) A way to create Observables from promises

3. Which type should you use for a custom operator whose input and output types are the **same**?
   - A) `OperatorFunction<T, R>`
   - B) `Observable<T>`
   - C) `MonoTypeOperatorFunction<T>`
   - D) `Subject<T>`

4. Why should an operator factory receive its dependencies (e.g. a fetch function) as **parameters** instead of using `this`?
   - A) `this` is faster
   - B) RxJS forbids `this` in operators
   - C) It enables tree-shaking
   - D) Standalone exported functions have no meaningful `this`; parameters keep the operator pure and testable

5. In the Blog Platform project, why is sorting done **after** `toArray()` rather than as an in-stream operator?
   - A) Because `toArray` sorts automatically
   - B) Because `map` cannot sort
   - C) Because sorting needs the complete list of values, which only exists once the stream has collected them
   - D) Because the stream never completes

**Correct Answers:** 1-A, 2-B, 3-C, 4-D, 5-C

**Explanations:**
- Q1: Domain operators name the intention, are reusable across the app, and make pipelines self-documenting.
- Q2: An operator factory is a function returning a pipeable operator, usually composed with `pipe()`.
- Q3: `MonoTypeOperatorFunction<T>` is for same-type-in/out operators (`filter`, `tap`); `OperatorFunction<T, R>` is for type-changing ones (`map`).
- Q4: Exported arrow functions have no useful `this`; passing dependencies in removes hidden coupling and makes the operator testable.
- Q5: A sort needs every item at once; in a stream that set only exists after `toArray()` collects all emissions on completion.

---

## Module Summary & Next Steps

You can now build operators that speak your business's language:
- Naming conventions that express intent, not mechanism
- Operator factories and a barrel-file library API
- Creating and correctly typing custom operators (`OperatorFunction` / `MonoTypeOperatorFunction`), including the raw `Observable` form with teardown
- Composing small operators into complex business rules
- Unit testing custom operators with `toArray` and the `TestScheduler`

**Next Module:** Module 05 – Flattening Operators (higher-order Observables and `mergeMap`, `switchMap`, `concatMap`, `exhaustMap` — the operators that power real async data)

**Recommended Practice:** Take the Blog Platform operators, move them into their own files with a barrel export, and write one `toArray`-based test per operator.

---

*Improved Module 04 v2.0 – Part of the RxJS Mastery Professional Course*
