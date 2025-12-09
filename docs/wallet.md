# Wallet Store & MetaMask

This document explains the wallet store and its relationship with MetaMask.

## Wallet Store (`stores/wallet.js`)

Manages MetaMask wallet connection and state. **This is the central place for all wallet operations.**

**State:**
- `address` - Connected wallet address
- `selectedNetworkKey` - Currently selected network ('dymension' | 'near')
- `balanceWei` - Wallet balance in wei (hex string)
- `isConnected` - Whether wallet is connected

**Key Actions:**

| Action | Description |
|--------|-------------|
| `connect()` | Minimal: just connect MetaMask and get address |
| `disconnect()` | Revoke permissions, clear auth & wallet state |
| `refreshAccountAndBalance()` | Sync wallet state with MetaMask |
| `ensureNetworkOnWallet(networkKey)` | Switch MetaMask to specified network and update store |
| `fetchBalance()` | Fetch and update wallet balance |

**Usage:**
```javascript
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'

const wallet = useWalletStore()
const auth = useAuthStore()

// Just connect wallet (no auth)
await wallet.connect()

// Full authentication (connect + sign + get token)
await auth.authenticate()
```

## Wallet vs Auth Separation

```
┌─────────────────────────────────────────────────────────────┐
│                     wallet.connect()                         │
│                  (Minimal - MetaMask only)                   │
├─────────────────────────────────────────────────────────────┤
│  eth_requestAccounts → get address → set wallet state       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    auth.authenticate()                       │
│              (Full authentication with Relay)                │
├─────────────────────────────────────────────────────────────┤
│  1. wallet.connect()          (get address)                  │
│  2. personal_sign             (sign message)                 │
│  3. walletAPI.connectWallet() (exchange for token)           │
│  4. auth.setSession()         (store JWT)                    │
│  5. ensureNetworkOnWallet()   (switch network)               │
│  6. refreshAccountAndBalance()(sync state)                   │
└─────────────────────────────────────────────────────────────┘
```

**When to use which:**
- `wallet.connect()` - just need wallet address, no Relay API calls needed
- `auth.authenticate()` - need to call authenticated Relay APIs (v1)

For detailed auth token explanation, see **[docs/auth.md](./auth.md)**.

## Wallet Store vs MetaMask

```
┌────────────────────┐          ┌────────────────────┐
│     config.json    │          │     MetaMask       │
├────────────────────┤          │  (Browser wallet)  │
│ networks:          │          ├────────────────────┤
│  - dymension       │          │ - accounts         │
│  - near            │          │ - active chain     │
│  (chainId, rpc...) │          │ - balance          │
└────────────────────┘          └────────────────────┘
        │                                ▲
        │                                │
        ▼                                │
┌────────────────────┐                   │
│   Wallet Store     │                   │
│   (Pinia state)    │                   │
├────────────────────┤                   │
│ - selectedNetworkKey│──────────────────┘
│ - address          │◄──── read from MetaMask
│ - balanceWei       │◄──── read from MetaMask
│ - isConnected      │
└────────────────────┘
```

**Key relationships:**

| Wallet Store Field | Source | Description |
|--------------------|--------|-------------|
| `selectedNetworkKey` | config.json | Which network is active, used to switch MetaMask chain |
| `address` | MetaMask | Connected account address |
| `balanceWei` | MetaMask | Account balance on current chain |
| `isConnected` | Derived | Whether wallet is connected |

## Network Switching Flow

```
config.json                    Wallet Store               MetaMask
    │                              │                          │
    │  networks.dymension.chainId  │                          │
    └─────────────────────────────►│  ensureNetworkOnWallet() │
                                   │─────────────────────────►│
                                   │  wallet_switchEthereumChain
                                   │                          │
                                   │  selectedNetworkKey =    │
                                   │  'dymension'             │
```

**Important: App Network is Independent of MetaMask**

The app's `selectedNetworkKey` is the **single source of truth** for the current network:

| What | Source | Synced from MetaMask? |
|------|--------|----------------------|
| `address` | MetaMask | ✅ Yes |
| `balanceWei` | MetaMask | ✅ Yes |
| `selectedNetworkKey` | App only | ❌ No - never read from MetaMask |

- We **never read** MetaMask's current chainId
- We **only write** to MetaMask via `ensureNetworkOnWallet()` to switch it to our selected network
- If user switches network in MetaMask, the app ignores it - `selectedNetworkKey` stays unchanged
- `chainChanged` event only triggers `refreshAccountAndBalance()` (for balance), not network sync

## User Switches Network in MetaMask

If user manually switches to a different network in MetaMask:

| Aspect | Impact |
|--------|--------|
| Auth session | ✅ Not affected (token proves address ownership, not network) |
| App state | ✅ `wallet.selectedNetworkKey` unchanged |
| Browsing | ✅ User can continue browsing normally |
| Transactions | ⚠️ Would fail on wrong network |

**How it's handled:** All blockchain operations call `ensureNetworkOnWallet()` before executing:

```javascript
// Before any transaction
await wallet.ensureNetworkOnWallet(requiredNetwork)
await someBlockchainOperation()
```

This automatically switches MetaMask back to the correct network before the transaction.

## Related Files

| File | Purpose |
|------|---------|
| `stores/wallet.js` | Wallet store - connection, network switching, balance |
| `stores/auth.js` | Auth store - session token from Relay API |
| `config.json` | Network configuration (chainId, RPC URLs, contracts) |
| `App.vue` | Listens to MetaMask events, triggers refresh |
