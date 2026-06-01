# Module 16: Custom Operators Mastery

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module teaches you how to create **powerful, reusable, and type-safe custom operators**. Mastering custom operators is what separates intermediate RxJS developers from experts. You will learn how to build stateful operators, properly type them with TypeScript, and create a complete operator library for e-commerce applications.

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
Stateful operators maintain internal state between emissions (e.g., counters, accumulators, caches).

### Example: `distinctUntilChangedWithCount`

```ts
import { OperatorFunction } from 'rxjs';
import { scan, map, filter } from 'rxjs/operators';

export function distinctUntilChangedWithCount<T>(): OperatorFunction<T, { value: T; count: number }> {
  return (source) =>
    source.pipe(
      scan((acc, value) => {
        if (value === acc.lastValue) {
          return { ...acc, count: acc.count + 1 };
        } else {
          return { lastValue: value, count: 0 };
        }
      }, { lastValue: undefined as T, count: 0 }),
      filter(acc => acc.count === 1), // Only emit on first occurrence
      map(acc => ({ value: acc.lastValue, count: acc.count }))
    );
}
