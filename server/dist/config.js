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
        if (secret && secret.length >= 32 && secret !== 'fallback-secret-change-me') {
            return secret;
        }
        throw new Error('[FATAL] JWT_SECRET must be set to a strong random value (>=32 chars). ' +
            'Run: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))" ' +
            'and set JWT_SECRET in server/.env');
    })(),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FEISHU_APP_ID: process.env.FEISHU_APP_ID || '',
    FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || '',
    FEISHU_ENCRYPT_KEY: process.env.FEISHU_ENCRYPT_KEY || '',
    FEISHU_VERIFICATION_TOKEN: process.env.FEISHU_VERIFICATION_TOKEN || '',
};
