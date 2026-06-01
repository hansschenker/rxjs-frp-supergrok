# Module 05: Flattening Operators

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module focuses on one of the most important and commonly misunderstood topics in RxJS: **Higher-Order Observables** and **Flattening Operators**. Mastering these operators will allow you to handle complex asynchronous workflows (like nested API calls, search with suggestions, and real-time updates) elegantly and safely.

**Estimated Total Time:** 130–150 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 01–04 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Understand Higher-Order Observables
- Confidently choose between `switchMap`, `concatMap`, `mergeMap`, and `exhaustMap`
- Handle complex nested async operations
- Build real-world applications like GitHub Search with autocomplete
- Avoid common pitfalls that cause bugs and memory leaks

---

## Lesson 5.1: Higher-Order Observables Explained

**Estimated Time:** 22 minutes

### What is a Higher-Order Observable?
A Higher-Order Observable is an Observable that emits **other Observables**.

```ts
const higherOrder$ = source$.pipe(
  map(value => interval(1000))   // returns an Observable
);
