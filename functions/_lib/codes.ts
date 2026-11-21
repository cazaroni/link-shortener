import { GENERATED_CODE_LENGTH, RESERVED_CODES } from '../../shared/api.ts';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
/** Largest multiple of 62 that fits in a byte; bytes at or above it are discarded to avoid modulo bias. */
const UNBIASED_LIMIT = 248;

export function isReservedCode(code: string): boolean {
  return RESERVED_CODES.includes(code.toLowerCase());
}

/** Random base62 code from the Web Crypto CSPRNG. */
export function generateCode(length: number = GENERATED_CODE_LENGTH): string {
  let code = '';
  while (code.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < UNBIASED_LIMIT && code.length < length) {
        code += BASE62[byte % 62];
      }
    }
  }
  return code;
}
