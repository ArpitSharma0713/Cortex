import { consumeDailyQueryQuota } from "../services/usageService.js";

export default async function checkQueryLimit(req, res, next) {
  try {
    req.queryUsage = await consumeDailyQueryQuota(req.user.id);
    return next();
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({
        error: "Too Many Requests",
        message: error.message,
        details: error.details,
      });
    }

    return next(error);
  }
}
