const rateLimit = require('express-rate-limit');

// Rate limiter geral
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Aumentado para desenvolvimento
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development for localhost
    return process.env.NODE_ENV === 'development' && req.ip === '::1';
  }
});

// Rate limiter para autenticação (mais restritivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // Mais tentativas em dev
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting para localhost em desenvolvimento
    return process.env.NODE_ENV === 'development' && (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1');
  }
});

module.exports = { generalLimiter, authLimiter };
