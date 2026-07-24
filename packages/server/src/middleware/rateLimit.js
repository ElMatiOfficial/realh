import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
  },
});

export const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMIT', message: 'Too many verification requests' },
  },
});

// Live-code redemption is unauthenticated and single-guess-per-request, so it
// is the one endpoint where an attacker could try to brute-force a code during
// its ~2-minute lifetime. 10/min/IP makes the search space (~30^8) unreachable
// while still letting a human retry a mistyped code.
export const liveCodeVerifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMIT', message: 'Too many code checks, please wait a minute' },
  },
});
