import { createWalletClient, http, Hex, keccak256, encodePacked, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from './env';
import { GAM3HUB_ABI } from '../abis/Gam3Hub';
import crypto from 'crypto';
import { db } from '../models';
import { games } from '../models/schema';

const account = privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hex);

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const walletClient = createWalletClient({
    account,
    transport: http(env.RPC_URL)
});

export async function initializeGame() {
    console.log("Initializing new game...");

    // 1. Generate a random server seed
    const serverSeed = `0x${crypto.randomBytes(32).toString('hex')}` as Hex;

    // 2. Calculate commitment: keccak256(abi.encodePacked(serverSeed))
    const commitment = keccak256(encodePacked(['bytes32'], [serverSeed]));

    // 3. Call createGame on contract
    const hash = await walletClient.writeContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'createGame',
        args: [commitment],
        account,
    } as any);

    console.log(`Game initialization transaction sent: ${hash}`);

    // Use waitForTransactionReceipt to ensure the game is created before returning
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract gameId from logs if needed, but currentGameId public variable will be updated
    console.log(`Game initialized successfully. Transaction confirmed in block ${receipt.blockNumber}`);

    const currentGameId = await publicClient.readContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'currentGameId',
    } as any) as Hex;

    // Save to DB
    await db.insert(games).values({
        id: currentGameId.toLowerCase(),
        serverSeed,
        commitment,
        gameCreated: Math.floor(Date.now() / 1000).toString(),
        isActive: true
    }).onConflictDoUpdate({
        target: games.id,
        set: { serverSeed, commitment, isActive: true }
    });

    return { gameId: currentGameId, serverSeed, commitment, txHash: hash };
}
