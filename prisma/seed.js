import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import bcrypt from "bcrypt"
import { PrismaClient } from "@prisma/client"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, "../.env") })

const prisma = new PrismaClient()

const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD
const adminFullname = process.env.ADMIN_FULLNAME
const adminMobile = process.env.ADMIN_MOBILE

if (!adminEmail || !adminPassword || !adminFullname || !adminMobile) {
  console.error(
    "Missing admin env vars. Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULLNAME, and ADMIN_MOBILE before running the seeder."
  )
  process.exit(1)
}

const seedAdmin = async () => {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: { in: ["admin", "superadmin"] } }
    })

    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email)
      return
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingEmail) {
      console.error(
        `A user with email ${adminEmail} already exists but is not an admin. Please remove or change that user before seeding.`
      )
      process.exit(1)
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const admin = await prisma.user.create({
      data: {
        fullname: adminFullname,
        email: adminEmail,
        password: hashedPassword,
        mobile: adminMobile,
        role: "admin"
      }
    })

    console.log("Admin account seeded successfully:", admin.email)
  } catch (error) {
    console.error("Failed to seed admin user:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seedAdmin()
