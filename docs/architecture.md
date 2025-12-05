# Crynux Portal Architecture

This document describes the technical architecture of the Crynux Portal frontend application. **Read this document before making any code changes.**

## Overview

Crynux Portal is a Vue 3 application that interacts with:
1. **Crynux Relay API** - Backend REST API for off-chain data
2. **Smart Contracts** - On-chain operations via MetaMask

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vue Components                            │
├─────────────────────────────────────────────────────────────────┤
│     Stores (Pinia)      │         Services                      │
│  ┌─────────┐ ┌────────┐ │  ┌──────────────┐ ┌────────────────┐  │
│  │ wallet  │ │  auth  │ │  │   contract   │ │ delegated-     │  │
│  │  .js    │ │  .js   │ │  │     .js      │ │ staking.js     │  │
│  └─────────┘ └────────┘ │  └──────────────┘ └────────────────┘  │
├─────────────────────────┴───────────────────────────────────────┤
│                         API Layer                                │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │    v1 (Relay API)    │  │    v2 (Relay API)    │             │
│  │  - wallet.js         │  │  - delegated-        │             │
│  │  - network.js        │  │    staking.js        │             │
│  │  - stats.js          │  │  - network.js        │             │
│  └──────────────────────┘  └──────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                      External Services                           │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │   Crynux Relay API   │  │   Smart Contracts    │             │
│  │   (REST Backend)     │  │   (via MetaMask)     │             │
│  └──────────────────────┘  └──────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── api/                    # REST API clients
│   ├── v1/                 # V1 API endpoints
│   │   ├── v1.js          # Axios client with auth interceptor
│   │   ├── wallet.js      # Wallet-related APIs (requires auth)
│   │   ├── network.js     # Network stats APIs
│   │   └── stats.js       # Statistics APIs
│   └── v2/                 # V2 API endpoints
│       ├── v2.js          # Axios client (no auth)
│       ├── delegated-staking.js
│       └── network.js
├── stores/                 # Pinia stores
│   ├── wallet.js          # Wallet connection & state
│   └── auth.js            # Authentication session
├── services/               # Business logic
│   ├── contract.js        # Contract utilities
│   ├── delegated-staking.js  # Staking contract operations
│   └── token.js           # Token formatting utilities
├── abi/                    # Smart contract ABIs
│   ├── delegated-staking.json
│   ├── node-staking.json
│   ├── beneficial-address.json
│   └── credits.json
└── config.json            # Network & contract configuration
```

---

## Stores

### `wallet.js` - Wallet Store

For detailed wallet store and MetaMask relationship, see **[docs/wallet.md](./wallet.md)**.

**Quick summary:**
- Manages MetaMask connection and state
- `selectedNetworkKey` controls which network is active
- `ensureNetworkOnWallet(networkKey)` switches MetaMask and updates store
- We read `address` and `balanceWei` from MetaMask, network info comes from config.json

### `auth.js` - Auth Store

For detailed authentication flow, see **[docs/auth.md](./auth.md)**.

**Quick summary:**
- Manages Relay API authentication
- `authenticate()` - full auth flow (connect wallet → sign → get token)
- `sessionToken` - JWT for authenticated API calls
- `isAuthenticated` - check if session is valid

---

## API vs Contracts: When to Use Which

### Use REST API (`src/api/`) for:
- **Reading off-chain data** (statistics, historical data, aggregated info)
- **Data that requires backend processing**
- **Authenticated operations** (withdrawals, deposits)

### Use Smart Contracts (`src/services/`) for:
- **On-chain transactions** (stake, unstake)
- **Reading on-chain state** (min stake amount, current staking info)
- **Operations that modify blockchain state**

### Decision Matrix:

| Operation | API or Contract | Location |
|-----------|-----------------|----------|
| Get node list with stats | API | `v2/delegated-staking.js` |
| Get delegation earnings | API | `v1/wallet.js` |
| Get min stake amount | Contract | `services/delegated-staking.js` |
| Stake tokens | Contract | `services/delegated-staking.js` |
| Unstake tokens | Contract | `services/delegated-staking.js` |
| Withdraw from relay | API + Signature | `v1/wallet.js` |
| Get network stats | API | `v1/network.js` |

---

## Network Handling

### Multi-Network Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  wallet.selectedNetworkKey: 'dymension' | 'near'          │  │
│  │  (User can switch in UI header)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                    ┌───────────────────┐
│   Crynux Relay    │                    │ Blockchain Networks│
│                   │                    │                   │
│ - Relay Account   │                    │ ┌───────────────┐ │
│ - Withdrawals     │                    │ │  Dymension    │ │
│ - Deposits        │                    │ │  - RPC URL    │ │
│ - Node stats      │                    │ │  - Contracts  │ │
│ - Delegation info │                    │ └───────────────┘ │
│                   │                    │ ┌───────────────┐ │
│ (Off-chain data)  │                    │ │  Near         │ │
│                   │                    │ │  - RPC URL    │ │
│                   │                    │ │  - Contracts  │ │
│                   │                    │ └───────────────┘ │
└───────────────────┘                    └───────────────────┘
```

