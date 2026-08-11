import { describe, it, expect } from "vitest";
import {
  ValidationError,
  FieldValidator,
  FormSchema,
  Rules
} from "./form-validation-engine";

describe("Form Validation Engine", () => {
  it("should initialize FieldValidator and throw on empty field name", () => {
    expect(() => new FieldValidator("")).toThrow("Field name must be a non-empty string.");
    const nameValidator = new FieldValidator<string>("username");
    expect(nameValidator.fieldName).toBe("username");
  });

  it("should correctly evaluate required rule for empty inputs and custom actionable fix", () => {
    const rule = Rules.required("Please enter a username.");
    const errNull = rule(null, "username");
    expect(errNull).toBeInstanceOf(ValidationError);
    expect(errNull?.code).toBe("REQUIRED");
    expect(errNull?.actionableFix).toBe("Please enter a username.");

    const errArray = rule([], "items");
    expect(errArray).toBeInstanceOf(ValidationError);

    expect(rule("valid string", "username")).toBeNull();
  });

  it("should validate minLength and email rules correctly", () => {
    const minRule = Rules.minLength(5);
    expect(minRule("abc", "code")?.actionableFix).toBe("Add 2 more character(s).");
    expect(minRule("12345", "code")).toBeNull();

    const emailRule = Rules.email();
    expect(emailRule("not-an-email", "email")?.code).toBe("INVALID_EMAIL");
    expect(emailRule("user@example.com", "email")).toBeNull();
  });

  it("should short-circuit inside Rules.and operator on first failing rule", () => {
    const combinedRule = Rules.and<string>(
      Rules.required(),
      Rules.minLength(5)
    );

    const emptyErr = combinedRule("", "password");
    expect(emptyErr?.code).toBe("REQUIRED");

    const shortErr = combinedRule("123", "password");
    expect(shortErr?.code).toBe("MIN_LENGTH");
  });

  it("should validate a complete FormSchema successfully", () => {
    const userSchema = new FormSchema({
      email: new FieldValidator<string>("email").addRule(Rules.required()).addRule(Rules.email()),
      age: new FieldValidator<number>("age")
    });

    const result = userSchema.validate({ email: "dev@company.com", age: 30 });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual({ email: "dev@company.com", age: 30 });
  });

  it("should aggregate errors when FormSchema validation fails", () => {
    const userSchema = new FormSchema({
      email: new FieldValidator<string>("email").addRule(Rules.required()).addRule(Rules.email()),
      bio: new FieldValidator<string>("bio").addRule(Rules.minLength(10))
    });

    const result = userSchema.validate({ email: "invalid-email", bio: "short" });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].field).toBe("email");
    expect(result.errors[1].field).toBe("bio");
  });

  it("should throw errors when invalid arguments are passed to FormSchema constructor or validate", () => {
    expect(() => new FormSchema(null as any)).toThrow("Schema must be a valid object mapping keys to FieldValidators.");
    const schema = new FormSchema({
      name: new FieldValidator<string>("name")
    });
    expect(() => schema.validate(null as any)).toThrow("Form data must be a valid object.");
  });
});