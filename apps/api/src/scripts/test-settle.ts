import { createWalletClient, http, Hex, keccak256, encodePacked, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../lib/env';
import { GAM3HUB_ABI } from '../abis/Gam3Hub';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SEED_FILE = path.join(process.cwd(), 'seed.json');

const account = privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hex);

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const walletClient = createWalletClient({
    account,
    transport: http(env.RPC_URL)
});

async function testSettle() {
    console.log("--- Sandbox Management Flow (No DB) ---");
    console.log(`Contract: ${env.COINFLIP_CONTRACT_ADDRESS}`);

    // 1. Get current active game ID from contract
    const currentGameId = await publicClient.readContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'currentGameId',
    } as any) as Hex;

    const isNoActiveGame = !currentGameId || currentGameId === "0x0000000000000000000000000000000000000000000000000000000000000000";

    if (isNoActiveGame) {
        console.log("No active game detected. Initializing first round...");
        
        const newSeed = `0x${crypto.randomBytes(32).toString('hex')}` as Hex;
        const newCommitment = keccak256(encodePacked(['bytes32'], [newSeed]));

        const hash = await walletClient.writeContract({
            address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
            abi: GAM3HUB_ABI,
            functionName: 'createGame',
            args: [newCommitment],
            account,
        } as any);

        console.log(`Create game hash: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });

        // Save revealed seed for THIS game so we can settle it later
        fs.writeFileSync(SEED_FILE, JSON.stringify({ currentSeed: newSeed }));
        console.log(`First game initialized. Seed saved to ${SEED_FILE}`);
        return;
    }

    console.log(`Active game: ${currentGameId}`);

    // 2. Load the seed for the current round from local file
    if (!fs.existsSync(SEED_FILE)) {
        console.error("Error: Active game exists but seed.json is missing!");
        process.exit(1);
    }

    const { currentSeed } = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    console.log(`Loaded revealed seed for current round: ${currentSeed}`);

    // 3. Generate NEW seed and commitment for the NEXT round
    const nextSeed = `0x${crypto.randomBytes(32).toString('hex')}` as Hex;
    const nextCommitment = keccak256(encodePacked(['bytes32'], [nextSeed]));

    console.log(`Next game commitment: ${nextCommitment}`);

    // 4. Settle current game and re-init next
    console.log("Sending settleGame transaction...");
    const hash = await walletClient.writeContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'settleGame',
        args: [currentSeed, nextCommitment],
        account,
    } as any);

    console.log(`Settle hash: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });

    // 5. Update seed file for the NEXT round
    fs.writeFileSync(SEED_FILE, JSON.stringify({ currentSeed: nextSeed }));
    console.log(`Settlement complete. Next round seed saved to ${SEED_FILE}`);
}

testSettle().catch(err => {
    console.error("Flow failed:", err);
    process.exit(1);
});
