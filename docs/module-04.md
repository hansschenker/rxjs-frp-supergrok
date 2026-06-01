# Module 04: Domain Operators

**RxJS Mastery: Professional Course – Thinking in Streams**

> **Module Version:** 1.0  
> **Last Updated:** June 1, 2026

---

## Module Overview

This module teaches you how to move beyond generic operators and create **domain-specific operators** that speak the language of your business. This is a key skill used by senior engineers to make code more readable, maintainable, and expressive.

**Estimated Total Time:** 110–130 minutes  
**Difficulty:** Intermediate to Advanced  
**Prerequisites:** Modules 01–03 completed

---

## Learning Objectives

By the end of this module you will be able to:

- Apply consistent business domain naming conventions
- Build a reusable domain operator library
- Create custom domain-specific operators
- Compose complex business logic using domain operators
- Deliver a complete Blog Platform operator library

---

## Lesson 4.1: Business Domain Naming Conventions

**Estimated Time:** 18 minutes

### Why Naming Matters
Good naming is one of the most underrated skills in reactive programming. When your operators have clear, business-oriented names, your code becomes self-documenting.

### Recommended Naming Patterns

**Good Examples:**
- `searchUsers$`
- `validateOrder$`
- `enrichWithProfile$`
- `retryWithBackoff$`
- `debounceUserInput$`

**Bad Examples:**
- `map1$`, `filter2$`, `customOp$`

### Best Practices
- Use **domain language** (not technical language)
- End with `$` when returning Observables
- Use verbs that describe the **business action**

### Quick Exercise
Rename these generic operators to domain-specific ones:
- `map(x => x * 1.2)` → `applyTax$`
- `filter(x => x.status === 'active')` → `activeUsersOnly$`

**Key Takeaway:** Great naming turns technical code into business-readable code.

---

## Lesson 4.2: Building a Reusable Domain Operator Library

**Estimated Time:** 22 minutes

### The Power of a Domain Library
Instead of repeating the same operator chains across your application, you should extract them into a shared library.

### Example: User Domain Operators

```ts
// operators/user.operators.ts
import { pipe } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged } from 'rxjs/operators';

export const activeUsersOnly = () => pipe(
  filter((user: User) => user.status === 'active')
);

export const searchUsers = (minLength = 3) => pipe(
  debounceTime(300),
  distinctUntilChanged(),
  filter((term: string) => term.length >= minLength)
);

export const enrichWithProfile = () => pipe(
  mergeMap((user: User) => this.profileService.getProfile(user.id).pipe(
    map(profile => ({ ...user, profile }))
  ))
);
