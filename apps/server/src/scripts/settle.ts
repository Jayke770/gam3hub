import { createWalletClient, http, Hex, keccak256, encodePacked, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../lib/env';
import { GAM3HUB_ABI } from '../abis/Gam3Hub';
import crypto from 'crypto';
import { db } from '../models';
import { games } from '../models/schema';
import { eq } from 'drizzle-orm';

const account = privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hex);

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const walletClient = createWalletClient({
    account,
    transport: http(env.RPC_URL)
});

async function settleGame() {
    console.log("Checking game state...");

    // 1. Get revealed seed for CURRENT round
    // Since DB fetch is disabled/unavailable, we take it as a CLI argument


    // 2. Get current active game ID from contract to confirm existence
    const currentGameId = await publicClient.readContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'currentGameId',
    } as any) as Hex;

    if (!currentGameId || currentGameId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.error("Error: No active game detected on contract to settle.");
        process.exit(1);
    }

    console.log(`Active game found: ${currentGameId}`);

    // 3. Generate NEW server seed and commitment for the NEXT game
    const nextServerSeed = "0x72f08129bbcba21bf61ec4c083c93cc0c546612d5cdcaec14601931ecb7eede3"
    const nextCommitment = keccak256(encodePacked(['bytes32'], [nextServerSeed]));

    console.log(`Next game seed: ${nextServerSeed}`);
    console.log(`Next game commitment: ${nextCommitment}`);

    // 4. Call settleGame on contract
    console.log("Sending settleGame transaction...");
    const hash = await walletClient.writeContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'settleGame',
        args: [nextServerSeed, nextCommitment],
        account,
    } as any);

    console.log(`Settle transaction sent: ${hash}`);

    // 5. Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // 6. Get the new game ID (the contract logic updates currentGameId)
    const newGameId = await publicClient.readContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'currentGameId',
    } as any) as Hex;

    // 7. CRITICAL: Save the NEXT game details to DB so we don't lose the seed again
    await db.insert(games).values({
        id: newGameId.toLowerCase(),
        serverSeed: nextServerSeed,
        commitment: nextCommitment,
        gameCreated: Math.floor(Date.now() / 1000).toString(),
        isActive: true
    }).onConflictDoUpdate({
        target: games.id,
        set: { serverSeed: nextServerSeed, commitment: nextCommitment, isActive: true }
    });

    console.log(`Game ${currentGameId} settled. New game ${newGameId} initialized.`);
}

settleGame().catch(err => {
    console.error("Failed to settle game:", err);
    process.exit(1);
});
