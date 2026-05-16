import { Router } from "express"
import { signup, login, googleLogin, logout, getSessionLogs, adminLogin, getMe } from "./user.controller.js"
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js"

const router = Router()

router.post("/signup", signup)
router.post("/login", login)
router.post("/google-login", googleLogin)
router.post("/admin-login", adminLogin)
router.post("/logout", authMiddleware, logout)

// Get current user info
router.get("/me", authMiddleware, getMe)

router.get("/admin/session-logs", authMiddleware, isAdmin, getSessionLogs)

// Protected route
router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Authorized",
    user: req.user
  })
})

export default router