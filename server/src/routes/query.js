import express from "express";
import { askQuestion } from "../controllers/queryController.js";
import requireAuth from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { querySchema } from "../schemas/query.schemas.js";

const router = express.Router();

router.use(requireAuth);
router.post("/:workspaceId/query", validate(querySchema), askQuestion);

export default router;

