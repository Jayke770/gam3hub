import { createWalletClient, http, Hex, keccak256, encodePacked, createPublicClient, parseEther, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../lib/env';
import { GAM3HUB_ABI } from '../abis/Gam3Hub';
import crypto from 'crypto';
import { signJoinGame } from "../lib/signJoinGame";
import fs from 'fs';
import path from 'path';

const account = privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hex);
const SEED_FILE = path.join(process.cwd(), 'seed.txt');

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const walletClient = createWalletClient({
    account,
    transport: http(env.RPC_URL)
});

async function main() {
    console.log("--- Gam3Hub E2E Test (Create -> Join -> Settle) ---");
    console.log(`Contract: ${env.COINFLIP_CONTRACT_ADDRESS}`);
    console.log(`Admin Address: ${account.address}`);

    // --- 1. PREPARE SEED & COMMITMENT ---
    let serverSeed: Hex;
    if (fs.existsSync(SEED_FILE)) {
        serverSeed = fs.readFileSync(SEED_FILE, 'utf8').trim() as Hex;
        console.log(`\n1. Found existing seed in seed.txt: ${serverSeed}`);
    } else {
        serverSeed = `0x${crypto.randomBytes(32).toString('hex')}` as Hex;
        console.log(`\n1. Generating new seed: ${serverSeed}`);
    }
    const commitment = keccak256(serverSeed);

    // --- 2. CREATE GAME ---
    console.log(`\n2. Checking Game Status...`);

    // Get current game ID first
    let currentGameId = await publicClient.readContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'currentGameId',
    } as any) as Hex;
    console.log(`   Initial Current Game ID: ${currentGameId}`);

    if (currentGameId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        process.stdout.write(`   No active game. Creating one... `);
        try {
            const createHash = await walletClient.writeContract({
                address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
                abi: GAM3HUB_ABI,
                functionName: 'createGame',
                args: [commitment]
            } as any);
            console.log(`Tx: ${createHash}`);
            await publicClient.waitForTransactionReceipt({ hash: createHash });
            
            // Get it again
            currentGameId = await publicClient.readContract({
                address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
                abi: GAM3HUB_ABI,
                functionName: 'currentGameId',
            } as any) as Hex;
            
            // Save this seed as it's now active
            fs.writeFileSync(SEED_FILE, serverSeed);
            console.log(`   ✅ Game Created! ID: ${currentGameId}`);
        } catch (e: any) {
            console.error(`\n   ❌ Failed to create game:`, e.shortMessage || e.message);
            process.exit(1);
        }
    } else {
        console.log(`   Using existing active game.`);
    }
    console.log(`   Selected Game ID: ${currentGameId}`);

    // --- 3. JOIN GAME ---
    console.log(`\n3. Joining Game (Heads)...`);
    const playerSide = 1; // Heads
    const signature = await signJoinGame(
        env.ADMIN_PRIVATE_KEY as Hex,
        env.COINFLIP_CONTRACT_ADDRESS as Hex,
        account.address as Hex,
        playerSide,
        currentGameId
    );
    console.log(`   Signature: ${signature}`);

    try {
        const joinHash = await walletClient.writeContract({
            address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
            abi: GAM3HUB_ABI,
            functionName: 'joinGame',
            args: [playerSide, signature],
            value: parseEther("0.01"), // Smaller bet for tests
            account,
        } as any);
        console.log(`   Tx Hash: ${joinHash}`);
        await publicClient.waitForTransactionReceipt({ hash: joinHash });
        console.log(`   ✅ Player Joined!`);
    } catch (e: any) {
        console.error(`   ❌ Failed to join game:`, e.shortMessage || e.message);
        process.exit(1);
    }

    // --- 4. SETTLE GAME ---
    console.log(`\n4. Settling Game...`);
    const nextServerSeed = `0x${crypto.randomBytes(32).toString('hex')}` as Hex;
    const nextCommitment = keccak256(nextServerSeed);
    
    try {
        const settleHash = await walletClient.writeContract({
            address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
            abi: GAM3HUB_ABI,
            functionName: 'settleGame',
            args: [serverSeed, nextCommitment]
        } as any);
        console.log(`   Tx Hash: ${settleHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: settleHash });
        console.log(`   ✅ Game Settled!`);

        // Log events
        let onChainOutcome: number | null = null;
        for (const log of receipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: GAM3HUB_ABI,
                    data: log.data,
                    topics: log.topics,
                }) as any;
                
                if (decoded.eventName === 'GameEnded') {
                    onChainOutcome = Number(decoded.args.outcomeSide);
                    console.log(`   ✅ GameEnded Event Found!`);
                    console.log(`   On-chain Outcome: ${onChainOutcome === 1 ? 'Heads' : 'Tails'} (${onChainOutcome})`);
                    console.log(`   Server Seed in Event: ${decoded.args.serverSeed}`);
                }
            } catch (e) { }
        }

        // --- 5. PROVABLY FAIR VERIFICATION ---
        console.log(`\n5. Verifying Provably Fair...`);
        const settledGame = await publicClient.readContract({
            address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
            abi: GAM3HUB_ABI,
            functionName: 'getGame',
            args: [currentGameId]
        } as any) as any;

        const entropy = settledGame.prevRandao;
        console.log(`   Revealed Seed: ${serverSeed}`);
        console.log(`   On-chain prevRandao (Entropy): ${entropy}`);

        const localEntropyHash = keccak256(encodePacked(['bytes32', 'uint256'], [serverSeed, BigInt(entropy)]));
        const localOutcome = Number(BigInt(localEntropyHash) % 2n);
        
        console.log(`   Local Calculated Outcome: ${localOutcome === 1 ? 'Heads' : 'Tails'} (${localOutcome})`);
        
        if (localOutcome === onChainOutcome) {
            console.log(`   ✅ VERIFICATION SUCCESS!`);
        } else {
            console.error(`   ❌ VERIFICATION FAILED!`);
        }

        // Save the NEXT seed for the next run
        fs.writeFileSync(SEED_FILE, nextServerSeed);
        console.log(`\nNext Server Seed saved to seed.txt for subsequent test run.`);

    } catch (e: any) {
        console.error(`   ❌ Failed to settle game:`, e.shortMessage || e.message);
    }

    console.log(`\n--- E2E Test Finished ---`);
}

main().catch(console.error);
