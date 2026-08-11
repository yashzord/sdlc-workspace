import { describe, it, expect } from "vitest";
import { FieldValidator, FormSchema, Rules, ValidationError } from "./form-validation-engine";

describe("Form Validation Engine", () => {
  describe("FieldValidator", () => {
    it("throws an error when instantiated with an empty or non-string field name", () => {
      expect(() => new FieldValidator("")).toThrow("Field name must be a non-empty string.");
      // @ts-expect-error testing invalid runtime parameter
      expect(() => new FieldValidator(null)).toThrow("Field name must be a non-empty string.");
    });

    it("accumulates multiple validation errors for a given field", () => {
      const validator = new FieldValidator<string>("bio")
        .addRule(Rules.required())
        .addRule(Rules.minLength(10));

      const errors = validator.validate("short");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(ValidationError);
      expect(errors[0].code).toBe("MIN_LENGTH");
      expect(errors[0].actionableFix).toBe("Add 5 more character(s).");
    });
  });

  describe("Rules", () => {
    it("identifies missing values with custom fix in Rules.required", () => {
      const rule = Rules.required("Please provide your username.");
      
      expect(rule(undefined, "username")).toBeInstanceOf(ValidationError);
      expect(rule(null, "username")).toBeInstanceOf(ValidationError);
      expect(rule("", "username")).toBeInstanceOf(ValidationError);
      expect(rule([], "username")).toBeInstanceOf(ValidationError);
      
      const err = rule("", "username");
      expect(err?.actionableFix).toBe("Please provide your username.");
      expect(rule("valid", "username")).toBeNull();
    });

    it("validates email formats correctly and ignores empty strings", () => {
      const rule = Rules.email();
      expect(rule("invalid-email", "email")).toBeInstanceOf(ValidationError);
      expect(rule("test@example.com", "email")).toBeNull();
      expect(rule("", "email")).toBeNull();
    });

    it("short-circuits validation when using Rules.and", () => {
      const rule = Rules.and<string>(
        Rules.required(),
        Rules.minLength(5)
      );

      const err = rule("", "code");
      expect(err).toBeInstanceOf(ValidationError);
      expect(err?.code).toBe("REQUIRED");
    });
  });

  describe("FormSchema", () => {
    it("returns success: true when all field validators pass", () => {
      const schema = new FormSchema({
        email: new FieldValidator<string>("email").addRule(Rules.required()).addRule(Rules.email()),
        age: new FieldValidator<number>("age")
      });

      const result = schema.validate({
        email: "user@domain.com",
        age: 25
      });

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ email: "user@domain.com", age: 25 });
    });

    it("returns success: false with all aggregated field errors on failure", () => {
      const schema = new FormSchema({
        email: new FieldValidator<string>("email").addRule(Rules.required()).addRule(Rules.email()),
        password: new FieldValidator<string>("password").addRule(Rules.required()).addRule(Rules.minLength(8))
      });

      const result = schema.validate({
        email: "not-an-email",
        password: "123"
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe("email");
      expect(result.errors[1].field).toBe("password");
    });

    it("throws runtime errors for invalid schema or form data inputs", () => {
      // @ts-expect-error testing invalid runtime parameter
      expect(() => new FormSchema(null)).toThrow("Schema must be a valid object mapping keys to FieldValidators.");
      
      const schema = new FormSchema({
        name: new FieldValidator<string>("name")
      });
      // @ts-expect-error testing invalid runtime parameter
      expect(() => schema.validate(null)).toThrow("Form data must be a valid object.");
    });
  });
});