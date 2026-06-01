# Module 02: Core Concepts

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 2.0 (Improved)  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module takes you deeper into the **foundational mental models** that make RxJS so powerful and intuitive. You will understand the mathematical duality behind Observables, become fluent in marble diagrams, master schedulers for precise timing control, and build a real interactive visualization tool.

**Estimated Total Time:** 120–140 minutes (video + exercises)  
**Difficulty:** Beginner to Intermediate  
**Prerequisites:** Module 01 (Foundations) completed

---

## Learning Objectives

By the end of this module you will be able to:

- Clearly explain the Observer vs Iterator duality
- Read, draw, and reason with marble diagrams fluently
- Choose the correct scheduler for any performance or timing requirement
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
