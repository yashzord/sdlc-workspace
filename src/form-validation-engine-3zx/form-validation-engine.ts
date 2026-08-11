export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly code: string,
    public readonly message: string,
    public readonly actionableFix: string,
    public readonly actualValue: unknown
  ) {
    super(`[${field}] ${message} Fix: ${actionableFix}`);
    this.name = 'ValidationError';
  }
}

export type ValidationResult<T> =
  | { success: true; data: T; errors: [] }
  | { success: false; data: T; errors: ValidationError[] };

export type Rule<T> = (value: T, fieldName: string) => ValidationError | null;

export class FieldValidator<T> {
  private rules: Rule<T>[] = [];

  constructor(public readonly fieldName: string) {
    if (!fieldName || typeof fieldName !== 'string') {
      throw new Error('Field name must be a non-empty string.');
    }
  }

  addRule(rule: Rule<T>): this {
    if (typeof rule !== 'function') throw new Error('Rule must be a function.');
    this.rules.push(rule);
    return this;
  }

  validate(value: T): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const rule of this.rules) {
      const error = rule(value, this.fieldName);
      if (error) errors.push(error);
    }
    return errors;
  }
}

export class FormSchema<T extends Record<string, unknown>> {
  constructor(private readonly schema: { [K in keyof T]: FieldValidator<T[K]> }) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a valid object mapping keys to FieldValidators.');
    }
  }

  validate(formData: T): ValidationResult<T> {
    if (!formData || typeof formData !== 'object') {
      throw new Error('Form data must be a valid object.');
    }

    const errors: ValidationError[] = [];
    for (const key of Object.keys(this.schema) as Array<keyof T>) {
      const validator = this.schema[key];
      const fieldErrors = validator.validate(formData[key]);
      errors.push(...fieldErrors);
    }

    if (errors.length > 0) {
      return { success: false, data: formData, errors };
    }
    return { success: true, data: formData, errors: [] };
  }
}

export const Rules = {
  required: (customFix?: string): Rule<unknown> => (val, field) => {
    const isMissing = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
    return isMissing
      ? new ValidationError(field, 'REQUIRED', `${field} is required.`, customFix || 'Provide a non-empty value.', val)
      : null;
  },

  minLength: (min: number): Rule<string> => (val, field) => {
    if (typeof val !== 'string') return null;
    return val.length < min
      ? new ValidationError(field, 'MIN_LENGTH', `${field} is too short.`, `Add ${min - val.length} more character(s).`, val)
      : null;
  },

  email: (): Rule<string> => (val, field) => {
    if (typeof val !== 'string' || !val) return null;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    return !isEmail
      ? new ValidationError(field, 'INVALID_EMAIL', `${field} is not a valid email address.`, 'Use standard name@domain.com format.', val)
      : null;
  },

  and: <T>(...rules: Rule<T>[]): Rule<T> => (val, field) => {
    for (const rule of rules) {
      const err = rule(val, field);
      if (err) return err;
    }
    return null;
  }
};
