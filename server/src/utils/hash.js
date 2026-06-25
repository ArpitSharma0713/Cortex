import crypto from "crypto";
import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function hashRefreshToken(refreshToken) {
  return crypto
    .createHmac("sha256", process.env.REFRESH_TOKEN_SECRET)
    .update(refreshToken)
    .digest("hex");
}
