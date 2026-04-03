import { Client } from "@colyseus/sdk";

export const gameClient = new Client(process.env.NEXT_PUBLIC_GAME_SERVER_URL || "ws://localhost:2567");
export const COINFLIP_CONTRACT_ADDRESS = "0x657d003c673db25882c1dd6ac859d88fcaede375";
export const TARGET_CHAIN_ID = 2124225178762456;
export const BECH32_CHAIN_ID = "evm-1";
