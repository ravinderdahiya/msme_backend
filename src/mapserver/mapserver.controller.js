import axios from "axios"
import prisma from "../config/db.js"

const sanitizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "")

const buildProxyHeaders = (headers) => {
  const out = {}
  if (headers.accept) out.accept = headers.accept
  if (headers["content-type"]) out["content-type"] = headers["content-type"]
  if (headers["user-agent"]) out["user-agent"] = headers["user-agent"]
  return out
}

export const proxyMapserverRequest = async (req, res) => {
  let serviceKey = ""
  let targetUrl = ""

  try {
    const method = String(req.method || "GET").toUpperCase()
    if (!["GET", "POST"].includes(method)) {
      return res.status(405).json({ message: "Method not allowed" })
    }

    serviceKey = String(req.params.serviceKey || "").trim()
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

    const baseUrl = sanitizeBaseUrl(serviceConfig?.url)
    if (!baseUrl) {
      return res.status(404).json({ message: `Service key not found: ${serviceKey}` })
    }
    const suffixPath = req.path && req.path !== "/" ? req.path : ""
    targetUrl = `${baseUrl}${suffixPath}`

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
    const status = error?.response?.status
    const errorCode = error?.code
    const message = error?.message || "Map proxy failed"
    const upstreamContentType = error?.response?.headers?.["content-type"] || ""
    const upstreamBody = error?.response?.data
    let upstreamPreview = null

    if (upstreamBody) {
      try {
        if (Buffer.isBuffer(upstreamBody)) {
          upstreamPreview = upstreamBody.toString("utf8").slice(0, 500)
        } else if (typeof upstreamBody === "string") {
          upstreamPreview = upstreamBody.slice(0, 500)
        } else {
          upstreamPreview = JSON.stringify(upstreamBody).slice(0, 500)
        }
      } catch {
        upstreamPreview = null
      }
    }

    console.error("proxyMapserverRequest error:", {
      serviceKey,
      targetUrl,
      method: req.method,
      status,
      errorCode,
      message,
      upstreamContentType,
      upstreamPreview,
    })

    const responsePayload = {
      message: "Map proxy failed",
    }

    if (process.env.NODE_ENV !== "production") {
      responsePayload.details = {
        serviceKey,
        targetUrl,
        status: status || null,
        errorCode: errorCode || null,
        message,
      }
    }

    const failureStatus = status || (errorCode === "ECONNABORTED" ? 504 : 502)
    res.status(failureStatus).json(responsePayload)
  }
}
