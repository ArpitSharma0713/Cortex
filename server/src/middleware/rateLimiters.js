import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export const globalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
});

export const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => Boolean(req.loginUser),
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts, please try again later" },
});

export const registerLimiter = rateLimit({
  windowMs: ONE_HOUR_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many accounts created from this address, please try again later",
  },
});

export const refreshLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many refresh attempts" },
});
