import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7,
);

export function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export function getRefreshTokenExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return expiresAt;
}

export function buildAuthPayload(user, refreshToken) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
    },
  };
}
