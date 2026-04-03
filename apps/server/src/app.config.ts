import {
    defineServer,
    defineRoom,
    createRouter,
    createEndpoint,
    matchMaker,
} from "colyseus";
import { playground } from "@colyseus/playground";
import { env } from "./lib/env";
import { monitor } from "@colyseus/monitor";
import { CoinFlip } from "./rooms/coinflip";
import { RedisPresence } from "@colyseus/redis-presence";
import { RedisDriver } from "@colyseus/redis-driver";
import { BunWebSockets } from "@colyseus/bun-websockets"
import cors from 'cors'
import { z } from 'zod'
import { createPublicClient, http, Hex } from 'viem';
import { signJoinGame } from "./lib/signJoinGame";
import { COINFLIP_ABI } from "./abis/Coinflip";
import { initializeGame } from "./lib/game";
import { db } from "./models";
import { bets } from "./models/schema";

matchMaker.controller.exposedMethods = ["join", "joinById", "reconnect"]

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const server = defineServer({
    transport: new BunWebSockets(),
    presence: new RedisPresence(env.PRESENCE_REDIS_URL),
    driver: new RedisDriver(env.DRIVER_REDIS_URL),
    rooms: {
        coinflip: defineRoom(CoinFlip)
    },
    routes: createRouter({
        joinRoom: createEndpoint("/api/join-room", {
            method: "POST",
            body: z.object({ user: z.string() })
        }, async (ctx) => {
            const { user } = ctx.body;
            const rooms = await matchMaker.query({ name: "coinflip" })
            if (rooms.length <= 0) {
                const newRoom = await matchMaker.createRoom("coinflip", {})
                const seatReservation = await matchMaker.joinById(newRoom.roomId, { user })
                return seatReservation
            }
            const seatReservation = await matchMaker.joinById(rooms[0].roomId, { user })
            return seatReservation
        }),
        joinGame: createEndpoint("/api/join-game", {
            method: "POST",
            body: z.object({
                hash: z.string(),
                user: z.string(),
                amount: z.string(),
                side: z.number()
            })
        }, async (ctx) => {
            const { hash, user, amount, side } = ctx.body;
            console.log(`Received transaction hash from user ${user}, verifying...`);

            try {
                // Wait for transaction confirmation
                const receipt = await publicClient.waitForTransactionReceipt({
                    hash: hash as Hex
                });
                console.log(`Transaction confirmed: ${receipt.transactionHash}`);

                // Get current game ID
                const currentGameId = await publicClient.readContract({
                    address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
                    abi: COINFLIP_ABI,
                    functionName: 'currentGameId',
                } as any) as Hex;

                // Save bet to DB
                await db.insert(bets).values({
                    gameId: currentGameId.toLowerCase(),
                    playerAddress: user,
                    side: side,
                    amount: amount
                });

                return { hash };
            } catch (error: any) {
                console.error("Error verifying transaction:", error);
                throw ctx.error(500, { message: "Failed to verify transaction: " + error.message });
            }
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
                    abi: COINFLIP_ABI,
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
                        abi: COINFLIP_ABI,
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
