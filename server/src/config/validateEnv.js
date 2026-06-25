const requiredEnvVars = ["DATABASE_URL", "NODE_ENV", "CLIENT_URL"];

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
}
