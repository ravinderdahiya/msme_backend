import axios from "axios"
import prisma from "../config/db.js"

const sanitizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "")
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

const buildProxyHeaders = (headers) => {
  const out = {}
  if (headers.accept) out.accept = headers.accept
  if (headers["content-type"]) out["content-type"] = headers["content-type"]
  if (headers["user-agent"]) out["user-agent"] = headers["user-agent"]
  return out
}

export const proxyMapserverRequest = async (req, res) => {
  try {
    const method = String(req.method || "GET").toUpperCase()
    if (!["GET", "POST"].includes(method)) {
      return res.status(405).json({ message: "Method not allowed" })
    }

    const serviceKey = String(req.params.serviceKey || "").trim()
    if (!serviceKey) {
      return res.status(400).json({ message: "Invalid service key" })
    }

    const serviceConfig = await prisma.apiUrl.findFirst({
      where: {
        key: serviceKey,
        isActive: true,
      },
      select: {
        id: true,
        key: true,
        url: true,
      },
    })

    const resolvedDefaultUrl = DEFAULT_MAP_SERVICE_URLS[serviceKey]
    const baseUrl = sanitizeBaseUrl(serviceConfig?.url || resolvedDefaultUrl)
    if (!baseUrl) {
      return res.status(404).json({ message: `Service key not found: ${serviceKey}` })
    }
    const suffixPath = req.path && req.path !== "/" ? req.path : ""
    const targetUrl = `${baseUrl}${suffixPath}`

    const upstream = await axios({
      method,
      url: targetUrl,
      params: req.query,
      data: method === "POST" ? req.body : undefined,
      headers: buildProxyHeaders(req.headers),
      responseType: "arraybuffer",
      validateStatus: () => true,
      timeout: 45000,
    })

    const contentType = upstream.headers["content-type"]
    if (contentType) {
      res.setHeader("content-type", contentType)
    }

    res.status(upstream.status).send(Buffer.from(upstream.data))
  } catch (error) {
    console.error("proxyMapserverRequest error:", error?.message || error)
    res.status(502).json({ message: "Map proxy failed" })
  }
}
