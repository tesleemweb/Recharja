// server.js

// Force IPv4 DNS resolution
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express       = require('express');
const cors          = require('cors');
const cookieParser  = require('cookie-parser');
const connectDB     = require('./config/db');
const rateLimit     = require('express-rate-limit');
const path          = require('path');
const userPricing   = require('./routes/userPricing');
const frequentNumbersRoute = require('./routes/frequentNumbers');

const dotenv = require('dotenv');
dotenv.config();

const { isProduction, sameDomain, backendUrl, frontendUrl } = require('./config/env');
const allowedOrigins = frontendUrl.split(',');
const logger = require('./utils/logger');
logger.info('✅ Env config:', {
  isProduction,
  sameDomain,
  allowedOrigins: frontendUrl,
  backendUrl,
});


connectDB();

const app = express();
app.set('trust proxy', 1);

// 🚀 Request Duration Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl}`, { duration: `${Date.now() - start}ms` });
  });
  next();
});

// Force HTTPS in prod
if (isProduction && !sameDomain) {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}


// CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};


app.use(cors(corsOptions));

// Rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15m
  max: 100,
  message: { success: false, message: 'Too many requests, try again later.' }
}));

// Body parsing & cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── API ROUTES ────────────────────────────────────────────────────────────────
// Auth & user
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/dashboard'));

// Wallet & transactions
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/frequent-numbers', frequentNumbersRoute);

// Purchases
app.use('/api/airtime', require('./routes/airtime'));
app.use('/api/data',   require('./routes/data'));

// Paystack webhook
app.use('/webhook', require('./routes/webhook'));

app.use('/api/user', userPricing);

app.use('/api/promo', require('./routes/promo'));


// ─── ADMIN ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/admin/auth',     require('./routes/admin/auth'));
app.use('/api/admin/users',    require('./routes/admin/users'));
app.use('/api/admin/history',  require('./routes/admin/history'));
app.use('/api/admin/pricing',  require('./routes/admin/pricing'));
app.use('/api/admin/settings', require('./routes/admin/adminSettings'));
app.use('/api/admin/requery',  require('./routes/admin/requery'));
app.use('/api/admin/sync',     require('./routes/admin/syncDataPlans'));
app.use('/api/admin/notifications', require('./routes/admin/notifications'));
app.use('/api/admin/logs', require('./routes/admin/logs'));
app.use('/api/admin/promo', require('./routes/admin/promo'));



// ─── CRON JOBS ─────────────────────────────────────────────────────────────────
require('./cronJobs/autoRequery');
require('./cronJobs/requeryPaystack');

// ✅ Add this just before the 404 handler
app.get('/', (req, res) => {
  res.send('VTU backend is live 🚀');
});



// 404 handler (must come after all routes)
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { stack: err.stack });
  res.status(500).json({ success: false, message: 'Something went wrong' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔌 Server running on port ${PORT}`);
});
