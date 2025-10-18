// config/env.js

const ENV = process.env.NODE_ENV || 'development';
const isProduction = ENV === 'production';
const isDev = !isProduction;

// Toggle this in your .env to control cookie domain/samesite behavior
const sameDomain = process.env.SAME_DOMAIN === 'true';

// Frontend URL(s)
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
FRONTEND_URL = process.env.FRONTEND_URL
// ✅ Central cookie options for all tokens (user/admin)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,                // only use secure in prod
  sameSite: isProduction ? 'None' : 'Lax',                     // allow cross-origin in both envs
  domain: isProduction ?  undefined : undefined,                  // cookie restricted to backend domain
  maxAge: 7 * 24 * 60 * 60 * 1000      // 7 days
};

// ✅ Helper: stripped version (for logout)
const CLEAR_COOKIE_OPTIONS = (({ maxAge, ...rest }) => rest)(COOKIE_OPTIONS);

const config = {
  ENV,
  isProduction,
  isDev,
  sameDomain,
  frontendUrl,
  backendUrl,
  COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
  ALLOWED_ORIGINS: frontendUrl.split(',') // comma-separated URLs in .env
};

module.exports = config;
