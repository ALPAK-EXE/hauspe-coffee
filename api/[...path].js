// Vercel: una única función serverless atiende todo /api/*
import handler from './_lib/router.js'

export const config = { maxDuration: 300 }
export default handler
