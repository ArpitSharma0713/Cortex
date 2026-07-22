const requiredEnvVars = [
  "DATABASE_URL",
  "NODE_ENV",
  "CLIENT_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "OPENAI_API_KEY",
  "QDRANT_URL",
  "QDRANT_API_KEY",
  "QDRANT_COLLECTION",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
];

export default function validateEnv() {
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]?.trim(),
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(", ")}`,
    );
  }

  if (process.env.PORT) {
    const port = Number(process.env.PORT);

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error("PORT must be a positive integer");
    }
  }

  if (process.env.REFRESH_TOKEN_EXPIRES_DAYS) {
    const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS);

    if (!Number.isInteger(days) || days <= 0) {
      throw new Error("REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer");
    }
  }

  if (process.env.EMBEDDING_DIMENSION) {
    const dimension = Number(process.env.EMBEDDING_DIMENSION);

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error("EMBEDDING_DIMENSION must be a positive integer");
    }
  }

  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ENDPOINT &&
    !process.env.R2_ENDPOINT.includes(process.env.R2_ACCOUNT_ID)
  ) {
    throw new Error("R2_ENDPOINT must include R2_ACCOUNT_ID");
  }
}
