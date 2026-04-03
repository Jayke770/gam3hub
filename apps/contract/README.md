# Gam3Hub Smart Contracts

Smart contracts for the Gam3Hub game on Initia MiniEVM.

## Quick Start

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Deploy
```bash
source .env
forge script script/Gam3Hub.s.sol:Gam3HubScript --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --legacy
```

## Contract Verification (Initia MiniEVM/AllesLabs)

To verify the contract on the explorer at `evm-1`, use the following command:

```bash
forge verify-contract \
  --rpc-url https://archival-jsonrpc-evm-1.anvil.asia-southeast.initia.xyz \
  --verifier custom \
  --verifier-url https://verification.alleslabs.dev/evm/verification/solidity/external/evm-1 \
  <contract-address> \
  src/Gam3Hub.sol:Gam3Hub
```

**⚠️ Important:** Always use **solc 0.8.24** to ensure the block explorer can pull the correct compiler Docker image for verification.

## Architecture
- **Proportional Payouts:** Uses a parimutuel model where players bet any amount.
- **Provably Fair:** Uses a commit/reveal scheme combined with `block.prevrandao` for bias-free outcomes.
- **Claim-Based Fees:** Platform fees are deducted during the `claim()` process and routed directly to the owner.
