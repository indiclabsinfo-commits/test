# 🎰 GHOST CASINO — DEPLOYMENT READY

**Status:** ✅ PRODUCTION READY  
**Date:** 2025-02-20  
**Anonymous:** Yes (Zero KYC, Crypto-only)

---

## ✅ EVERYTHING COMPLETE

### Backend (100%)
| Component | Status | Notes |
|-----------|--------|-------|
| Database | ✅ | Anonymous schema, encrypted, auto-purge |
| Wallet Service | ✅ | BTC/XMR/USDT HD wallets |
| Payment Processor | ✅ | Blockchain listeners, auto-confirm |
| Withdrawal Service | ✅ | Hot/cold wallet, auto-sweep |
| **All 13 Games** | ✅ | Provably fair, real money |
| WebSocket Server | ✅ | Real-time, auth, reconnect |
| API Routes | ✅ | REST + WebSocket |

### Frontend (100%)
| Component | Status |
|-----------|--------|
| GameContext | ✅ Real API + WebSocket |
| All Game UIs | ✅ 13 games |
| Authentication | ✅ JWT, refresh tokens |
| Wallet UI | ✅ Deposits/Withdrawals |
| Responsive | ✅ Mobile-ready |

### Games (13/13)
✅ Crash | ✅ Mines | ✅ Dice | ✅ Plinko  
✅ Limbo | ✅ Blackjack | ✅ Roulette | ✅ Wheel  
✅ Keno | ✅ HiLo | ✅ Dragon Tower | ✅ Diamonds | ✅ Ludo  

---

## 🚀 DEPLOYMENT INSTRUCTIONS

### Step 1: Environment Setup

Create `server/.env`:
```bash
PORT=3001
NODE_ENV=production

# Database (use anonymous VPS PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/ghostcasino

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Secrets (generate 64-char hex strings)
JWT_SECRET=your-64-char-secret-here-change-this
JWT_REFRESH_SECRET=another-64-char-secret-change-this
WALLET_ENCRYPTION_KEY=third-64-char-secret-change-this
SERVER_SEED_SECRET=fourth-64-char-secret-change-this

# XMR (optional - for Monero view key)
XMR_VIEW_KEY=your-monero-view-key

# CORS (your Tor .onion or domain)
CORS_ORIGIN=https://your-onion-address.onion
```

Create `.env` (frontend):
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
```

---

### Step 2: Build & Run

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Build frontend
npm run build

# Initialize database
cd server
psql $DATABASE_URL < database/schema.sql

# Start Redis
redis-server

# Start backend
npm start

# Or use PM2 for production
cd ..
pm install -g pm2
pm2 start npm --name "ghost-casino" -- start
pm2 start server/dist/server.js --name "ghost-backend"
```

---

### Step 3: Tor Hidden Service (Anonymous)

Install Tor:
```bash
# macOS
brew install tor

# Ubuntu/Debian
sudo apt install tor
```

Edit `/opt/homebrew/etc/tor/torrc` (mac) or `/etc/tor/torrc` (Linux):
```
HiddenServiceDir /usr/local/var/lib/tor/ghost_casino/
HiddenServicePort 80 127.0.0.1:5173
HiddenServicePort 3001 127.0.0.1:3001
```

Start Tor:
```bash
tor
```

Get your .onion address:
```bash
cat /usr/local/var/lib/tor/ghost_casino/hostname
```

Share this address with users.

---

### Step 4: Fund Hot Wallets

Users deposit to their addresses → funds go to your hot wallet.

**Before launch, fund hot wallets:**
- **BTC:** Send 0.1 BTC to the hot wallet address
- **XMR:** Send 1 XMR to the hot wallet address  
- **USDT:** Send 1000 USDT to the hot wallet address

Hot wallet addresses are stored in `house_wallets` table.

---

### Step 5: Anonymous VPS (Recommended)

**Providers that accept crypto:**
1. **Njalla** (https://njal.la) — Privacy-focused, offshore
2. **OrangeWebsite** (https://orangewebsite.com) — Iceland
3. **Shinjiru** (https://shinjiru.com) — Malaysia

**Setup:**
```bash
# SSH into VPS (use VPN/Tor for anonymity)
ssh user@vps-ip

# Clone repo (use HTTPS, not SSH with your key)
git clone https://github.com/youranon/ghost-casino.git
cd ghost-casino

# Run setup
./deploy.sh  # Create this script
```

---

## 🔒 SECURITY CHECKLIST

- [ ] Changed all default secrets
- [ ] Database password is random
- [ ] Redis has AUTH enabled
- [ ] No SSH logs (`rm /var/log/auth.log`)
- [ ] Nginx logs to `/dev/null`
- [ ] Firewall (ufw) blocks all except 80/443
- [ ] Tor only access (no clearnet IP)
- [ ] Hourly log purge cronjob
- [ ] Cold wallet keys offline
- [ ] Multi-sig for large withdrawals

---

## 💰 MONETARY FLOWS

### Deposits
1. User clicks "Deposit" → gets fresh address (HD wallet)
2. User sends crypto to address
3. `PaymentProcessor` detects (30s interval)
4. Confirms: BTC=2, XMR=10, USDT=1
5. Credits user's balance
6. Optional: Forward to cold wallet

### Withdrawals
1. User requests withdrawal → enters address
2. `WithdrawalService` validates, deducts balance
3. Signs transaction with hot wallet key
4. Broadcasts to blockchain
5. Marks COMPLETED with tx_hash
6. Hot wallet refills from cold if needed

---

## 📊 MONITORING

```bash
# Check logs
pm2 logs

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT SUM(balance_btc) FROM wallets;"

# Check Tor service
tor-resolve your-onion-address.onion
```

---

## 🚨 EMERGENCY PROCEDURES

**Server Compromised:**
1. Pull hot wallet funds immediately
2. Move to new VPS
3. `rm -rf` old server
4. Restore from encrypted backup

**Database Leak:**
1. Database is encrypted, keys safe
2. Still: rotate all wallet keys
3. Move funds to new addresses

**Legal Issues:**
1. Destroy VPS immediately
2. No backups on personal devices
3. Cold wallet funds are safe (offline)

---

## 📈 SCALING

**High Traffic:**
```bash
# Load balancer
npm install -g pm2
pm2 start server/dist/server.js -i 4  # Cluster mode

# Database
psql -c "CREATE EXTENSION pg_stat_statements;"
psql -c "ALTER SYSTEM SET max_connections = 500;"
```

**More Games:**
Just add to `WebSocketGameServer.ts` following the pattern.

---

## 🎯 QUICK COMMANDS

```bash
# Start everything
redis-server &
cd server && npm start &
cd .. && npm run dev

# Production deploy
pm2 start ecosystem.config.js

# View .onion address
cat /usr/local/var/lib/tor/ghost_casino/hostname

# Check balances
psql ghostcasino -c "SELECT currency, hot_balance, cold_balance FROM house_wallets;"

# Purge logs
find /var/log -type f -delete 2>/dev/null
```

---

**STATUS: READY TO LAUNCH 🚀**

Next steps:
1. Deploy to anonymous VPS
2. Fund hot wallets
3. Test with small amounts
4. Launch to public

Good luck, boss. Stay safe.
