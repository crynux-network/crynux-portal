# Authentication

This document explains the authentication mechanism used in Crynux Portal.

## Wallet vs Auth Token

**These are two different things:**

| Concept | What it is | Purpose |
|---------|------------|---------|
| **Wallet (MetaMask)** | Browser extension holding private key | Sign messages, send transactions on blockchain |
| **Auth Token (JWT)** | Token from Relay API | Prove wallet ownership to Relay for API calls |

## Auth Store (`stores/auth.js`)

**State:**
- `sessionToken` - JWT token from Relay API
- `sessionExpiresAt` - Token expiration timestamp
- `sessionAddress` - Authenticated wallet address

**Key Actions:**

| Action | Description |
|--------|-------------|
| `authenticate()` | Full auth flow: connect wallet → sign → get token |
| `setSession()` | Store token and expiration |
| `clearSession()` | Clear auth state |

**Usage:**
```javascript
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
await auth.authenticate()  // Full authentication
```

## How Authentication Works

```
auth.authenticate()
        │
        ▼
    wallet.connect()
        │ (Get address from MetaMask)
        ▼
    personal_sign
        │ (Sign message with private key)
        ▼
    walletAPI.connectWallet()             Relay API
        │                                     │
        │  POST /v1/client/connect_wallet     │
        │  { address, signature, timestamp }  │
        │ ──────────────────────────────────► │
        │                                     │
        │  Response: { token, expires_at }    │
        │ ◄────────────────────────────────── │
        ▼
    auth.setSession(token)
        │
        ▼
    Wallet Store              Auth Store
    - address                 - sessionToken (JWT)
    - balanceWei              - sessionExpiresAt
    - isConnected             - sessionAddress
```

**The flow:**
1. **Connect wallet** via `wallet.connect()` (get address from MetaMask)
2. **Sign a message** with wallet's private key (`personal_sign`)
3. **Send signature to Relay** → Relay verifies the signature matches the address
4. **Relay returns auth token** → Stored in `auth.js` store
5. **Subsequent Relay API calls** use this token to prove wallet ownership

## Auth Token Usage

Some Relay APIs require authentication to verify wallet identity. The token is automatically attached via interceptor:

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

**V1 API**: Requires auth token (wallet-specific operations like withdrawals)
**V2 API**: No auth required (public data like node listings)

## Related Files

| File | Purpose |
|------|---------|
| `stores/auth.js` | Auth store - `authenticate()`, session management |
| `stores/wallet.js` | Wallet store - `connect()` (minimal, MetaMask only) |
| `api/v1/v1.js` | V1 API client with auth token interceptor |
| `api/v1/wallet.js` | `connectWallet()` API to exchange signature for token |
