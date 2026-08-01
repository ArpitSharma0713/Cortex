import "dotenv/config";
import validateEnv from "./src/config/validateEnv.js";
import { testConnection } from "./src/config/db.js";
import { runReconciliation } from "./src/jobs/reconciliation.js";

validateEnv();
await testConnection();

const result = await runReconciliation();
console.log("Reconciliation completed:", result);
