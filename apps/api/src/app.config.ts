import {
    defineServer,
    defineRoom,
    createRouter,
    createEndpoint,
    matchMaker,
    QueueRoom,
} from "colyseus";
import { playground } from "@colyseus/playground";
import { env } from "./lib/env.js";
import { monitor } from "@colyseus/monitor";
import { CoinFlip } from "./rooms/coinflip.js";
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";
import { BunWebSockets } from "@colyseus/bun-websockets"
import cors from 'cors'
import { z } from 'zod'
import { createPublicClient, http, Hex } from 'viem';
import { signJoinGame } from "./lib/signJoinGame.js";
import { GAM3HUB_ABI } from "./abis/Gam3Hub.js";
import { initializeGame } from "./lib/game.js";
import { db } from "./models/index.js";
import {  users } from "./models/schema.js";
import { eq } from "drizzle-orm";
import { Mines } from "./rooms/mines.js";
import { BattleRoom } from "./rooms/battle-of-tanks/BattleRoom.js";

// matchMaker.controller.exposedMethods = ["join", "joinById", "reconnect"]

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const server = defineServer({
    transport: new BunWebSockets(),
    presence: env.NODE_ENV === "production" ? new RedisPresence(env.PRESENCE_REDIS_URL) : undefined,
    driver: env.NODE_ENV === "production" ? new RedisDriver(env.DRIVER_REDIS_URL) : undefined,
    rooms: {
        coinflip: defineRoom(CoinFlip).enableRealtimeListing(),
        mines: defineRoom(Mines).enableRealtimeListing(), 
        battleOfTanks: defineRoom(BattleRoom).enableRealtimeListing(),
        queue: defineRoom(QueueRoom, {
            maxPlayers: 2,
            matchRoomName: "mines"
})
    },
    routes: createRouter({
        joinRoom: createEndpoint("/api/join-room", {
            method: "POST",
            body: z.object({ user: z.string(), room: z.union([z.literal("coinflip"), z.literal("mines")]) })
        }, async (ctx) => {
            const { user } = ctx.body;
            if (ctx.body.room === "coinflip") {
                const rooms = await matchMaker.query({ name: "coinflip" })
                const currentGameId = await publicClient.readContract({
                    address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
                    abi: GAM3HUB_ABI,
                    functionName: 'currentGameId',
                } as any) as Hex;
                if (rooms.length <= 0) {
                    const newRoom = await matchMaker.createRoom("coinflip", { gameId: currentGameId })
                    const seatReservation = await matchMaker.joinById(newRoom.roomId, { user })
                    return seatReservation
                }
                const seatReservation = await matchMaker.joinById(rooms[0].roomId, { user })
                return seatReservation
            }
            // if (ctx.body.room === "mines") {
            //     const rooms = await matchMaker.query({ name: "mines" });
            //     const existingRoom = rooms.find(r => r.metadata?.players?.includes(user.toLowerCase()));

            //     if (existingRoom) {
            //         return await matchMaker.joinById(existingRoom.roomId, { user });
            //     }

            //     if (rooms.length <= 0) {
            //         const newRoom = await matchMaker.createRoom("mines", { players: [user.toLowerCase()] });
            //         return await matchMaker.joinById(newRoom.roomId, { user });
            //     }
                
            //     return await matchMaker.joinById(rooms[0].roomId, { user });
            // }
        }),
        getServerSignature: createEndpoint("/api/get-signature", {
            method: "GET",
            query: z.object({
                user: z.string(),
                side: z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)]))
            })
        }, async (ctx) => {
            try {
                const { user, side } = ctx.query;
                let currentGameId = await publicClient.readContract({
                    address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
                    abi: GAM3HUB_ABI,
                    functionName: 'currentGameId',
                } as any) as Hex;

                console.log(`--- Generating Signature ---`);
                console.log(`Contract: ${env.COINFLIP_CONTRACT_ADDRESS}`);
                console.log(`User: ${user}`);
                console.log(`Side: ${side}`);
                console.log(`GameID: ${currentGameId}`);
                console.log(`----------------------------`);

                if (!currentGameId || currentGameId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    console.log("No active game found, initializing...");
                    await initializeGame();

                    // Refetch the new currentGameId
                    currentGameId = await publicClient.readContract({
                        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
                        abi: GAM3HUB_ABI,
                        functionName: 'currentGameId',
                    } as any) as Hex;

                    if (!currentGameId || currentGameId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
                        throw ctx.error(500, { message: "Failed to initialize and fetch active game" });
                    }
                }

                const signature = await signJoinGame(
                    env.ADMIN_PRIVATE_KEY as Hex,
                    env.COINFLIP_CONTRACT_ADDRESS as Hex,
                    (ctx.query.user as string).toLowerCase() as Hex,
                    ctx.query.side,
                    currentGameId
                );

                console.log(`Generated Sig: ${signature}`);

                return {
                    signature,
                    currentGameId,
                    contract: env.COINFLIP_CONTRACT_ADDRESS
                };
            } catch (error: any) {
                console.error("Error generating signature:", error);
                throw ctx.error(500, { message: error.message || "Internal Server Error" });
            }
        }),

        triggerSettle: createEndpoint("/api/settle", {
            method: "POST"
        }, async (ctx) => {
            try {
                const rooms = await matchMaker.query({ name: "coinflip" });
                if (rooms.length > 0) {
                    await matchMaker.remoteRoomCall(rooms[0].roomId, "settleGame", []);
                    return { success: true, message: "Manual settlement triggered in room: " + rooms[0].roomId };
                }
                return { success: false, message: "No active room found" };
            } catch (error: any) {
                console.error("Manual settle error:", error);
                throw ctx.error(500, { message: error.message });
            }
        }),
        getUserBalance: createEndpoint("/api/users/:address/balance", {
            method: "GET",
            params: z.object({ address: z.string() })
        }, async (ctx) => {
            try {
                const { address } = ctx.params;
                const user = await db.query.users.findFirst({
                    where: eq(users.address, address.toLowerCase())
                });
                return { balance: user?.balance || 0 };
            } catch (error: any) {
                console.error("Error fetching balance:", error);
                throw ctx.error(500, { message: "Internal Server Error" });
            }
        }),
    }),
    express: (app) => {
        app.use("/monitor", monitor());
        app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
        if (env.NODE_ENV !== "production") {
            app.use("/", playground());
        }
    }
});

export default server;
