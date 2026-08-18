import express from "express";
import passport from "../config/passport.js";
import {
  checkLoginCredentials,
  googleCallback,
  login,
  logout,
  logoutAllDevices,
  me,
  refresh,
  register,
} from "../controllers/authController.js";
import requireAuth from "../middleware/requireAuth.js";
import {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../schemas/auth.schemas.js";

const router = express.Router();

router.post("/register", registerLimiter, validate(registerSchema), register);
router.post(
  "/login",
  validate(loginSchema),
  checkLoginCredentials,
  loginLimiter,
  login,
);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", logout);
router.post("/logout-all", requireAuth, logoutAllDevices);
router.get("/me", requireAuth, me);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth`,
    session: false,
  }),
  googleCallback,
);

export default router;
