export interface RuleIssue {
  code: string;
  message: string;
  fixHint: string;
}

export class FormValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly code: string,
    public readonly message: string,
    public readonly fixHint: string
  ) {
    super(`[${code}] ${field}: ${message} (Fix: ${fixHint})`);
    this.name = 'FormValidationError';
  }
}

export type ValidationRule<T> = (
  value: T,
  formData?: Record<string, unknown>
) => RuleIssue | null;

export interface ValidationSummary<T> {
  isValid: boolean;
  values: T;
  errors: Partial<Record<keyof T, FormValidationError[]>>;
}

export const createRule = <T>(
  predicate: (value: T, formData?: Record<string, unknown>) => boolean,
  issue: RuleIssue
): ValidationRule<T> => {
  return (value, formData) => (predicate(value, formData) ? null : issue);
};

export const Rules = {
  required: (fixHint = 'Please enter a value'): ValidationRule<unknown> =>
    createRule(
      (val) => val !== undefined && val !== null && val !== '',
      { code: 'ERR_REQUIRED', message: 'This field is required', fixHint }
    ),

  minLength: (min: number, fixHint?: string): ValidationRule<string> =>
    createRule(
      (val) => typeof val !== 'string' || val.length >= min,
      {
        code: 'ERR_MIN_LENGTH',
        message: `Value must be at least ${min} characters long`,
        fixHint: fixHint ?? `Add more characters to reach minimum length of ${min}`
      }
    ),

  pattern: (regex: RegExp, message: string, fixHint: string): ValidationRule<string> =>
    createRule(
      (val) => typeof val !== 'string' || val.length === 0 || regex.test(val),
      { code: 'ERR_PATTERN', message, fixHint }
    ),

  custom: <T>(
    validator: (val: T, formData?: Record<string, unknown>) => boolean,
    code: string,
    message: string,
    fixHint: string
  ): ValidationRule<T> => createRule(validator, { code, message, fixHint })
};

export class FormValidator<T extends Record<string, unknown>> {
  private rulesMap = new Map<keyof T, ValidationRule<unknown>[]>();

  public addRule<K extends keyof T>(field: K, ...rules: ValidationRule<T[K]>[]): this {
    if (!field || (typeof field !== 'string' && typeof field !== 'symbol')) {
      throw new TypeError('Field name must be a valid string or symbol key.');
    }
    if (rules.length === 0) {
      throw new Error('At least one rule must be provided when calling addRule.');
    }
    const existing = this.rulesMap.get(field) ?? [];
    this.rulesMap.set(field, [...existing, ...(rules as ValidationRule<unknown>[])]);
    return this;
  }

  public validate(data: T): ValidationSummary<T> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('Validation payload must be a non-null object.');
    }

    const errors: Partial<Record<keyof T, FormValidationError[]>> = {};
    let isValid = true;

    for (const [field, rules] of this.rulesMap.entries()) {
      const value = data[field];
      const fieldErrors: FormValidationError[] = [];

      for (const rule of rules) {
        const issue = rule(value, data);
        if (issue) {
          fieldErrors.push(
            new FormValidationError(String(field), issue.code, issue.message, issue.fixHint)
          );
        }
      }

      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors;
        isValid = false;
      }
    }

    return { isValid, values: data, errors };
  }
}
