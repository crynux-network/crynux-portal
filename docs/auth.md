# Authentication

This document explains the authentication mechanism used in Crynux Portal.

## Overview

| Concept | What it is | Purpose |
|---------|------------|---------|
| **Wallet (MetaMask)** | Browser extension holding private key | Sign messages, send transactions on blockchain |
| **Auth Token (JWT)** | Token from Relay API | Prove wallet ownership to Relay for API calls |

### Connected vs Authenticated

- **Connected**: The user has authorized our app to access their MetaMask wallet address. This only means we know their address - we can't do anything else yet.

- **Authenticated**: The user has signed a message with their wallet and exchanged that signature for a JWT token from Relay API. This proves they own the wallet and allows authenticated API calls.

### State Consistency

In theory, these are two separate states. A user could be "connected but not authenticated" (we know their address, but they haven't signed for a token).

**However, this app does NOT allow that state.**

We always keep connection and authentication in sync:
- When user clicks "Connect", we immediately do the full authentication flow
- If authentication fails, we also disconnect the wallet
- If wallet disconnects or switches account, we also clear the authentication

This means the app only has two possible states:
1. **Not connected** - user sees "Connect" button
2. **Fully authenticated** - user sees their address and can use all features

This simplifies the app: components only need to check one thing (authenticated or not), and there's no confusing "connected but can't do anything" state.

## Two Stores

### Auth Store (`stores/auth.js`)

| State | Description |
|-------|-------------|
| `sessionToken` | JWT token from Relay API |
| `sessionExpiresAt` | Token expiration timestamp |
| `sessionAddress` | Authenticated wallet address |

| Getter | Description |
|--------|-------------|
| `isAuthenticated` | `true` if valid token exists and not expired |
| `isAuthenticating` | `true` if authentication is in progress |

### Wallet Store (`stores/wallet.js`)

| State | Description |
|-------|-------------|
| `address` | Current MetaMask address |
| `isConnected` | `true` if MetaMask has connected account |
| `balanceWei` | Wallet balance |

### State Consistency (Implementation)

As explained in Overview, these two stores are always kept in sync:

| State | `wallet.isConnected` | `auth.isAuthenticated` |
|-------|----------------------|------------------------|
| Not connected | `false` | `false` |
| Fully authenticated | `true` | `true` |

How it's enforced:
- `authenticate()` connects wallet first, then gets auth token
- `clearSession()` / `$reset()` clears both stores together
- If authentication fails, wallet connection is revoked

**Always use `auth.isAuthenticated` in components** (it implies `wallet.isConnected`):

```vue
<!-- Correct -->
<template v-if="auth.isAuthenticated">
  <!-- Authenticated content -->
</template>
<template v-else>
  <button @click="connect">Connect Wallet</button>
</template>
```

## Authentication Flow

```
User clicks "Connect"
        │
        ▼
auth.authenticate()
        │
        ▼
wallet.connect()                    MetaMask
        │                               │
        │  eth_requestAccounts          │
        │ ────────────────────────────► │
        │                               │
        │  Returns: [address]           │
        │ ◄──────────────────────────── │
        ▼
personal_sign                       MetaMask
        │                               │
        │  Sign message with key        │
        │ ────────────────────────────► │
        │                               │
        │  Returns: signature           │
        │ ◄──────────────────────────── │
        ▼
walletAPI.connectWallet()           Relay API
        │                               │
        │  POST /v1/client/connect_wallet
        │  { address, signature, timestamp }
        │ ────────────────────────────► │
        │                               │
        │  { token, expires_at }        │
        │ ◄──────────────────────────── │
        ▼
auth.setSession(token, expires_at, address)
        │
        ▼
    ┌─────────────────┬─────────────────┐
    │  Wallet Store   │   Auth Store    │
    │  - address      │  - sessionToken │
    │  - isConnected  │  - sessionAddr  │
    │  - balanceWei   │  - expiresAt    │
    └─────────────────┴─────────────────┘
```

## Session Lifecycle

### Sign Out (from Header)

```
wallet.disconnect()
        │
        ├── wallet_revokePermissions (MetaMask)
        ├── auth.$reset()      → isAuthenticated = false
        └── wallet.$reset()    → isConnected = false
```

### Disconnect (from MetaMask)

```
accountsChanged event (address = null)
        │
        ▼
refreshAccountAndBalance()
        │
        ├── setAccount(null)       → isConnected = false
        └── auth.clearSession()    → isAuthenticated = false
```

### Account Switch (in MetaMask)

When user switches to a different account:

```
accountsChanged event (address = newAddress)
        │
        ▼
refreshAccountAndBalance()
        │
        ├── Detect: newAddress ≠ sessionAddress
        ├── auth.clearSession()        → isAuthenticated = false
        ├── setAccount(newAddress)     → wallet.address updated
        └── return { changed: true }
        │
        ▼
App.vue: promptReauth()
        │
        ▼
Modal: "Your wallet account changed. Please re-authenticate."
```

Key code in `refreshAccountAndBalance()`:

```javascript
const mismatchWithSession = !!(address && sessionAddr &&
  sessionAddr.toLowerCase() !== address.toLowerCase())

if (address) {
  await this.fetchBalance()
  if (mismatchWithSession) {
    auth.clearSession()
  }
} else {
  this.setBalanceWei('0x0')
  auth.clearSession()
}

return { address, changed: mismatchWithSession || addressChanged }
```

## API Usage

Auth token is automatically attached to V1 API requests:

```javascript
// In v1.js
this.httpClient.interceptors.request.use((cfg) => {
  const token = this._getAuthToken()
  if (token) {
    cfg.headers['Authorization'] = `Bearer ${token}`
  }
  return cfg
})
```

| API | Auth Required | Use Case |
|-----|---------------|----------|
| V1 API | Yes | Wallet-specific operations (withdrawals, delegations) |
| V2 API | No | Public data (node listings, network stats) |

## Related Files

| File | Purpose |
|------|---------|
| `stores/auth.js` | Auth store - `authenticate()`, session management |
| `stores/wallet.js` | Wallet store - `connect()`, balance, network |
| `api/v1/v1.js` | V1 API client with auth token interceptor |
| `api/v1/wallet.js` | `connectWallet()` API to exchange signature for token |
| `App.vue` | MetaMask event listeners, re-auth modal |
