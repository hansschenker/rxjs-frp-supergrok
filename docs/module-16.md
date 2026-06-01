# Module 16: Custom Operators Mastery

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0  
> **Last Updated:** June 2026

---

## Module Overview

This module teaches you how to create **powerful, reusable, and type-safe custom operators**. Mastering custom operators is what separates intermediate RxJS developers from experts. You will learn how to build stateful operators, properly type them with TypeScript, and create a complete operator library for e-commerce applications.

> Module 04 introduced domain operators and basic typing; this module goes deep on **stateful** operators, advanced typing, testing, and publishing.

**Estimated Total Time:** 120–140 minutes  
**Difficulty:** Advanced  
**Prerequisites:** Modules 04, 06 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Create stateful custom operators
- Properly type custom operators with TypeScript
- Build and test operator libraries
- Design operators following RxJS best practices
- Deliver a complete e-commerce operator library

---

## Lesson 16.1: Building Stateful Custom Operators

**Estimated Time:** 22 minutes

### What Makes an Operator Stateful?
Stateful operators maintain internal state between emissions (counters, accumulators, caches). The cardinal rule: **state must live per-subscription**, created fresh each time someone subscribes — never in shared module scope.

### The Per-Subscription Rule
```ts
import { Observable, OperatorFunction } from 'rxjs';

// ✅ State created INSIDE the returned Observable → fresh per subscription
export function runningAverage(): OperatorFunction<number, number> {
  return source => new Observable<number>(subscriber => {
    let sum = 0, count = 0;                 // per-subscription state
    return source.subscribe({
      next: v => { sum += v; count++; subscriber.next(sum / count); },
      error: e => subscriber.error(e),
      complete: () => subscriber.complete(),
    });
  });
}
```

```ts
// ❌ State in shared scope → leaks across subscriptions, corrupts results
let sum = 0, count = 0;                      // BUG: shared by everyone
export const brokenAverage = () => map((v: number) => { sum += v; count++; return sum / count; });
```

### Prefer Composition (scan) When You Can
Most stateful operators are cleaner built from `scan`, which gives per-subscription state for free:

```ts
import { scan, map } from 'rxjs/operators';

export const runningAverage2 = () => (source: Observable<number>) =>
  source.pipe(
    scan((acc, v) => ({ sum: acc.sum + v, count: acc.count + 1 }), { sum: 0, count: 0 }),
    map(acc => acc.sum / acc.count)
  );
```

### Example: Detecting Repeats
```ts
export function distinctUntilChangedWithCount<T>(): OperatorFunction<T, { value: T; runLength: number }> {
  return source => source.pipe(
    scan((acc, value) =>
      value === acc.value ? { value, runLength: acc.runLength + 1 } : { value, runLength: 1 },
      { value: undefined as T, runLength: 0 }),
    map(({ value, runLength }) => ({ value, runLength }))
  );
}
```

### Common Mistake
**Putting state outside the Observable factory.** Module-level `let` is shared across every subscription — two components using your operator will corrupt each other's state. Always create state inside the returned `new Observable(...)` (or use `scan`).

### Quick Exercise
Write a stateful `runningMax()` operator (emits the maximum seen so far) two ways: with `scan`, and with a raw `new Observable`. Verify two subscriptions don't interfere.

**Key Takeaway:** Stateful operators must create state **per-subscription** — inside the returned Observable (or via `scan`) — never in shared module scope.

---

## Lesson 16.2: TypeScript Type-Safety for Custom Operators

**Estimated Time:** 22 minutes

### The Two Core Types (recap + depth)
- `MonoTypeOperatorFunction<T>` — input and output the same type.
- `OperatorFunction<T, R>` — type changes from `T` to `R`.

### Generic Operators
Make operators reusable across types with generics and constraints:

```ts
import { OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';

// Works for any object with an `id` — constrained generic
export function dedupeById<T extends { id: string | number }>(): OperatorFunction<T, T> {
  return source => new Observable<T>(sub => {
    const seen = new Set<T['id']>();             // per-subscription
    return source.subscribe({
      next: v => { if (!seen.has(v.id)) { seen.add(v.id); sub.next(v); } },
      error: e => sub.error(e), complete: () => sub.complete(),
    });
  });
}
```

