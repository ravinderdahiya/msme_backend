import prisma from "../config/db.js"
import { Prisma } from "@prisma/client"
import axios from "axios"
import jwt from "jsonwebtoken"
import { randomUUID } from "crypto"
import bcrypt from "bcrypt"

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

const getSmsConfig = () => {
  return {
    apiUrl: process.env.SMS_API_URL,
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID,
    tempDltId: process.env.SMS_TEMP_DLT_ID,
    route: process.env.SMS_ROUTE,
    trans: process.env.SMS_TRANS !== undefined ? Number(process.env.SMS_TRANS) : undefined,
    unicode: process.env.SMS_UNICODE !== undefined ? Number(process.env.SMS_UNICODE) : undefined,
    flash: process.env.SMS_FLASH !== undefined ? String(process.env.SMS_FLASH).toLowerCase() === "true" : undefined,
    tiny: process.env.SMS_TINY !== undefined ? String(process.env.SMS_TINY).toLowerCase() === "true" : undefined,
    groupIds: String(process.env.SMS_GROUP_IDS || "").trim()
      ? String(process.env.SMS_GROUP_IDS).split(",").map((item) => item.trim()).filter(Boolean)
      : undefined,
  }
}

const buildInternalErrorPayload = (error) => {
  const errorId = randomUUID()
  const payload = {
    message: "Server error",
    errorId,
  }

  if (process.env.NODE_ENV !== "production") {
    payload.details = error?.message || "Unknown error"
  }

  return payload
}

const logControllerError = (label, error, errorId) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`${label} [${errorId}]`, {
      code: error.code,
      meta: error.meta,
      message: error.message,
    })
    return
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error(`${label} [${errorId}]`, {
      type: "PrismaClientValidationError",
      message: error.message,
    })
    return
  }

  console.error(`${label} [${errorId}]`, error)
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


    // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000)


    // Delete existing OTP for this phone
    await prisma.otp.deleteMany({
      where: { phone }
    })

    // Create new OTP record
    await prisma.otp.create({
      data: {
        phone,
        otp: String(otp),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    })

    console.log("OTP Created:", { phone, otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000) })

    // Send SMS via configured provider
    try {
      const message = `Your One Time Password is ${otp} for your application. Don't share OTP with anyone.HARSAC`
      const smsConfig = getSmsConfig()
      const hasSmsConfig =
        Boolean(smsConfig.apiUrl) &&
        Boolean(smsConfig.apiKey) &&
        Boolean(smsConfig.senderId) &&
        Boolean(smsConfig.tempDltId)

      if (!hasSmsConfig) {
        return res.json({
          message: "OTP created successfully (SMS delivery not configured)",
          phone,
          otp: process.env.NODE_ENV === "development" ? otp : undefined,
          smsSent: false,
          warning: "SMS configuration missing",
          expiresIn: "5 minutes"
        })
      }
      
      const smsPayload = {
        key: smsConfig.apiKey,
        text: message,
        senderId: smsConfig.senderId,
        tempDltId: smsConfig.tempDltId,
        phoneno: formatSmsPhone(phone),
      }
      if (smsConfig.route !== undefined) smsPayload.route = smsConfig.route
      if (smsConfig.groupIds !== undefined) smsPayload.groupIds = smsConfig.groupIds
      if (smsConfig.trans !== undefined) smsPayload.trans = smsConfig.trans
      if (smsConfig.unicode !== undefined) smsPayload.unicode = smsConfig.unicode
      if (smsConfig.flash !== undefined) smsPayload.flash = smsConfig.flash
      if (smsConfig.tiny !== undefined) smsPayload.tiny = smsConfig.tiny

      await axios.post(smsConfig.apiUrl, smsPayload)

      
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
    const payload = buildInternalErrorPayload(error)
    logControllerError("Send OTP Error", error, payload.errorId)
    res.status(500).json(payload)
  }
}

// ===================== VERIFY OTP =====================
export const verifyOtp = async (req, res) => {
  try {
    console.log(req.body)
   let { phone, mobile, otp, latitude, longitude } = req.body
   console.log(latitude, longitude)
    
    phone = phone || mobile

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP required" })
    }

    phone = normalizePhone(phone)

    if (!phone) {
      return res.status(400).json({ message: "Invalid phone format" })
    }


    const otpString = String(otp)

if (otpString.length !== 6) {
  return res.status(400).json({ message: "OTP must be 6 digits" })
}

const record = await prisma.otp.findFirst({
  where: { 
    phone,
    otp: otpString
  }
})
  

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP" })
    }

    // Check OTP expiration
   if (new Date(record.expiresAt) < new Date()) {
  return res.status(400).json({ message: "OTP expired ⏳" })
   }

    // Check if user exists, else create new user
    let user = await prisma.user.findFirst({
      where: { mobile: phone }
    })

    if (!user) {
      const generatedPasswordHash = await bcrypt.hash(randomUUID(), 10)
      const otpDefaultFullname = process.env.OTP_DEFAULT_FULLNAME || phone
      // Create new user with mobile
      user = await prisma.user.create({
        data: { 
          mobile: phone,
          fullname: otpDefaultFullname,
          email: `user_${Date.now()}@msme.com`,
          password: generatedPasswordHash
        }
      })
    }

    // Create session log
    const session = await prisma.sessionLog.create({
      data: {
        userId: user.id,
        ipAddress: getClientIp(req),

        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,

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
    const payload = buildInternalErrorPayload(error)
    logControllerError("Verify OTP Error", error, payload.errorId)
    res.status(500).json(payload)
  }

}
