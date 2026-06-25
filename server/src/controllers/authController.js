import {
  createUser,
  deleteAllUserRefreshTokens,
  deleteRefreshToken,
  findRefreshToken,
  findUserByEmail,
  findUserById,
  storeRefreshToken,
} from "../services/authService.js";
import { comparePassword, hashPassword, hashRefreshToken } from "../utils/hash.js";
import {
  buildAuthPayload,
  generateRefreshToken,
  getRefreshTokenExpiresAt,
} from "../utils/jwt.js";

const refreshCookieName = "refreshToken";

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    expires: getRefreshTokenExpiresAt(),
  };
}

async function issueAuthTokens(res, user) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshTokenExpiresAt();

  await storeRefreshToken(user.id, tokenHash, expiresAt);
  res.cookie(refreshCookieName, refreshToken, {
    ...refreshCookieOptions(),
    expires: expiresAt,
  });

  return buildAuthPayload(user);
}

function clearRefreshCookie(res) {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
}

export async function register(req, res, next) {
  try {
    const { email, password, fullName } = req.body;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      throw createError(409, "Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, passwordHash, fullName });
    const payload = await issueAuthTokens(res, user);

    return res.status(201).json(payload);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);

    if (!user?.password_hash) {
      throw createError(401, "Invalid credentials");
    }

    const passwordMatches = await comparePassword(password, user.password_hash);

    if (!passwordMatches) {
      throw createError(401, "Invalid credentials");
    }

    const payload = await issueAuthTokens(res, user);

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];

    if (!refreshToken) {
      throw createError(401, "Unauthorized");
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await findRefreshToken(tokenHash);

    if (!storedToken) {
      throw createError(401, "Unauthorized");
    }

    await deleteRefreshToken(tokenHash);

    if (new Date(storedToken.expires_at) <= new Date()) {
      clearRefreshCookie(res);
      throw createError(401, "Unauthorized");
    }

    const user = {
      id: storedToken.user_id,
      email: storedToken.email,
      full_name: storedToken.full_name,
    };
    const payload = await issueAuthTokens(res, user);

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];

    if (refreshToken) {
      await deleteRefreshToken(hashRefreshToken(refreshToken));
    }

    clearRefreshCookie(res);

    return res.status(200).json({ message: "Logged out" });
  } catch (error) {
    return next(error);
  }
}

export async function logoutAllDevices(req, res, next) {
  try {
    await deleteAllUserRefreshTokens(req.user.id);
    clearRefreshCookie(res);

    return res.status(200).json({ message: "Logged out from all devices" });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      throw createError(404, "User not found");
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function googleCallback(req, res, next) {
  try {
    const payload = await issueAuthTokens(res, req.user);
    const redirectUrl = new URL("/dashboard", process.env.CLIENT_URL);

    redirectUrl.searchParams.set("accessToken", payload.accessToken);

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    return next(error);
  }
}
