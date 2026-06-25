import { verifyAccessToken } from "../utils/jwt.js";

export default function requireAuth(req, res, next) {
  const authHeader = req.get("Authorization");
  const [scheme, token] = authHeader?.split(" ") || [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.id,
      email: payload.email,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