### Typing State Transitions
When the output type differs from the input, `OperatorFunction<T, R>` documents the transformation precisely:

```ts
export function withIndex<T>(): OperatorFunction<T, { index: number; value: T }> {
  return source => source.pipe(
    scan((acc, value) => ({ index: acc.index + 1, value }), { index: -1, value: undefined as T })
  );
}
```

### Overloads for Optional Behavior
Like the built-ins, you can overload signatures so types narrow based on arguments (e.g. a `pluckSafe` returning `R | undefined` vs `R` with a default). Keep overloads minimal — clarity beats cleverness.

### Avoid `any`
`any` defeats the purpose. If a type is truly unknown, use `unknown` and narrow with a type guard — your operator's consumers get real safety.

### Common Mistake
**Returning `OperatorFunction<T, any>`.** It compiles but erases all downstream type info, so the rest of the pipe loses inference. Type the real output (`OperatorFunction<T, R>`).

### Quick Exercise
Type a `pairsOf<T>(): OperatorFunction<T, [T, T]>` operator (emits consecutive pairs) using `pairwise`, and confirm the tuple type flows downstream.

**Key Takeaway:** Use `MonoTypeOperatorFunction<T>`/`OperatorFunction<T, R>` with generics + constraints, type state transitions precisely, and never fall back to `any` (use `unknown` + guards).

---

## Lesson 16.3: Testing and Documenting Custom Operators

**Estimated Time:** 24 minutes

### Value Tests with `toArray`
For value logic, feed known input and assert the collected output:

```ts
import { of } from 'rxjs';
import { toArray } from 'rxjs/operators';

it('dedupeById removes duplicate ids', (done) => {
  of({ id: 1 }, { id: 2 }, { id: 1 }).pipe(dedupeById(), toArray())
    .subscribe(r => { expect(r.map(x => x.id)).toEqual([1, 2]); done(); });
});
```

### Marble Tests for Timing
For time-based operators, the `TestScheduler` (Module 09) asserts exact timing instantly:

```ts
scheduler.run(({ cold, expectObservable }) => {
  const src = cold('-a-b-a-|', { a: { id: 1 }, b: { id: 2 } });
  expectObservable(src.pipe(dedupeById())).toBe('-a-b---|', { a: { id: 1 }, b: { id: 2 } });
});
```

### Edge Cases to Always Cover
- **Empty source** (`EMPTY`) — does it complete cleanly with no emissions?
- **Single value** — boundary of any accumulation.
- **Immediate error** — does the operator propagate `error` and tear down?
- **Unsubscription mid-stream** — does it clean up inner state/subscriptions (no leak)?
- **Per-subscription isolation** — subscribe twice; confirm independent state.

### Documenting Operators
Good operator docs include: a one-line purpose, a **marble diagram** in the JSDoc, parameter meanings, and a usage example.

```ts
/**
 * Emits each value with a running 1-based index.
 *
 * ```text
 * --a----b----c-->
 *      withIndex()
 * --{0,a}-{1,b}-{2,c}-->
 * ```
 * @example source$.pipe(withIndex()).subscribe(({ index, value }) => ...)
 */
```

### Common Mistake
**Only testing the happy path.** Custom operators break on empty/error/unsubscribe far more than on normal values. Test the edges — that's where stateful operators leak or miscount.

