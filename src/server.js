import express from "express"
import dotenv from "dotenv"
import bcrypt from "bcrypt"
import prisma from "./config/db.js"
import userRoutes from "./user/user.routes.js"
import otpRoutes from "./otp/otp.routes.js"
import apiUrlRoutes from "./api-url/api-url.routes.js"
import dataServiceRoutes from "./data-service/data-service.routes.js"
import mapserverRoutes from "./mapserver/mapserver.routes.js"
import { getDefaultMapServiceEntriesFromEnv } from "./api-url/default-map-services.js"
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

const ensureDefaultApiUrls = async () => {
  try {
    const entries = getDefaultMapServiceEntriesFromEnv(process.env)
    if (!entries.length) {
      console.warn("No default map service URLs found in env. Skipping API URL bootstrap.")
      return
    }

    for (const entry of entries) {
      await prisma.apiUrl.upsert({
        where: { key: entry.key },
        create: {
          key: entry.key,
          name: entry.name,
          url: entry.url,
          description: entry.description,
          category: entry.category,
          isActive: entry.isActive,
        },
        update: {},
      })
    }
  } catch (error) {
    console.error("Failed to seed default map service API URLs:", error)
  }
}

const inferServiceType = (endpoint) => {
  const value = String(endpoint || "").toLowerCase()
  if (value.includes("wms")) return "WMS"
  if (value.includes("wmts")) return "WMTS"
  if (value.includes("mapserver")) return "ArcGIS MapServer"
  if (value.includes("featureserver")) return "ArcGIS FeatureServer"
  if (value.includes("imageserver")) return "ArcGIS ImageServer"
  return "REST API"
}

const ensureDefaultDataServices = async () => {
  try {
    const existingCount = await prisma.dataService.count()
    if (existingCount > 0) {
      return
    }

    const legacyServices = await prisma.apiUrl.findMany({
      where: { category: "service" },
      orderBy: [{ key: "asc" }],
    })

    if (!legacyServices.length) {
      return
    }

    for (const item of legacyServices) {
      await prisma.dataService.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          name: item.name,
          endpoint: item.url,
          serviceType: inferServiceType(item.url),
          description: item.description,
          isActive: item.isActive,
          lastChecked: item.updatedAt || item.createdAt || new Date(),
        },
        update: {},
      })
    }

    console.log(`Data services bootstrap complete: ${legacyServices.length} migrated from ApiUrl.`)
  } catch (error) {
    console.error("Failed to bootstrap default data services:", error)
  }
}

const parseCorsOrigins = () => {
  return String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

const isLoopbackOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return false
  }
}

const createCorsOptions = () => {
  const origins = parseCorsOrigins()
  const allowlistedOrigins = new Set(origins)
  return {
    credentials: true,
    optionsSuccessStatus: 204,
    origin: (origin, callback) => {
      // Allow server-to-server requests and tools with no Origin header.
      if (!origin) {
        return callback(null, true)
      }

      if (!allowlistedOrigins.size) {
        console.warn("CORS_ORIGINS is not set. Allowing all origins.")
        return callback(null, true)
      }

      if (allowlistedOrigins.has(origin)) {
        return callback(null, true)
      }

      if (process.env.NODE_ENV !== "production" && isLoopbackOrigin(origin)) {
        return callback(null, true)
      }

      // Do not throw an error here; simply deny CORS headers for this origin.
      return callback(null, false)
    },
  }
}

// CORS
const corsOptions = createCorsOptions()
app.use(cors(corsOptions))
app.options(/.*/, cors(corsOptions))

// Middleware
app.use(express.json({
  limit: '100mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '100mb'
}));

// Routes
app.use("/user", userRoutes)
app.use("/otp", otpRoutes)
app.use("/api-url", apiUrlRoutes)
app.use("/data-services", dataServiceRoutes)
app.use("/mapserver", authMiddleware, mapserverRoutes)

app.get("/", (req, res) => {
  res.send("Backend is running")
})

// Server
const PORT = process.env.PORT || 8080

const startServer = async () => {
  await ensureAdminUser()
  await ensureDefaultApiUrls()
  await ensureDefaultDataServices()
    app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`)
  })

  /*app.listen(PORT, '172.16.1.50', () => {
    console.log(`Server running on ${PORT}`);
});*/
}

startServer()
