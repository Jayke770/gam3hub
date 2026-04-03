import { Room, Client, CloseCode, Messages, validate, Delayed } from "colyseus";
import { Bet, CoinFlipState } from "@workspace/shared/colysues/schema"
import { db } from "../models";
import { and, eq, gt, desc, sql } from "drizzle-orm";
import { bets, games, users } from "../models/schema";
import { ChatSchema, JoinGameSchema } from "@workspace/shared/colysues/rooms";
import { createPublicClient, formatEther, Hex, http, isAddress, createWalletClient, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";
import { env } from "../lib/env";
import { GAM3HUB_ABI } from "../abis/Gam3Hub";
const publicClient = createPublicClient({
  transport: http(env.RPC_URL)
});

const account = privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hex);
const walletClient = createWalletClient({
  account,
  transport: http(env.RPC_URL)
});

interface GameView {
  gameId: Hex;
  isActive: boolean;
  gameCreated: bigint;
  gameEnd: bigint;
  totalPlayers: bigint;
  headsPool: bigint;
  tailsPool: bigint;
  gameOutcome: number;
  commitment: Hex;
  prevRandao: bigint;
  serverSeed: Hex;
}

export class CoinFlip extends Room {
  state = new CoinFlipState();
  public delayedInterval: Delayed;
  private settleTime = 10
  messages = {
    chat: validate(ChatSchema, (client, message) => {
      this.broadcast("chat", message)
    }),
    joinGame: validate(JoinGameSchema, async (client: Client, message) => {
      console.log("New bet: ", message)
      const gameIdNorm = this.state.gameId.toLowerCase();
      const playerAddrLow = message.playerAddress.toLowerCase();

      // Check if already in this game
      if (this.state.bets.has(playerAddrLow)) {
        client.send("error", "You have already joined this game");
        return;
      }

      if (env.IS_DEMO_MODE) {
        const user = await db.query.users.findFirst({
          where: eq(users.address, playerAddrLow)
        });

        if (!user) {
          await db.insert(users).values({
            address: playerAddrLow,
          });
        } else if (user.balance < message.amount) {
          client.send("error", "Insufficient balance");
          return;
        }

        // Deduct
        await db.update(users)
          .set({ balance: sql`${users.balance} - ${message.amount}` })
          .where(eq(users.address, playerAddrLow));
      }

      await db.insert(games).values({
        id: gameIdNorm,
        gameCreated: Math.floor(Date.now() / 1000).toString(),
        isActive: true
      }).onConflictDoNothing();

      const newPlayer = await db.insert(bets).values({
        gameId: gameIdNorm,
        playerAddress: message.playerAddress.toLowerCase(),
        side: message.side,
        amount: message.amount,
        hasClaimed: false
      }).returning().then(r => r?.[0]);

      console.log("New player: ", newPlayer)

      this.syncData();
    })
  };


  async onCreate(options: { gameId: string }) {
    this.state.gameId = options.gameId || "0xdemo"
    this.state.isDemoMode = env.IS_DEMO_MODE
    await this.syncData()
  }

  async onJoin(client: Client, options: { user: string }) {
    console.log("session", client.sessionId)
    await this.syncData()
    if (this.state.bets.size > 1) {
      this.clock.start()
      //this will trigger base on the settle time
      this.clock.setTimeout(() => this.settleGame(), this.settleTime);
    }
    if (!env.IS_DEMO_MODE) {
      this.checkPlayer(options.user)
    } else {
      this.checkDemoUser(options.user)
    }
  }

