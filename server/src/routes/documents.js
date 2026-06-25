import express from "express";
import {
  deleteDocument,
  getDocument,
  listDocuments,
  uploadDocument,
} from "../controllers/documentController.js";
import requireAuth from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { uploadDocumentSchema } from "../schemas/document.schemas.js";
import { upload } from "../utils/multerConfig.js";

const router = express.Router();

function handleUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large" });
    }

    return res.status(400).json({ error: error.message });
  });
}

router.use(requireAuth);

router.post(
  "/:workspaceId/documents",
  handleUpload,
  validate(uploadDocumentSchema),
  uploadDocument,
);
router.get("/:workspaceId/documents", listDocuments);
router.get("/:workspaceId/documents/:id", getDocument);
router.delete("/:workspaceId/documents/:id", deleteDocument);

export default router;