**Relay vs Blockchain Networks:**

| Component | Purpose | Examples |
|-----------|---------|----------|
| **Crynux Relay** | Off-chain backend service | Relay account balance, withdrawals, deposits, node statistics, delegation earnings |
| **Blockchain Networks** | On-chain smart contracts | Staking, unstaking, beneficial address, node registration |

**Key Points:**
1. **Multiple Blockchains**: Portal supports multiple networks (currently Dymension and Near)
2. **User Can Switch**: Network selector in the header allows switching between networks
3. **Relay is Separate**: Relay is an independent backend service, NOT a blockchain. It handles off-chain operations
4. **Network Parameter**: Some APIs need `network` parameter to know which blockchain's data to return
5. **Per-Network Contracts**: Each blockchain has its own RPC URL and contract addresses in `config.json`
6. **Nodes Have Networks**: Each node belongs to a specific blockchain (returned as `node.network` from API)

### Configuration

Networks are defined in `config.json`:
```json
{
  "networks": {
    "dymension": {
      "chainId": "1313161573",
      "chainName": "Crynux on Dymension",
      "rpcUrls": ["https://json-rpc.testnet-dym.crynux.io"],
      "contracts": {
        "delegatedStaking": "0x...",
        "nodeStaking": "0x..."
      }
    },
    "near": {
      "chainId": "1313161574",
      "chainName": "Crynux on Near",
      "rpcUrls": ["https://json-rpc.testnet-near.crynux.io"],
      "contracts": {
        "delegatedStaking": "0x...",
        "nodeStaking": "0x..."
      }
    }
  }
}
```

### How Network Switching Works

**1. User switches network in UI (App.vue header):**
```javascript
async function changeNetwork(networkKey) {
  // Switch MetaMask and update wallet store
  await wallet.ensureNetworkOnWallet(networkKey)
  // Refresh wallet balance on new chain
  await wallet.refreshAccountAndBalance()
}
```

**2. API calls pass network parameter:**
```javascript
// Relay API uses network as query parameter
walletAPI.getDelegation(address, nodeAddress, network)
// → GET /v1/delegator/{address}/delegation?node_address=xxx&network=dymension

v2DelegatedStakingAPI.getNodeDelegations(nodeAddress, network, page, pageSize)
// → GET /v2/delegated_staking/nodes/{address}/delegations?network=dymension
```

**3. Contract calls use network to select RPC & contract address:**
```javascript
// Reading: Use network's RPC URL
const provider = new ethers.JsonRpcProvider(config.networks[networkKey].rpcUrls[0])
const contractAddress = config.networks[networkKey].contracts.delegatedStaking

// Writing: MetaMask must be on the correct chain first
await wallet.ensureNetworkOnWallet(networkKey)
const signer = await createBrowserSigner() // Uses MetaMask's current chain
```

### Two Network Contexts

