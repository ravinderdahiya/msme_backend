import prisma from "../config/db.js"
import axios from "axios"
import jwt from "jsonwebtoken"
import { randomUUID } from "crypto"

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return null
  const digitsOnly = String(phone).replace(/\D/g, '')
  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`
  }
  if (phone.startsWith('+91') && digitsOnly.length === 12) {
    return phone
  }
  return phone
}

// Format phone for SMS API (numeric only)
const formatSmsPhone = (normalizedPhone) => {
  const digits = String(normalizedPhone || '').replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits
}

// Get client IP
const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || null
}

// ===================== SEND OTP =====================
export const sendOtp = async (req, res) => {
  try {
    let { phone, mobile } = req.body
    
    phone = phone || mobile

    if (!phone) {
      return res.status(400).json({ message: "Phone number required" })
    }

    phone = normalizePhone(phone)

    if (!phone) {
      return res.status(400).json({ message: "Invalid phone format" })
    }

    // Generate 4-digit OTP and persist as string (Prisma schema: Otp.otp is String)
    const otp = String(Math.floor(1000 + Math.random() * 9000))

    // Delete existing OTP for this phone
    await prisma.otp.deleteMany({
      where: { phone }
    })

    // Create new OTP record
    await prisma.otp.create({
      data: {
        phone,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    })

    console.log("OTP Created:", { phone, otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) })

    // Send SMS via Pixabits API
    try {
      const message = `Your One Time Password is ${otp} for your application. Don't share OTP with anyone.HARSAC`
      
      await axios.post(
        "https://sms.pixabits.in/smsapi/sms/custom/send",
        {
          "key": process.env.SMS_API_KEY || "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2OTc4ODkzZGE1OTFkNjVmNDZiMzQxYmM6Njk3ODg5M2RhNTkxZDY1ZjQ2YjM0MWJlOkhBUlNBQzo2NTJmYTQ0ZWYzMTc3NjdlOTdkYTMyNmYiLCJpYXQiOjE3Njk1MTA1NTV9.lqYYXdcDUada9lKBa07uJT2hNZzpWjr8D3QmTZzGP6M",
          "text": message,
          "senderId": process.env.SMS_SENDER_ID || "HARSAC",
          "tempDltId": process.env.SMS_TEMP_DLT_ID || "1407169838783023275",
          "route": "Domestic",
          "phoneno": formatSmsPhone(phone),
          "groupIds": [" "],
          "trans": 1,
          "unicode": 0,
          "flash": false,
          "tiny": false
        }
      )

      
      res.json({ 
        message: "OTP sent successfully",
        phone,
        otp: process.env.NODE_ENV === "development" ? otp : undefined,
        smsSent: true,
        expiresIn: "5 minutes"
      })
    } catch (smsError) {
      console.error("SMS API Error:", smsError.message)

      // Still return success if SMS fails, OTP is saved in DB
      res.json({ 
        message: "OTP created successfully (SMS delivery pending)",
        phone,
        otp: process.env.NODE_ENV === "development" ? otp : undefined,
        smsSent: false,
        warning: "OTP saved but SMS delivery failed",
        expiresIn: "5 minutes"
      })
    }

  } catch (error) {
    console.error("Send OTP Error:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}

// ===================== VERIFY OTP =====================
export const verifyOtp = async (req, res) => {
  try {
    let { phone, mobile, otp } = req.body
    
    phone = phone || mobile

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP required" })
    }

    phone = normalizePhone(phone)

    if (!phone) {
      return res.status(400).json({ message: "Invalid phone format" })
    }

    const otpValue = String(otp).trim()
    if (!/^\d{4}$/.test(otpValue)) {
      return res.status(400).json({ message: "OTP must be a 4-digit number" })
    }

    // Find OTP record
    const record = await prisma.otp.findFirst({
      where: { 
        phone,
        otp: otpValue
      }
    })

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP" })
    }

    // Check OTP expiration
    const now = new Date()
    const expiresAt = new Date(record.expiresAt)

    if (expiresAt < now) {
      return res.status(400).json({ message: "OTP expired" })
    }

    // Check if user exists, else create new user
    let user = await prisma.user.findFirst({
      where: { mobile: phone }
    })

    if (!user) {
      // Create new user with mobile
      user = await prisma.user.create({
        data: { 
          mobile: phone,
          fullname: "User",
          email: `user_${Date.now()}@msme.com`,
          password: "default_password"
        }
      })
    }

    // Create session log
    const session = await prisma.sessionLog.create({
      data: {
        userId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"]?.slice(0, 255) || null
      }
    })

    // Generate JWT Token
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

    // Delete OTP after success
    await prisma.otp.deleteMany({
      where: { phone }
    })

    res.json({
      message: "OTP verified successfully",
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        email: user.email,
        fullname: user.fullname,
        role: user.role
      }
    })

  } catch (error) {
    console.error("Verify OTP Error:", error.message)
    res.status(500).json({ message: "Server error" })
  }

}
