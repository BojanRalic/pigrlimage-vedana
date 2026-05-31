import { Redis } from '@upstash/redis'
import { applySelectionUpdate } from '@/lib/selection'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const KEY = 'pigrlimage-vedana-selection'

export async function GET() {
  const ids = await redis.get(KEY) ?? []
  return Response.json(ids)
}

export async function POST(request) {
  const { id, action } = await request.json()
  const ids = await redis.get(KEY) ?? []
  const updated = applySelectionUpdate(ids, id, action)
  await redis.set(KEY, updated)
  return Response.json(updated)
}
