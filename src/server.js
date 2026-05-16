import express from "express"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import prisma from "./config/db.js"
import userRoutes from "./user/user.routes.js"
import otpRoutes from "./otp/otp.routes.js"
import apiUrlRoutes from "./api-url/api-url.routes.js"
import mapserverRoutes from "./mapserver/mapserver.routes.js"
import cors from "cors"
import { authMiddleware } from "./middleware/auth.middleware.js"

dotenv.config()

const app = express()

const ensureAdminUser = async () => {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: { in: ["admin", "superadmin"] } }
    })

    if (existingAdmin) {
      return
    }

    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD
    const adminFullname = process.env.ADMIN_FULLNAME
    const adminMobile = process.env.ADMIN_MOBILE

    if (!adminEmail || !adminPassword || !adminFullname || !adminMobile) {
      console.warn(
        "Admin user not created: missing ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULLNAME, or ADMIN_MOBILE in environment."
      )
      return
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    await prisma.user.create({
      data: {
        fullname: adminFullname,
        email: adminEmail,
        password: hashedPassword,
        mobile: adminMobile,
        role: "admin"
      }
    })

    console.log("Admin account created from environment configuration:", adminEmail)
  } catch (error) {
    console.error("Failed to create admin user:", error)
  }
}

// CORS
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174"
  ],
  credentials: true
}));

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Routes
app.use("/user", userRoutes)
app.use("/otp", otpRoutes)
app.use("/api-url", apiUrlRoutes)
app.use("/mapserver", authMiddleware, mapserverRoutes)

app.get("/", (req, res) => {
  res.send("Backend is running")
})

// Server
const PORT = process.env.PORT || 8080

const startServer = async () => {
  await ensureAdminUser()
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`)
  })
}

startServer()