### Quick Exercise
Write three tests for `runningAverage()`: a normal sequence, the empty source, and per-subscription isolation (two subscribers don't share `sum`).

**Key Takeaway:** Test operators with `toArray` (values) and `TestScheduler` (timing), always cover empty/single/error/unsubscribe/isolation edges, and document with a marble diagram in JSDoc.

---

## Lesson 16.4: Publishing and Sharing Operator Libraries

**Estimated Time:** 18 minutes

### Package Structure
A shareable operator library is a small npm package:

```text
my-rx-operators/
  src/
    index.ts            <- barrel: export * from each operator
    running-average.ts
    dedupe-by-id.ts
  package.json
  tsconfig.json
  README.md
```

### package.json Essentials
- **`peerDependencies`**: `{ "rxjs": "^7.0.0" }` — depend on the *consumer's* RxJS, never bundle your own (two RxJS copies break `instanceof`/operators).
- **`sideEffects: false`** — tells bundlers your modules are tree-shakeable, so consumers only ship the operators they import.
- **`exports`/`module`/`types`** — ship ESM + type declarations for proper inference and tree-shaking.

### Tree-Shakeable Exports
Export each operator from its own file via a barrel. Consumers `import { runningAverage } from 'my-rx-operators'` and bundlers drop the rest. Avoid a giant single-object default export — it defeats tree-shaking.

### Versioning & Compatibility
RxJS makes breaking changes across majors (e.g. `retryWhen` deprecation, v7→v8). State your supported RxJS range in `peerDependencies` and test against it. Use semver: a breaking operator change is a major bump.

### Common Mistake
**Listing `rxjs` as a regular `dependency`.** That bundles a second RxJS copy into the consumer's app — duplicate operators, broken `instanceof`, bloat. It must be a `peerDependency`.

### Quick Exercise
Write a `package.json` for an operator library with `peerDependencies` on rxjs 7, `sideEffects: false`, and a barrel `index.ts` exporting two operators.

**Key Takeaway:** Ship operators as a tree-shakeable library — `peerDependencies` on rxjs (never a direct dep), `sideEffects: false`, per-operator files behind a barrel, ESM + types.

---

## Lesson 16.5: Project Workshop – Enterprise E-commerce Operator Library

**Estimated Time:** 30 minutes

### Project Goal

Build a **composable e-commerce operator library** and use it in a live cart, so the checkout pipeline reads like a spec:

```ts
cart$.pipe(cartSubtotal(), applyCoupon(COUPONS), withTax(0.08), cartTotal())
```

- Small, single-purpose, **composable** operators (subtotal → coupon → tax → total)
- A **stateful** operator (`recentlyViewed`) tracking the last N products viewed
- A live cart UI: add/remove items, apply a coupon, see totals update reactively

### Why This Project Matters

You will see the Module 04 lesson at full strength: the *consumer* code names business steps, the *library* hides the math, and the operators **compose** in a readable order. Swapping the tax rate or coupon logic touches one operator, not the call site.

### Step-by-Step Build (Video-Friendly)

1. **Setup** — Single HTML file with Tailwind + RxJS 7 from CDN; a product list and a cart panel.
2. **Library** — `cartSubtotal`, `applyCoupon(table)`, `withTax(rate)`, `cartTotal` as `map`-based operator factories; `recentlyViewed(max)` as a stateful `scan` operator.
3. **State** — `items$` and `coupon$` BehaviorSubjects; `combineLatest` into a base cart.
4. **Pipeline** — run the cart through the composed operators.
5. **Render** — products, recently-viewed, and the itemized totals.

### Complete Working Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-commerce Operator Library • RxJS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/rxjs@7/dist/bundles/rxjs.umd.min.js"></script>
</head>
<body class="bg-zinc-950 text-zinc-200">
  <div class="max-w-3xl mx-auto p-8 grid md:grid-cols-2 gap-6">
    <!-- Products -->
    <div>
      <h1 class="text-2xl font-semibold tracking-tight mb-3">Products</h1>
      <div id="products" class="space-y-2"></div>
      <div class="mt-4 text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Recently viewed</div>
      <div id="recent" class="flex flex-wrap gap-1 text-xs text-zinc-400"></div>
    </div>

    <!-- Cart -->
    <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <h2 class="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-3">Cart</h2>
      <div id="cartItems" class="space-y-2 mb-3 min-h-[60px]"></div>
      <input id="coupon" placeholder="Coupon: SAVE10 / HALF" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm mb-3 placeholder-zinc-600">
      <div id="totals" class="text-sm space-y-1 border-t border-zinc-800 pt-3"></div>
    </div>
  </div>

  <script>
    const { BehaviorSubject, Subject, combineLatest } = rxjs;
    const { map, scan, startWith } = rxjs.operators;

    const CATALOG = [
      { id: 'p1', name: 'Reactive Mug', price: 12 },
      { id: 'p2', name: 'Stream T-Shirt', price: 25 },
      { id: 'p3', name: 'Observable Hoodie', price: 48 },
      { id: 'p4', name: 'Marble Stickers', price: 6 },
    ];
    const COUPONS = { SAVE10: { rate: 0.10 }, HALF: { rate: 0.50 } };

    // ===== The operator library (each a small, composable factory) =====
    const cartSubtotal = () => map(c => ({ ...c, subtotal: c.items.reduce((s, i) => s + i.price * i.qty, 0) }));
    const applyCoupon  = (table) => map(c => {
      const entry = table[(c.coupon || '').toUpperCase()];
      return { ...c, discount: entry ? c.subtotal * entry.rate : 0, couponValid: !!entry };
    });
    const withTax = (rate) => map(c => ({ ...c, tax: (c.subtotal - c.discount) * rate }));
    const cartTotal = () => map(c => ({ ...c, total: c.subtotal - c.discount + c.tax }));

    // A STATEFUL operator (per-subscription scan): last `max` distinct viewed ids
    const recentlyViewed = (max) => (source) => source.pipe(
      scan((list, id) => [id, ...list.filter(x => x !== id)].slice(0, max), [])
    );

    // ===== State =====
    const items$ = new BehaviorSubject([]);          // [{id,name,price,qty}]
    const coupon$ = new BehaviorSubject('');
    const viewed$ = new Subject();

    const addItem = product => {
      const items = items$.value.slice();
      const found = items.find(i => i.id === product.id);
      if (found) found.qty++; else items.push({ ...product, qty: 1 });
      items$.next(items);
    };
    const removeItem = id => items$.next(items$.value.filter(i => i.id !== id));

    // ===== The checkout pipeline — reads like a spec =====
    combineLatest([items$, coupon$]).pipe(
      map(([items, coupon]) => ({ items, coupon })),
      cartSubtotal(),
      applyCoupon(COUPONS),
      withTax(0.08),
      cartTotal()
    ).subscribe(renderCart);

    // Recently-viewed stateful pipeline
    viewed$.pipe(recentlyViewed(4), startWith([])).subscribe(ids => {
      document.getElementById('recent').innerHTML = ids.length
        ? ids.map(id => `<span class="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">${CATALOG.find(p => p.id === id).name}</span>`).join('')
        : '<span class="text-zinc-600">none yet</span>';
    });

    // ===== Rendering =====
    document.getElementById('products').innerHTML = CATALOG.map(p => `
      <div class="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
        <button data-view="${p.id}" class="text-left">
          <div class="font-medium">${p.name}</div><div class="text-xs text-zinc-500">$${p.price}</div>
        </button>
        <button data-add="${p.id}" class="bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg px-3 py-1.5">Add</button>
      </div>`).join('');

    function renderCart(cart) {
      document.getElementById('cartItems').innerHTML = cart.items.length
        ? cart.items.map(i => `
          <div class="flex items-center justify-between text-sm">
            <span>${i.name} <span class="text-zinc-500">×${i.qty}</span></span>
            <span class="flex items-center gap-2"><span class="tabular-nums">$${(i.price*i.qty).toFixed(2)}</span>
            <button data-remove="${i.id}" class="text-zinc-600 hover:text-red-400">✕</button></span>
          </div>`).join('')
        : '<div class="text-zinc-600 text-sm">Cart is empty.</div>';

      const row = (label, val, cls = '') => `<div class="flex justify-between ${cls}"><span class="text-zinc-400">${label}</span><span class="tabular-nums">${val}</span></div>`;
      document.getElementById('totals').innerHTML =
        row('Subtotal', '$' + cart.subtotal.toFixed(2)) +
        (cart.discount > 0 ? row('Discount', '−$' + cart.discount.toFixed(2), 'text-emerald-400') : '') +
        (cart.coupon && !cart.couponValid ? row('Coupon', 'invalid', 'text-red-400') : '') +
        row('Tax (8%)', '$' + cart.tax.toFixed(2)) +
        row('Total', '$' + cart.total.toFixed(2), 'font-semibold text-base border-t border-zinc-800 pt-1 mt-1');
    }

    // ===== Wiring =====
    document.getElementById('products').addEventListener('click', e => {
      const add = e.target.closest('[data-add]'); const view = e.target.closest('[data-view]');
      if (add) addItem(CATALOG.find(p => p.id === add.dataset.add));
      if (view) viewed$.next(view.dataset.view);
    });
    document.getElementById('cartItems').addEventListener('click', e => {
      const rm = e.target.closest('[data-remove]'); if (rm) removeItem(rm.dataset.remove);
    });
    document.getElementById('coupon').addEventListener('input', e => coupon$.next(e.target.value));
  </script>
</body>
</html>
```

### Key Lessons from This Project

- **Composable operators read like a spec** — `cartSubtotal() → applyCoupon() → withTax() → cartTotal()` is the checkout, in order.
- **Each operator is one `map`** — single-purpose, independently testable, reusable.
- **`recentlyViewed` shows safe stateful design** — `scan` gives per-subscription state; no shared module variable.
- **`combineLatest` joins state slices** — items and coupon flow into one cart object the operators refine.

### Stretch Goals (Recommended Practice)

1. Add a `freeShippingOver(threshold)` operator and a shipping line.
2. Extract the library into files + a barrel and write `toArray` tests for each operator (Lesson 16.3).
3. Add a stateful `quantityCap(max)` operator that clamps total quantity.
4. Micro-benchmark composed operators vs one inline `map` over 100k items in the console.

### Deliverable

A live cart powered by a composable e-commerce operator library (subtotal/coupon/tax/total) plus a stateful recently-viewed operator — the checkout pipeline reading as business language.

**Key Takeaway:** You built and consumed an operator library where small, type-safe, composable operators express business logic — the expert-level RxJS skill of designing for reuse.

---

## End-of-Module Quiz

**5 Multiple Choice Questions**

1. Where must a stateful custom operator keep its state?
   - A) Per-subscription, inside the returned Observable (or via `scan`)
   - B) In module-level (shared) variables
   - C) In `localStorage`
   - D) In a global `window` property

2. What's the risk of declaring operator state in shared module scope?
   - A) It runs slower
   - B) TypeScript won't compile it
   - C) State leaks across subscriptions, so independent consumers corrupt each other
   - D) Nothing — it's the recommended approach

3. Which type best describes an operator that changes the value type from `T` to `R`?
   - A) `MonoTypeOperatorFunction<T>`
   - B) `Observable<T>`
   - C) `Subject<R>`
   - D) `OperatorFunction<T, R>`

4. In a publishable operator library, how should `rxjs` be declared in `package.json`?
   - A) As a regular `dependency`
   - B) As a `peerDependency` (so the consumer's RxJS is used)
   - C) As a `devDependency` only
   - D) Bundled directly into the package

5. In the e-commerce project, why is the checkout built from several small operators instead of one big `map`?
   - A) It runs faster
   - B) RxJS requires multiple operators
   - C) Small operators are single-purpose, testable, reusable, and compose into a readable spec
   - D) To use more memory

**Correct Answers:** 1-A, 2-C, 3-D, 4-B, 5-C

**Explanations:**
- Q1: State must be created per-subscription (inside the returned Observable, or via `scan`) so each subscriber is independent.
- Q2: Shared module-scope state is reused by every subscription, so two consumers corrupt each other's counters/caches.
- Q3: `OperatorFunction<T, R>` expresses a type change; `MonoTypeOperatorFunction<T>` is for same-type-in/out.
- Q4: `rxjs` belongs in `peerDependencies` so the consumer's single RxJS instance is used — a direct dependency bundles a duplicate copy.
- Q5: Small composable operators are each single-purpose and testable, and reading them in order describes the checkout.

---

## Module Summary & Next Steps

You can now author operators like a library maintainer:
- Stateful operators with **per-subscription** state (raw `Observable` or `scan`)
- Type-safety with generics, `OperatorFunction`/`MonoTypeOperatorFunction`, and no `any`
- Testing (`toArray` + `TestScheduler`) across empty/error/unsubscribe/isolation edges, documented with marble JSDoc
- Publishing a tree-shakeable library (`peerDependencies`, `sideEffects: false`, barrel exports)

**Next Module:** Module 17 – Architecture Patterns (feature-based reactive architecture, RxJS + Signals hybrids, layered design, and refactoring legacy code)

**Recommended Practice:** Extract the e-commerce operators into a real package layout with a barrel and `toArray` tests, then add a `freeShippingOver` operator.

---

*Improved Module 16 v2.0 – Part of the RxJS Mastery Professional Course*
