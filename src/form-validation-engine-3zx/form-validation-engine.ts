export interface ActionableError {
  field: string;
  code: string;
  message: string;
  suggestion: string;
}

export class FormValidationError extends Error {
  constructor(public readonly errors: ActionableError[]) {
    super(`Validation failed with ${errors.length} error(s): ${errors.map(e => e.message).join('; ')}`);
    this.name = 'FormValidationError';
  }
}

export type ValidationRule<T> = (value: T, field: string) => ActionableError | null;

export class FieldValidator<T> {
  private rules: ValidationRule<T>[] = [];

  constructor(public readonly fieldName: string) {
    if (!fieldName || typeof fieldName !== 'string') {
      throw new Error('Field name must be a non-empty string.');
    }
  }

  addRule(rule: ValidationRule<T>): this {
    if (typeof rule !== 'function') {
      throw new Error('Validation rule must be a function.');
    }
    this.rules.push(rule);
    return this;
  }

  validate(value: T): ActionableError[] {
    const errors: ActionableError[] = [];
    for (const rule of this.rules) {
      const error = rule(value, this.fieldName);
      if (error) errors.push(error);
    }
    return errors;
  }
}

export const Rules = {
  required: <T>(suggestion = 'Please provide a non-empty value.'): ValidationRule<T> =>
    (val, field) => {
      const isEmpty = val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
      return isEmpty
        ? { field, code: 'REQUIRED', message: `${field} is required.`, suggestion }
        : null;
    },

  minLength: (min: number, suggestion?: string): ValidationRule<string> =>
    (val, field) => {
      if (typeof val !== 'string') return null;
      return val.length < min
        ? {
            field,
            code: 'MIN_LENGTH',
            message: `${field} must be at least ${min} characters long.`,
            suggestion: suggestion || `Add at least ${min - val.length} more character(s).`
          }
        : null;
    },

  pattern: (regex: RegExp, message: string, suggestion: string): ValidationRule<string> =>
    (val, field) => {
      if (typeof val !== 'string' || !val) return null;
      return !regex.test(val)
        ? { field, code: 'PATTERN_MISMATCH', message, suggestion }
        : null;
    },

  allOf: <T>(...rules: ValidationRule<T>[]): ValidationRule<T> =>
    (val, field) => {
      for (const rule of rules) {
        const error = rule(val, field);
        if (error) return error;
      }
      return null;
    }
};

export class FormSchema<T extends Record<string, any>> {
  private schema = new Map<keyof T & string, FieldValidator<any>>();

  field<K extends keyof T & string>(name: K, build: (v: FieldValidator<T[K]>) => void): this {
    const validator = new FieldValidator<T[K]>(name);
    build(validator);
    this.schema.set(name, validator);
    return this;
  }

  validate(data: T): { valid: true; data: T } | { valid: false; errors: ActionableError[] } {
    if (!data || typeof data !== 'object') {
      throw new Error('Data payload must be a non-null object.');
    }
    const errors: ActionableError[] = [];
    for (const [field, validator] of this.schema.entries()) {
      const fieldErrors = validator.validate(data[field]);
      errors.push(...fieldErrors);
    }
    return errors.length > 0 ? { valid: false, errors } : { valid: true, data };
  }

  validateOrThrow(data: T): T {
    const result = this.validate(data);
    if (!result.valid) {
      throw new FormValidationError(result.errors);
    }
    return result.data;
  }
}
