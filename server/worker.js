import "dotenv/config";
import validateEnv from "./src/config/validateEnv.js";
import { testConnection } from "./src/config/db.js";
import "./src/workers/documentWorker.js";
import { startOutboxWorker } from "./src/workers/outboxWorker.js";

validateEnv();
await testConnection();
await startOutboxWorker();

console.log("Document worker started, waiting for jobs...");
