import fs from 'fs';

async function verify() {
    const source = fs.readFileSync('src/Gam3Hub.sol', 'utf8');
    const response = await fetch('https://verificationusa-west-1.initia.xyz/evm/verification/solidity/external/verify/v2/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            address: "0x02c6e02469d7e94107e09f8b34fec44f1f114fe8",
            compiler: "v0.8.24+commit.e11b9ed9",
            evm: "paris",
            optimization: {
                enabled: true,
                runs: 200
            },
            contract: "Gam3Hub",
            source: source,
            chainId: "2124225178762456"
        })
    });
    
    console.log(await response.text());
}

verify();
