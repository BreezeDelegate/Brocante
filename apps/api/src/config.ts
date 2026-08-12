import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  API_TOKEN: z.string().min(24).optional(),
  ALLOW_UNAUTHENTICATED: z.enum(['0', '1']).default('0'),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  JSON_LIMIT: z.string().default('8mb'),
  REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(90),
  IDENTIFY_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(35_000),
  PROVIDER_MAX_QUEUE: z.coerce.number().int().min(1).max(100).default(20),
  CACHE_TTL_MS: z.coerce.number().int().min(0).max(86_400_000).default(900_000),
  CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).max(10_000).default(500),
  OLLAMA_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().trim().min(1).max(120).default('qwen2.5vl:3b'),
  VINTED_GAP_MS: z.coerce.number().int().min(1_000).max(60_000).default(2_500),
  LEBONCOIN_GAP_MS: z.coerce.number().int().min(1_000).max(60_000).default(3_000),
});

const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && !env.API_TOKEN && env.ALLOW_UNAUTHENTICATED !== '1') {
  throw new Error(
    'API_TOKEN is required in production. Set ALLOW_UNAUTHENTICATED=1 only behind trusted private access.',
  );
}

export const config = {
  ...env,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: env.TRUST_PROXY === '1',
};
