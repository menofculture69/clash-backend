import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const devJwtSecret =
  'dev-only-app-jwt-secret-change-this-before-production-123456789';
const devRefreshSecret =
  'dev-only-refresh-secret-change-this-before-production-987654321';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  CLASH_API_BASE_URL: z.string().url().default('https://api.clashofclans.com/v1'),
  CLASH_API_JWT: z.string().min(1),
  APP_JWT_SECRET: z.string().min(nodeEnv === 'production' ? 32 : 16).default(
    nodeEnv === 'production' ? '' : devJwtSecret
  ),
  APP_REFRESH_SECRET: z.string().min(nodeEnv === 'production' ? 32 : 16).default(
    nodeEnv === 'production' ? '' : devRefreshSecret
  ),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  PLAYER_CACHE_TTL_SECONDS: z.coerce.number().default(120),
  CLAN_CACHE_TTL_SECONDS: z.coerce.number().default(120),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  MONGODB_URI: z.string().optional(),
  MONGODB_DATABASE: z.string().default('clash_companion'),
  ADMIN_API_KEY: z.string().min(nodeEnv === 'production' ? 32 : 24).optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues
    .map((issue) => {
      const key = issue.path.join('.') || 'environment';
      return `${key}: ${issue.message}`;
    })
    .join('; ');

  throw new Error(`Invalid environment configuration. ${issues}`);
}

const parsed = result.data;

export const env = {
  ...parsed,
  isProduction: parsed.NODE_ENV === 'production',
  corsAllowedOrigins: parsed.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  hasMongo: Boolean(parsed.MONGODB_URI),
  hasCloudinary: Boolean(
    parsed.CLOUDINARY_CLOUD_NAME &&
      parsed.CLOUDINARY_API_KEY &&
      parsed.CLOUDINARY_API_SECRET
  )
};
