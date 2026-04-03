import z from "zod"

export const ChatSchema = z.object({
    user: z.string().min(1),
    message: z.string().min(1),
    dateTime: z.string().default(() => new Date().toISOString())
})
export const JoinGameSchema = z.object({
    playerAddress: z.string().nonempty(),
    side: z.union([z.literal(0), z.literal(1)]),
    amount: z.number().gt(0)
})