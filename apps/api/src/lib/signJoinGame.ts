import { encodePacked, keccak256, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Generates an administrative signature for joinGame authorization.
 * Matches Solidity logic: keccak256(abi.encodePacked(address(this), msg.sender, _side, currentGameId))
 */
export async function signJoinGame(
  adminPrivateKey: Hex,
  contractAddress: Hex,
  userAddress: Hex,
  side: number,
  gameId: Hex
): Promise<Hex> {
  const account = privateKeyToAccount(adminPrivateKey);

  // 1. Pack and hash the data
  // Types must exactly match Solidity types for the hash to be identical
  const messageHash = keccak256(
    encodePacked(
      ['address', 'address', 'uint8', 'bytes32'],
      [contractAddress.toLowerCase() as Hex, userAddress.toLowerCase() as Hex, side, gameId]
    )
  );

  // 2. Sign the hash
  // signMessage internaly applies the Ethereum Message prefix: "\x19Ethereum Signed Message:\n32"
  const signature = await account.signMessage({
    message: { raw: messageHash },
  });

  return signature;
}

// Sample usage script
if (import.meta.main) {
  const SAMPLE_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex; // Foundrd Default Key 1
  const CONTRACT_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Hex;
  const USER_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
  const SIDE = 1; // Heads
  const GAME_ID = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;

  signJoinGame(SAMPLE_PRIVATE_KEY, CONTRACT_ADDR, USER_ADDR, SIDE, GAME_ID)
    .then((sig) => {
      console.log('--- Authorization Script ---');
      console.log('Contract:', CONTRACT_ADDR);
      console.log('User:', USER_ADDR);
      console.log('Side:', SIDE);
      console.log('GameID:', GAME_ID);
      console.log('---------------------------');
      console.log('Generated Signature:', sig);
    })
    .catch(console.error);
}