1. **Wallet Store Network** (`wallet.selectedNetworkKey`)
   - Represents the user's selected network in the UI
   - Should stay in sync with MetaMask
   - Used by most components for API calls

2. **Node Network** (from API response)
   - Each node belongs to a specific blockchain
   - Some components (like `my-delegation.vue`) use the node's network instead

### Network Switching Pattern

**Standard pattern (most components):**
```javascript
// Uses wallet.selectedNetworkKey
const networkKey = wallet.selectedNetworkKey
await someAPI.getData(networkKey)
```

**Node-specific pattern (e.g., my-delegation.vue):**
```javascript
// Uses props.network (node's blockchain) for data
await walletAPI.getDelegation(wallet.address, nodeAddress, props.network)

// Before transaction, switch MetaMask to node's network (also updates store)
await wallet.ensureNetworkOnWallet(props.network)
await delegatedStakingService.stake(props.network, nodeAddress, amount)
```

---

## Authentication

For detailed authentication flow and implementation, see **[docs/auth.md](./auth.md)**.

**Quick summary:**
- Wallet signs a message → sends to Relay → gets JWT auth token
- V1 API requires auth token, V2 API is public
- Auth token stored in `stores/auth.js`, wallet connection handled by `stores/wallet.js`

---

## Contract Interaction Pattern

### Reading Data (No Wallet Needed)

```javascript
// services/contract.js
export function createReadProvider(networkKey) {
  const url = config.networks[networkKey].rpcUrls[0]
  return new ethers.JsonRpcProvider(url)
}

// Usage in services/delegated-staking.js
function getReadContract(networkKey) {
  const address = getContractAddress(networkKey, 'delegatedStaking')
  const provider = createReadProvider(networkKey)
  return new ethers.Contract(address, abi, provider)
}
```

### Writing Data (Requires MetaMask)

```javascript
// services/contract.js
export async function createBrowserSigner() {
  const provider = new ethers.BrowserProvider(window.ethereum)
  return provider.getSigner()
}

// Usage in services/delegated-staking.js
async function getWriteContract(networkKey) {
  const address = getContractAddress(networkKey, 'delegatedStaking')
  const signer = await createBrowserSigner()
  return new ethers.Contract(address, abi, signer)
}
```

---

## Error Handling

### Contract Errors

```javascript
import { isUserRejectedError } from '@/services/contract'

try {
  await delegatedStakingService.stake(network, nodeAddress, amount)
} catch (e) {
  if (isUserRejectedError(e)) {
    message.error('Transaction rejected')
  } else {
    message.error('Staking failed: ' + (e.reason || e.message))
  }
}
```

### API Errors

Use Ant Design Vue `message` for user feedback:
```javascript
import { message } from 'ant-design-vue'

try {
  await someAPI.doSomething()
} catch (e) {
  console.error('Operation failed:', e)
  message.error('Operation failed')
}
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `stores/wallet.js` | Wallet connection, auth, network switching |
| `stores/auth.js` | Session token management |
| `services/contract.js` | Provider creation, contract utilities |
| `services/delegated-staking.js` | Staking contract operations |
| `api/v1/wallet.js` | Wallet-related REST APIs |
| `api/v2/delegated-staking.js` | Node listing, delegation APIs |
| `config.json` | Network & contract configuration |

---

## Common Patterns

### Fetching Data on Mount

```javascript
onMounted(async () => {
  if (wallet.isConnected) {
    await fetchData()
  }
})

watch(() => wallet.isConnected, (connected) => {
  if (connected) {
    fetchData()
  }
})
```

### Transaction with Network Switch

```javascript
async function submitTransaction() {
  try {
    // 1. Switch to correct network (also updates store)
    await wallet.ensureNetworkOnWallet(targetNetwork)

    // 2. Execute transaction
    await contractService.doSomething(targetNetwork, ...)

    // 3. Refresh state
    await wallet.refreshAccountAndBalance()
    message.success('Transaction successful')
  } catch (e) {
    if (isUserRejectedError(e)) {
      message.error('Transaction rejected')
    } else {
      message.error('Transaction failed')
    }
  }
}
```
