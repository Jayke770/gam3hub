import { Client } from "@colyseus/sdk";

export const gameClient = new Client("ws://localhost:2567");
export const COINFLIP_CONTRACT_ADDRESS = "0x704BdA6Ec81767B34F5E340C5cEaB64C08980ccE";
export const TARGET_CHAIN_ID = 4303131403034904;
export const BECH32_CHAIN_ID = "evm-1";
