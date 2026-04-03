import { createWalletClient, http, Hex, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../lib/env';
import { GAM3HUB_ABI } from '../abis/Gam3Hub';

const account = privateKeyToAccount(env.ADMIN_PRIVATE_KEY as Hex);

const publicClient = createPublicClient({
    transport: http(env.RPC_URL)
});

const walletClient = createWalletClient({
    account,
    transport: http(env.RPC_URL)
});

async function testJoin() {
    console.log("--- Sandbox Join Test (No Signature Check) ---");
    console.log(`Contract: ${env.COINFLIP_CONTRACT_ADDRESS}`);
    console.log(`User Address (Admin): ${account.address}`);

    // 1. Get current active game
    const currentGameId = await publicClient.readContract({
        address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
        abi: GAM3HUB_ABI,
        functionName: 'currentGameId',
    } as any) as Hex;

    if (!currentGameId || currentGameId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.error("Error: No active game found on contract.");
        process.exit(1);
    }

    console.log(`Active Game: ${currentGameId}`);

    // 2. Generate Signature (MATCHING SERVER LOGIC)
    console.log("Generating EIP-191 Signature via Library...");
    const { signJoinGame } = await import('../lib/signJoinGame');
    
    const signature = await signJoinGame(
        env.ADMIN_PRIVATE_KEY as Hex,
        env.COINFLIP_CONTRACT_ADDRESS as Hex,
        account.address as Hex,
        1,
        currentGameId
    );

    console.log(`Signature: ${signature}`);

    // 3. Join the game
    console.log("Attempting to join game (Heads) with signature...");
    
    try {
        const hash = await walletClient.writeContract({
            address: env.COINFLIP_CONTRACT_ADDRESS as Hex,
            abi: GAM3HUB_ABI,
            functionName: 'joinGame',
            args: [1, signature], // 1 = Heads
            value: parseEther("0.1"),
            account,
        } as any);

        console.log(`Join transaction sent: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Transaction confirmed in block ${receipt.blockNumber}! Status: ${receipt.status}`);
        
        if (receipt.status === 'success') {
            console.log("✅ SUCCESS across the board on-chain.");
        } else {
            console.error("❌ FAILED: Transaction reverted on-chain.");
        }
    } catch (error: any) {
        console.error("❌ FAILED during submission:", error.shortMessage || error.message);
        if (error.data) console.error("Error Data:", error.data);
    }
}

testJoin().catch(console.error);
