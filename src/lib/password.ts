import { hash, verify } from '@node-rs/argon2';

const options = {
  algorithm: 2, // Algorithm.Argon2id — using numeric to avoid ambient const enum under isolatedModules
  memoryCost: 19 * 1024, // 19 MiB — OWASP 2024 recommendation
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, options);
}

export function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  return verify(hashed, plain);
}
