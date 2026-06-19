import { SUPPORTED_SOURCE_TYPES } from '#catalog/source/schema.js';

export type ValidationResult = { valid: true } | { valid: false; message: string };

const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export const SourceValidation = {
  validateAlias(value: string, takenAliases: readonly string[]): ValidationResult {
    if (!ALIAS_PATTERN.test(value)) {
      return {
        valid: false,
        message: `Invalid source alias '${value}'. Alias must start with an alphanumeric and use only lowercase letters, digits, '-', and '_'.`,
      };
    }
    if (takenAliases.includes(value)) {
      return { valid: false, message: `Duplicate source alias '${value}'. Alias must be unique.` };
    }
    return { valid: true };
  },

  validateType(value: string): ValidationResult {
    if (!SUPPORTED_SOURCE_TYPES.includes(value)) {
      return {
        valid: false,
        message: `Invalid source type '${value}'. Type must be ${SUPPORTED_SOURCE_TYPES.map((t) => `'${t}'`).join(' or ')}.`,
      };
    }
    return { valid: true };
  },

  validateLocation(value: string): ValidationResult {
    if (value.length === 0) {
      return {
        valid: false,
        message: `Invalid source location '${value}'. Location must not be empty.`,
      };
    }
    return { valid: true };
  },

  assert(result: ValidationResult): void {
    if (!result.valid) throw new Error(result.message);
  },

  toValidate(result: ValidationResult): true | string {
    return result.valid ? true : result.message;
  },
};
