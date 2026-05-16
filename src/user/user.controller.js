import prisma from "../config/db.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { randomUUID } from "crypto"

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"]

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim()
  }

  return req.ip || req.socket?.remoteAddress || null
}

// ================= SIGNUP =================
export const signup = async (req, res) => {
  try {
    let { fullname, email, password, mobile } = req.body

    fullname = fullname?.trim()
    email = email?.trim()
    mobile = mobile?.trim()

    if (!fullname || !email || !password || !mobile) {
      return res.status(400).json({ message: "All fields are required" })
    }

    if (fullname.length < 3) {
      return res.status(400).json({
        message: "Name must be at least 3 characters"
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format"
      })
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({
        message: "Invalid mobile number"
      })
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 6 characters and include letters and numbers"
      })
    }

    const exist = await prisma.user.findUnique({
      where: { email }
    })

    if (exist) {
      return res.status(400).json({
        message: "User already exists"
      })
    }

    const hash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        fullname,
        email,
        password: hash,
        mobile
      }
    })

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.AUTH_SECRET,
      { expiresIn: "1d" }
    )

    res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email
      }
    })
  } catch (error) {
    console.error("Signup Error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// ================= LOGIN =================
export const login = async (req, res) => {
  try {
    let { email, password } = req.body

    email = email?.trim()

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      })
    }

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      })
    }

    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      return res.status(401).json({
        message: "Wrong password"
      })
    }

    const session = await prisma.sessionLog.create({
      data: {
        userId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]?.slice(0, 255) || null
      }
    })

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        sessionId: session.id,
        jti: randomUUID()
      },
      process.env.AUTH_SECRET,
      { expiresIn: "1d" }
    )

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email
      }
    })
  } catch (error) {
    console.error("Login Error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

const verifyGoogleIdToken = async (idToken) => {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.aud !== process.env.GOOGLE_CLIENT_ID) {
      return null
    }

    return data
  } catch (error) {
    console.error("Google token verification failed:", error)
    return null
  }
}

export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body

    if (!idToken) {
      return res.status(400).json({ message: "Google ID token required" })
    }

    const tokenData = await verifyGoogleIdToken(idToken)

    if (!tokenData || tokenData.email_verified !== "true") {
      return res.status(401).json({ message: "Invalid or unverified Google token" })
    }

    const email = tokenData.email?.trim()?.toLowerCase()
    const fullname = tokenData.name?.trim() || email

    if (!email) {
      return res.status(400).json({ message: "Google token did not return email" })
    }

    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      const generatedPassword = randomUUID()
      const hashedPassword = await bcrypt.hash(generatedPassword, 10)

      user = await prisma.user.create({
        data: {
          fullname,
          email,
          password: hashedPassword,
          mobile: "0000000000",
          role: "user"
        }
      })
    }

    const session = await prisma.sessionLog.create({
      data: {
        userId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]?.slice(0, 255) || null
      }
    })

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        sessionId: session.id,
        jti: randomUUID()
      },
      process.env.AUTH_SECRET,
      { expiresIn: "1d" }
    )

    res.json({
      message: "Google login successful",
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email
      }
    })
  } catch (error) {
    console.error("Google Login Error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// ================= LOGOUT =================
export const logout = async (req, res) => {
  try {
    const userId = req.user?.id
    const sessionId = req.user?.sessionId

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    let updated = 0

    if (sessionId) {
      const result = await prisma.sessionLog.updateMany({
        where: {
          id: sessionId,
          userId,
          isActive: true
        },
        data: {
          logoutAt: new Date(),
          isActive: false
        }
      })

      updated = result.count
    }

    if (!updated) {
      const latestActiveSession = await prisma.sessionLog.findFirst({
        where: {
          userId,
          isActive: true
        },
        orderBy: {
          loginAt: "desc"
        }
      })

      if (latestActiveSession) {
        await prisma.sessionLog.update({
          where: { id: latestActiveSession.id },
          data: {
            logoutAt: new Date(),
            isActive: false
          }
        })
      }
    }

    return res.json({ message: "Logout successful" })
  } catch (error) {
    console.error("Logout Error:", error)
    return res.status(500).json({ message: "Internal server error" })
  }
}

// ================= ADMIN LOGIN =================
export const adminLogin = async (req, res) => {
  try {
    const { adminId, password } = req.body

    if (!adminId || !password) {
      return res.status(400).json({ message: "Admin ID and password required" })
    }

    // Find admin user by email or fullname with admin/superadmin role
    const admin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: adminId },
          { fullname: adminId }
        ],
        role: { in: ["admin", "superadmin"] }
      }
    })

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" })
    }

    const match = await bcrypt.compare(password, admin.password)

    if (!match) {
      return res.status(401).json({ message: "Wrong password" })
    }

    // Create session log
    const session = await prisma.sessionLog.create({
      data: {
        userId: admin.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]?.slice(0, 255) || null
      }
    })

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        sessionId: session.id,
        jti: randomUUID()
      },
      process.env.AUTH_SECRET,
      { expiresIn: "1d" }
    )

    res.json({
      message: "Admin login success",
      token,
      user: {
        id: admin.id,
        email: admin.email,
        fullname: admin.fullname,
        role: admin.role
      }
    })
  } catch (error) {
    console.error("Admin Login Error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// ================= GET ME (Current User) =================
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true
      }
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ user })
  } catch (error) {
    console.error("GetMe Error:", error)
    res.status(500).json({ message: "Internal server error" })
  }
}

// ================= ADMIN SESSION LOGS =================
export const getSessionLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100)
    const skip = (page - 1) * limit

    const [total, sessions] = await prisma.$transaction([
      prisma.sessionLog.count(),
      prisma.sessionLog.findMany({
        skip,
        take: limit,
        orderBy: { loginAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              email: true,
              role: true
            }
          }
        }
      })
    ])

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sessions
    })
  } catch (error) {
    console.error("Get Session Logs Error:", error)
    return res.status(500).json({ message: "Internal server error" })
  }
}
