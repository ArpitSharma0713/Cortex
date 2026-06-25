export default function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const shouldShowStack = process.env.NODE_ENV === "development" && statusCode >= 500;

  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    ...(shouldShowStack && { stack: err.stack }),
  });
}
