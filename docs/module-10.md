# Module 10: State Management Basics

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

State management is one of the most important topics in modern frontend development. This module teaches you how to build predictable, scalable state management systems using RxJS. You will learn the **BehaviorSubject pattern** and the powerful **scan + reducer pattern**, which forms the foundation of many production state management solutions (including NgRx and custom implementations).

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
- Mutable state leads to bugs
- Difficult to track state changes over time
- Hard to implement features like Undo/Redo and Time Travel

### Why RxJS is Perfect for State
- **Observable streams** naturally represent state over time
- **Immutable updates** with `scan` + reducer
- **Powerful composition** with operators
- **Built-in reactivity** — UI automatically updates when state changes

**Key Takeaway:** RxJS brings functional programming principles to state management.

---

## Lesson 10.2: BehaviorSubject Pattern for Simple State

**Estimated Time:** 22 minutes

### What is BehaviorSubject?
`BehaviorSubject` is a special type of Subject that:
- Requires an initial value
- Always emits the current value to new subscribers
- Perfect for representing current state

### Basic Example

```ts
import { BehaviorSubject } from 'rxjs';

const count$ = new BehaviorSubject<number>(0);

// Subscribe
count$.subscribe(count => console.log('Current count:', count));

// Update state
count$.next(1);
count$.next(2);
