type RuntimeEnv = Record<string, unknown> & { DB?: D1Database };

export const env = ((globalThis as typeof globalThis & { __WOBBLE_ENV__?: RuntimeEnv }).__WOBBLE_ENV__ || {}) as RuntimeEnv;