  async checkDemoUser(address: string) {
    if (!address) return;
    const addrLow = address.toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.address, addrLow)
    });
    if (!user) {
      await db.insert(users).values({
        address: addrLow,
        balance: 100
      });
    }
    await this.syncData();
  }

  async onLeave(client: Client, code: CloseCode) {
    this.state.playerCount--;
    console.log(client.sessionId, "left!", code);
    if (code !== CloseCode.CONSENTED) {
      await this.allowReconnection(client, 1000000);
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  async syncData() {
    let currentgameId: string;
    let totalPlayers = 0;
    let headsPool = 0n;
    let tailsPool = 0n;

    if (env.IS_DEMO_MODE) {
      currentgameId = this.state.gameId || "0xdemo";
      const dbBets = await db.select().from(bets).where(eq(bets.gameId, currentgameId.toLowerCase()));
      totalPlayers = dbBets.length;
      dbBets.forEach(b => {
        if (b.side === 1) headsPool += BigInt(Number(b.amount) * 1e18);
        else tailsPool += BigInt(Number(b.amount) * 1e18);
      });
    } else {
      currentgameId = await publicClient.readContract({
        abi: GAM3HUB_ABI,
        functionName: "currentGameId",
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        authorizationList: []
      } as const) as Hex;

      const gameData = await publicClient.readContract({
        abi: GAM3HUB_ABI,
        functionName: "getGame",
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        args: [currentgameId as Hex],
        authorizationList: []
      } as const) as unknown as GameView;

      totalPlayers = Number(gameData.totalPlayers);
      headsPool = gameData.headsPool;
      tailsPool = gameData.tailsPool;
    }

    this.state.gameId = currentgameId
    this.state.playerCount = totalPlayers
    this.state.totalBet = Number(formatEther(headsPool + tailsPool))

    const players = await db
      .select()
      .from(bets)
      .where(and(
        eq(bets.gameId, currentgameId.toLowerCase()),
        gt(bets.amount, 0)
      ))
      .orderBy(desc(bets.amount))

    players.forEach(player => {
      this.state.bets.set(player.playerAddress, new Bet().assign({
        address: player.playerAddress,
        amount: Number(player.amount),
        side: player.side,
        dt: player.createdAt.toISOString()
      }))
    })
  }

  async checkPlayer(userWalletAddress: string) {
    if (env.IS_DEMO_MODE) return;

    if (isAddress(userWalletAddress)) {
      const playerData = await publicClient.readContract({
        abi: GAM3HUB_ABI,
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        functionName: "getPlayerInfo",
        args: [this.state.gameId as Hex, userWalletAddress as Hex],
        authorizationList: []
      } as const);
      if (playerData.playerAddress.toLowerCase() === userWalletAddress.toLowerCase()) {
        const player = await db.insert(bets).values({
          gameId: this.state.gameId.toLowerCase(),
          playerAddress: userWalletAddress,
          side: playerData.side,
          amount: Number(formatEther(playerData.betAmount)),
          hasClaimed: false
        }).onConflictDoNothing().returning().then(e => e?.[0])
        if (player) {
          this.state.bets.set(player.playerAddress, new Bet().assign({
            address: player.playerAddress,
            amount: player.amount,
            side: player.side,
            dt: new Date().toISOString()
          }))
        }
      }
      this.syncData()
    }
  }
  async settleGame() {
    console.log("booomm!");
    this.broadcast("settleStart", { timestamp: Date.now() });
    this.broadcast("chat", ChatSchema.parse({ message: "Game is settling...", user: "Server" }))
    try {
      const currentGameId = this.state.gameId?.toLowerCase() || "0xdemo";
      let outcome: number;

      if (env.IS_DEMO_MODE) {
        console.log(`[DEMO MODE] Settling game ${currentGameId} via DB only`);

        // Random outcome 1 or 2
        outcome = Math.floor(Math.random() * 2) + 1;

        // Update winners in DB
        const winningBets = await db.select().from(bets).where(and(eq(bets.gameId, currentGameId), eq(bets.side, outcome)));
        for (const winner of winningBets) {
          await db.update(users)
            .set({ balance: sql`${users.balance} + ${winner.amount * 2}` })
            .where(eq(users.address, winner.playerAddress.toLowerCase()));
        }

        await db.update(bets)
          .set({ isWon: true })
          .where(and(
            eq(bets.gameId, currentGameId),
            eq(bets.side, outcome)
          ));

        // Close current game
        await db.update(games)
          .set({ gameOutcome: outcome, isActive: false })
          .where(eq(games.id, currentGameId));

        // Create next dummy game
        const nextGameId = "0xdemo_" + Date.now();
        await db.insert(games).values({
          id: nextGameId.toLowerCase(),
          gameCreated: Math.floor(Date.now() / 1000).toString(),
          isActive: true
        });
        this.clock.start()
        this.clock.setTimeout(() =>   // Broadcast the outcome
        {
          this.broadcast("chat", ChatSchema.parse({ message: `Game settled! ${outcome === 1 ? "Heads" : "Tails"} wins!`, user: "Server" }))
          this.broadcast("settleOutcome", { outcome, gameId: currentGameId })
        }, 1000 * 5)

        this.state.gameId = nextGameId;
      } else {
        const currentGame = await db.query.games.findFirst({
          where: eq(games.id, currentGameId)
        });

        const currentServerSeed = currentGame?.serverSeed || "0x0000000000000000000000000000000000000000000000000000000000000000";
        const nextServerSeed = "0x" + crypto.randomBytes(32).toString('hex') as Hex;
        const nextCommitment = keccak256(encodePacked(['bytes32'], [nextServerSeed]));

        console.log(`Settling game ${currentGameId} with seed ${currentServerSeed}`);
        const hash = await walletClient.writeContract({
          address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
          abi: GAM3HUB_ABI,
          functionName: 'settleGame',
          args: [currentServerSeed as Hex, nextCommitment],
          account,
          chain: undefined
        });

        await publicClient.waitForTransactionReceipt({ hash });

        const gameData = await publicClient.readContract({
          abi: GAM3HUB_ABI,
          functionName: "getGame",
          address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
          args: [currentGameId as Hex],
          authorizationList: []
        }) as unknown as GameView;

        outcome = Number(gameData.gameOutcome);
        this.broadcast("settleOutcome", { outcome, gameId: currentGameId });

        await db.update(bets)
          .set({ isWon: true })
          .where(and(
            eq(bets.gameId, currentGameId),
            eq(bets.side, outcome)
          ));

        await db.update(games)
          .set({ gameOutcome: outcome, serverSeed: currentServerSeed, isActive: false })
          .where(eq(games.id, currentGameId));

        const nextGameId = await publicClient.readContract({
          address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
          abi: GAM3HUB_ABI,
          functionName: 'currentGameId',
          authorizationList: []
        }) as unknown as Hex;

        await db.insert(games).values({
          id: nextGameId.toLowerCase(),
          serverSeed: nextServerSeed,
          commitment: nextCommitment,
          gameCreated: Math.floor(Date.now() / 1000).toString(),
          isActive: true
        }).onConflictDoUpdate({
          target: games.id,
          set: { serverSeed: nextServerSeed, commitment: nextCommitment, isActive: true }
        });

        this.state.gameId = nextGameId;
      }

      this.clock.setTimeout(() => {
        this.state.bets.clear();
        this.state.playerCount = 0;
        this.state.totalBet = 0;
      }, 1000 * 5)
      await this.syncData();

    } catch (err) {
      console.error("Failed to settle game:", err);
    }
  }
}
