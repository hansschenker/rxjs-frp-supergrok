# Module 03: Pipe Composition

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module teaches you the **heart of RxJS power**: the `pipe()` method and operator composition. You will learn how to build clean, declarative, and highly reusable data transformation pipelines — the skill that separates beginners from professionals.

**Estimated Total Time:** 100–120 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Module 01 & 02 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Master the `pipe()` method and operator chaining
- Understand the difference between pure and impure operators
- Build complex transformation pipelines
- Refactor real-world code using clean pipe composition
- Create reusable, testable operator chains

---

## Lesson 3.1: The pipe() Method and Declarative Operator Chaining

**Estimated Time:** 18 minutes

### Why pipe() Matters
Before `pipe()`, operators were called as methods on the Observable. The `pipe()` method (introduced in RxJS 6) brings several major benefits:
- Better tree-shaking
- Cleaner code
- Easier to read and maintain
- Consistent with functional programming style

### Basic Syntax

```ts
source$.pipe(
  operator1(),
  operator2(),
  operator3()
).subscribe(...)
