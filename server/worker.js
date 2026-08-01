import "dotenv/config";
import validateEnv from "./src/config/validateEnv.js";
import { testConnection } from "./src/config/db.js";
import "./src/workers/documentWorker.js";

validateEnv();
await testConnection();

console.log("Document worker started, waiting for jobs...");