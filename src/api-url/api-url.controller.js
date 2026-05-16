import prisma from "../config/db.js"

const FRONTEND_CONFIG_KEYS = [
  "MSME_BASE_REFERENCE",
  "MSME_ADMIN_BOUNDARIES",
  "MSME_ENVIRONMENT",
  "MSME_INVESTMENT",
  "MSME_SOCIAL",
  "MSME_TRANSPORT",
  "MSME_UTILITIES",
  "MSME_CADASTRAL",
  "MSME_CONSTITUENCY",
]

const sanitizeUrl = (value) => String(value || "").trim().replace(/\/+$/, "")
const DEFAULT_SERVICE_ROOT = "https://hsacggm.in/server/rest/services/MSME_HARSAC"
const DEFAULT_MAP_SERVICE_URLS = {
  MSME_BASE_REFERENCE: `${DEFAULT_SERVICE_ROOT}/Base_Reference_Layers/MapServer`,
  MSME_ADMIN_BOUNDARIES: `${DEFAULT_SERVICE_ROOT}/Administrative_Boundaries/MapServer`,
  MSME_ENVIRONMENT: `${DEFAULT_SERVICE_ROOT}/Environmental_Constraints/MapServer`,
  MSME_INVESTMENT: `${DEFAULT_SERVICE_ROOT}/Investment_Zones/MapServer`,
  MSME_SOCIAL: `${DEFAULT_SERVICE_ROOT}/Social_Infrastructure/MapServer`,
  MSME_TRANSPORT: `${DEFAULT_SERVICE_ROOT}/Transportation_Infrastructure/MapServer`,
  MSME_UTILITIES: `${DEFAULT_SERVICE_ROOT}/Utilities/MapServer`,
  MSME_CADASTRAL: `${DEFAULT_SERVICE_ROOT}/Haryana_Cadastral/MapServer`,
  MSME_CONSTITUENCY: `${DEFAULT_SERVICE_ROOT}/Constituency_Boundaries/MapServer`,
}

export const getFrontendConfig = async (req, res) => {
  try {
    const rows = await prisma.apiUrl.findMany({
      where: {
        key: { in: FRONTEND_CONFIG_KEYS },
        isActive: true,
      },
      orderBy: { key: "asc" },
    })

    const map = { ...DEFAULT_MAP_SERVICE_URLS }
    rows.forEach((row) => {
      map[row.key] = sanitizeUrl(row.url)
    })

    res.json({
      source: "database",
      mapServices: map,
    })
  } catch (error) {
    console.error("getFrontendConfig error:", error)
    res.status(500).json({ message: "Failed to load frontend config" })
  }
}

export const listApiUrls = async (req, res) => {
  try {
    const rows = await prisma.apiUrl.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    })
    res.json({ data: rows })
  } catch (error) {
    console.error("listApiUrls error:", error)
    res.status(500).json({ message: "Failed to fetch API URLs" })
  }
}

export const createApiUrl = async (req, res) => {
  try {
    const { key, name, url, description, category, isActive } = req.body || {}

    if (!key || !name || !url) {
      return res.status(400).json({ message: "key, name and url are required" })
    }

    const created = await prisma.apiUrl.create({
      data: {
        key: String(key).trim(),
        name: String(name).trim(),
        url: sanitizeUrl(url),
        description: description ? String(description).trim() : null,
        category: category ? String(category).trim() : "general",
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    })

    res.status(201).json({ message: "API URL created", data: created })
  } catch (error) {
    console.error("createApiUrl error:", error)
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Key already exists" })
    }
    res.status(500).json({ message: "Failed to create API URL" })
  }
}

export const updateApiUrl = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" })
    }

    const { key, name, url, description, category, isActive } = req.body || {}
    const data = {}

    if (key !== undefined) data.key = String(key).trim()
    if (name !== undefined) data.name = String(name).trim()
    if (url !== undefined) data.url = sanitizeUrl(url)
    if (description !== undefined) data.description = description ? String(description).trim() : null
    if (category !== undefined) data.category = String(category).trim()
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    const updated = await prisma.apiUrl.update({
      where: { id },
      data,
    })

    res.json({ message: "API URL updated", data: updated })
  } catch (error) {
    console.error("updateApiUrl error:", error)
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "API URL not found" })
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Key already exists" })
    }
    res.status(500).json({ message: "Failed to update API URL" })
  }
}

export const deleteApiUrl = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" })
    }

    await prisma.apiUrl.delete({ where: { id } })
    res.json({ message: "API URL deleted" })
  } catch (error) {
    console.error("deleteApiUrl error:", error)
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "API URL not found" })
    }
    res.status(500).json({ message: "Failed to delete API URL" })
  }
}
