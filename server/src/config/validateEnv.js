const requiredEnvVars = [
  "DATABASE_URL",
  "NODE_ENV",
  "CLIENT_URL",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",

  //ASSIGNMENT 5
  "OPENAI_API_KEY",
  "QDRANT_URL",
  "QDRANT_COLLECTION"
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
}
