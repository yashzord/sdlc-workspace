# Architecture — Composable Form Validation Engine with Actionable Errors

## System Overview

The Composable Form Validation Engine executes synchronous and debounced asynchronous rules against single-field inputs and multi-field form schemas. It processes field updates, evaluates logical rule compositions (`and`, `or`, `not`), tracks cross-field dependencies, and returns structured validation results enriched with actionable quick-fix metadata.

```
[Form Component / Client UI]
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ ValidationEngine (validation-engine.ts)                  │
│  ├── RuleRegistry (Plugin storage for custom rules)      │
│  ├── LogicalComposer (Evaluates AND / OR / NOT chains)   │
│  ├── DependencyGraph (Resolves cross-field evaluation)   │
│  └── AsyncScheduler (Debounces & cancels active jobs)    │
└──────────────────────────────────────────────────────────┘
       │
       ▼
[ValidationResult] ──► { isValid, errors: [ { field, message, quickFix } ] }
```

---

## Module Design

**Module Name:** `validation-engine.ts`

### Public API Surface
*   `createValidationEngine(schema, options?)`: Creates an engine instance initialized with a form schema and configuration (e.g., default debounce ms).
*   `registerRule(name, ruleFn)`: Registers a global, reusable custom rule in the plugin registry.
*   `validateField(field, value, formValues)`: Triggers field-level validation (sync immediately, async debounced).
*   `validateForm(formValues)`: Validates all fields and cross-field rules synchronously, returning a promise that resolves once all async rules settle.
*   `cancelPending(field?)`: Cancels active debounce timers and aborts in-flight async operations for a specific field or the entire form.

### Key Types
```typescript
type QuickFix = {
  label: string;
  action: 'set_value' | 'clear' | 'transform';
  targetField: string;
  newValue?: unknown;
};

type RuleOutcome = {
  valid: boolean;
  message?: string;
  quickFix?: QuickFix;
};

type RuleContext = {
  field: string;
  formValues: Record<string, unknown>;
  signal: AbortSignal;
};

type RuleFn = (value: unknown, context: RuleContext) => RuleOutcome | Promise<RuleOutcome>;
```

---

## Data Model

```typescript
type LogicalOperator = 'and' | 'or' | 'not';

type RuleConfig = 
  | { type: 'rule'; name: string; args?: unknown[]; debounceMs?: number }
  | { type: 'operator'; op: LogicalOperator; rules: RuleConfig[] };

type FieldSchema = {
  rules: RuleConfig;
  dependencies?: string[];
};

type FormSchema = Record<string, FieldSchema>;

type FieldError = {
  field: string;
  message: string;
  quickFix?: QuickFix;
};

type ValidationResult = {
  isValid: boolean;
  errors: FieldError[];
};
```

---

## Key Risks

1.  **Async Race Conditions & Stale Execution**
    *Risk:* In-flight asynchronous validation resolves after user modifies input again, overwriting newer state with stale error output.
    *Mitigation:* Use native `AbortController` bound to field-specific execution slots. Cancel and abort pending requests prior to re-evaluating.

2.  **Circular Cross-Field Dependencies**
    *Risk:* Field A depends on Field B, which depends on Field A, causing infinite evaluation loops during `validateForm`.
    *Mitigation:* Perform cycle detection (Depth-First Search) on field dependency lists during engine instantiation and throw a schema error if a cycle is detected.

3.  **Flaky Vitest Async Tests**
    *Risk:* Real-time `setTimeout` debouncing introduces non-determinism and slow runs in CI.
    *Mitigation:* Accept an optional custom `scheduler` implementation in `createValidationEngine` options, allowing tests to instantly flush debounced queues without standard delays.
