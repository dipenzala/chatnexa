import dotenv from 'dotenv';
dotenv.config();

const g = (k: string, d = ''): string => process.env[k] ?? d;
const n = (k: string, d: number): number => Number(process.env[k] ?? d);

export const env = {
  NODE_ENV: g('NODE_ENV', 'development'),
  IS_PROD: process.env.NODE_ENV === 'production',
  PORT: n('PORT', 8080),
  DATABASE_URL: g('DATABASE_URL', 'postgres://postgres:postgres@localhost:5433/chatnexa'),
  REDIS_URL: g('REDIS_URL', 'redis://localhost:6380'),
  JWT_SECRET: g('JWT_SECRET', 'change-me-super-secret-please'),
  JWT_EXPIRES: g('JWT_EXPIRES', '7d'),
  FRONTEND_URL: g('FRONTEND_URL', 'http://localhost:3000'),
  META_API_VERSION: g('META_API_VERSION', 'v19.0'),
  META_GRAPH_URL: 'https://graph.facebook.com',
  META_VERIFY_TOKEN: g('META_VERIFY_TOKEN', 'chatnexa_verify_token'),
  OPENAI_API_KEY: g('OPENAI_API_KEY'),
  OPENAI_MODEL: g('OPENAI_MODEL', 'gpt-4o-mini'),
  OPENAI_EMBED_MODEL: g('OPENAI_EMBED_MODEL', 'text-embedding-3-small'),
  CLOUDINARY_CLOUD_NAME: g('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: g('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: g('CLOUDINARY_API_SECRET'),
  RAZORPAY_KEY_ID: g('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: g('RAZORPAY_KEY_SECRET'),
  SMTP_HOST: g('SMTP_HOST'),
  SMTP_PORT: n('SMTP_PORT', 587),
  SMTP_USER: g('SMTP_USER'),
  SMTP_PASS: g('SMTP_PASS'),
  MAIL_FROM: g('MAIL_FROM', 'ChatNexa <no-reply@chatnexa.in>'),
  EXOTEL_SID: g('EXOTEL_SID'),
  EXOTEL_TOKEN: g('EXOTEL_TOKEN'),
  EXOTEL_SUBDOMAIN: g('EXOTEL_SUBDOMAIN'),
  PRICE_MARKETING: n("PRICE_MARKETING", 1.25),
  PRICE_UTILITY: n("PRICE_UTILITY", 0.20),
  PRICE_AUTH: n('PRICE_AUTH', 0.13),
  PRICE_SERVICE: n('PRICE_SERVICE', 0),
};
