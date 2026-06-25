import express from "express";
import {
  create,
  getOne,
  list,
  remove,
  update,
} from "../controllers/workspaceController.js";
import requireAuth from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "../schemas/workspace.schemas.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", validate(createWorkspaceSchema), create);
router.get("/", list);
router.get("/:id", getOne);
router.patch("/:id", validate(updateWorkspaceSchema), update);
router.delete("/:id", remove);

export default router;
