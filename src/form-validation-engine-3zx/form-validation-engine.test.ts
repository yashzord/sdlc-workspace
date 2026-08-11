import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  FieldValidator,
  FormSchema,
  Rules
} from './form-validation-engine';

describe('Form Validation Engine', () => {
  it('should validate required fields correctly for missing vs valid values', () => {
    const validator = new FieldValidator<unknown>('username').addRule(Rules.required('Custom fix'));

    expect(validator.validate('')).toHaveLength(1);
    expect(validator.validate(null)).toHaveLength(1);
    expect(validator.validate(undefined)).toHaveLength(1);
    expect(validator.validate([])).toHaveLength(1);

    const errors = validator.validate('');
    expect(errors[0]).toBeInstanceOf(ValidationError);
    expect(errors[0].code).toBe('REQUIRED');
    expect(errors[0].actionableFix).toBe('Custom fix');

    expect(validator.validate('JohnDoe')).toHaveLength(0);
    expect(validator.validate(['item'])).toHaveLength(0);
  });

  it('should validate minLength and email format rules', () => {
    const minLenValidator = new FieldValidator<string>('password').addRule(Rules.minLength(8));
    const emailValidator = new FieldValidator<string>('email').addRule(Rules.email());

    const lenErrors = minLenValidator.validate('12345');
    expect(lenErrors).toHaveLength(1);
    expect(lenErrors[0].code).toBe('MIN_LENGTH');
    expect(lenErrors[0].actionableFix).toBe('Add 3 more character(s).');
    expect(minLenValidator.validate('12345678')).toHaveLength(0);

    expect(emailValidator.validate('invalid-email')).toHaveLength(1);
    expect(emailValidator.validate('invalid-email')[0].code).toBe('INVALID_EMAIL');
    expect(emailValidator.validate('user@example.com')).toHaveLength(0);
  });

  it('should compose rules using Rules.and and short-circuit on the first error', () => {
    const combinedRule = Rules.and<string>(Rules.required(), Rules.email());
    const validator = new FieldValidator<string>('contactEmail').addRule(combinedRule);

    const emptyErrors = validator.validate('');
    expect(emptyErrors).toHaveLength(1);
    expect(emptyErrors[0].code).toBe('REQUIRED');

    const invalidEmailErrors = validator.validate('not-an-email');
    expect(invalidEmailErrors).toHaveLength(1);
    expect(invalidEmailErrors[0].code).toBe('INVALID_EMAIL');

    expect(validator.validate('valid@domain.org')).toHaveLength(0);
  });

  it('should throw errors when initialized with invalid constructor or rule arguments', () => {
    expect(() => new FieldValidator('')).toThrow('Field name must be a non-empty string.');
    expect(() => new FieldValidator(123 as unknown as string)).toThrow('Field name must be a non-empty string.');

    const validator = new FieldValidator<string>('testField');
    expect(() => validator.addRule('not-a-function' as unknown as any)).toThrow('Rule must be a function.');

    expect(() => new FormSchema(null as any)).toThrow('Schema must be a valid object mapping keys to FieldValidators.');
  });

  it('should evaluate multi-field FormSchema and return success status for valid data', () => {
    interface UserForm {
      username: string;
      email: string;
    }

    const schema = new FormSchema<UserForm>({
      username: new FieldValidator<string>('username').addRule(Rules.required()).addRule(Rules.minLength(3)),
      email: new FieldValidator<string>('email').addRule(Rules.required()).addRule(Rules.email())
    });

    const formData: UserForm = { username: 'alice', email: 'alice@example.com' };
    const result = schema.validate(formData);

    expect(result.success).toBe(true);
    expect(result.data).toBe(formData);
    expect(result.errors).toEqual([]);
  });

  it('should accumulate errors across fields in FormSchema on validation failure', () => {
    interface ProfileForm {
      username: string;
      email: string;
    }

    const schema = new FormSchema<ProfileForm>({
      username: new FieldValidator<string>('username').addRule(Rules.required()).addRule(Rules.minLength(5)),
      email: new FieldValidator<string>('email').addRule(Rules.required()).addRule(Rules.email())
    });

    const badData: ProfileForm = { username: 'bob', email: 'bad-email' };
    const result = schema.validate(badData);

    expect(result.success).toBe(false);
    expect(result.data).toBe(badData);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].field).toBe('username');
    expect(result.errors[0].code).toBe('MIN_LENGTH');
    expect(result.errors[1].field).toBe('email');
    expect(result.errors[1].code).toBe('INVALID_EMAIL');
  });

  it('should throw an error when FormSchema.validate receives non-object input', () => {
    const schema = new FormSchema({
      field: new FieldValidator<string>('field')
    });

    expect(() => schema.validate(null as any)).toThrow('Form data must be a valid object.');
    expect(() => schema.validate('string' as any)).toThrow('Form data must be a valid object.');
  });
});