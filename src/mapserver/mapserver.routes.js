import { Router } from "express"
import { proxyMapserverRequest } from "./mapserver.controller.js"

const router = Router()

router.use("/service/:serviceKey", proxyMapserverRequest)

export default router
