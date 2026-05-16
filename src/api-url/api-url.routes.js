import { Router } from "express"
import {
  createApiUrl,
  deleteApiUrl,
  getFrontendConfig,
  listApiUrls,
  updateApiUrl,
} from "./api-url.controller.js"
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js"

const router = Router()

router.get("/frontend-config", getFrontendConfig)

router.get("/", authMiddleware, isAdmin, listApiUrls)
router.post("/", authMiddleware, isAdmin, createApiUrl)
router.put("/:id", authMiddleware, isAdmin, updateApiUrl)
router.delete("/:id", authMiddleware, isAdmin, deleteApiUrl)

export default router
