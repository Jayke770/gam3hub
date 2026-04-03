import { z } from 'zod'

const envSchema = z.object({
    PORT: z.coerce.number().default(2567),
    ADMIN_PRIVATE_KEY: z.string(),
    CORS_ORIGIN: z.string().transform(e => e.split(',').map(s => s.trim())),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PRESENCE_REDIS_URL: z.url(),
    DRIVER_REDIS_URL: z.url(),
    DATABASE_URL: z.url(),
    COINFLIP_CONTRACT_ADDRESS: z.string().startsWith('0x'),
    RPC_URL: z.url(),
})

export const env = envSchema.parse(process.env)