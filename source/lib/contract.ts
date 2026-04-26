// NFT contract on Base. The mint hook tries multiple ABI shapes against
// this contract so it works whether it exposes mint(), mint(address),
// mint(uint256), mint(address,uint256), or safeMint(address).
export const NFT_CONTRACT_ADDRESS = '0x6A6d006d782D624B6f511c6dfBF6eD60a8078dB1'

// Base Builder Code (ERC-8021) — appended to every mint's calldata so
// this app gets credited on Base for the volume it drives.
// Registered at base.dev → Settings → Builder Code.
export const BUILDER_CODE = 'bc_dh0rqw67'
