import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env') });

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  DATABASE_URL: process.env.DATABASE_URL || 'file:./data/harness_cost.db',
  JWT_SECRET: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        '[FATAL] JWT_SECRET environment variable MUST be set. ' +
        'Add it to server/.env or your environment before starting the server. ' +
        'Generate a strong value via: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }
    return secret;
  })(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  FEISHU_APP_ID: process.env.FEISHU_APP_ID || '',
  FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || '',
  FEISHU_ENCRYPT_KEY: process.env.FEISHU_ENCRYPT_KEY || '',
  FEISHU_VERIFICATION_TOKEN: process.env.FEISHU_VERIFICATION_TOKEN || '',
};
