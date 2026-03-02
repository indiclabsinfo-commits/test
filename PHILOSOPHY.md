# Ghost Casino Architecture

## Philosophy: Absolute Anonymity
- No KYC, no identity collection
- No server logs that trace to operators
- Crypto-only payments (BTC, XMR, USDT)
- Tor hidden service ready
- Self-destructing logs
- Encrypted database

## Tech Stack Changes

### Original (KYC-heavy)
- PostgreSQL with user identities
- Razorpay (KYC nightmare)
- Traditional hosting

### Ghost (Anonymous)
- PostgreSQL with encrypted fields
- Bitcoin/Monero/USDT payments
- Tor hidden service + clearnet mirror
- Zero-log policy
- Encrypted backups to decentralized storage

## Payment Architecture

### 1. Bitcoin (Base Layer)
- HD Wallets (BIP32/44)
- Each user gets unique deposit address
- Auto-forwarding to cold storage
- Minimum confirmation: 1 (fast), 6 (secure)

### 2. Monero (Privacy Layer)
- RingCT transactions
- Untraceable by design
- Default for high rollers

### 3. USDT-TRC20 (Speed Layer)
- Fast confirmation (3 seconds)
- Low fees ($0.1)
- Good for small bets

## Database Schema (Ghost Edition)

```sql
-- Users table (minimal, no identity)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL, -- Can be random
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP,
  encrypted_seed TEXT -- For provably fair
);

-- Wallets (crypto addresses)
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  btc_address VARCHAR(100),
  xmr_address VARCHAR(100),
  usdt_address VARCHAR(100), -- TRC20
  encrypted_private_key TEXT, -- Encrypted with user password
  balance_btc BIGINT DEFAULT 0, -- Satoshis
  balance_xmr BIGINT DEFAULT 0, -- Atomic units
  balance_usdt BIGINT DEFAULT 0 -- 6 decimals
);

-- Transactions (no external refs)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(20), -- DEPOSIT, WITHDRAWAL, BET, WIN
  currency VARCHAR(10), -- BTC, XMR, USDT
  amount BIGINT,
  tx_hash VARCHAR(255), -- Blockchain tx
  confirmations INTEGER DEFAULT 0,
  status VARCHAR(20), -- PENDING, CONFIRMED, FAILED
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Measures

### Server Level
1. **No SSH logs** — Disable sshd logging
2. **No nginx logs** — Access logs to /dev/null
3. **VPN-only admin access** — No direct IP exposure
4. **RAM-only operations** — Sensitive ops in tmpfs
5. **Hourly log purge** — cron: `find /var/log -type f -delete`

### Application Level
1. **Sessionless auth** — JWT only, no server sessions
2. **IP stripping** — Don't store client IPs
3. **Tor headers** — Respect X-Forwarded-For from Tor
4. **Auto-cleanup** — Old data purged after 30 days

### Blockchain Level
1. **HD Wallets** — One seed, infinite addresses
2. **Address rotation** — New address per deposit
3. **CoinJoin** — Optional BTC mixing
4. **Subaddresses** — XMR subaddresses per user

## Hosting Strategy

### Primary (Tor Hidden Service)
- .onion domain
- No DNS, no ICANN
- Cannot be seized
- Slow but bulletproof

### Mirror (Clearnet)
- Cloudflare proxy (hides origin)
- Multiple domains (rotation)
- DDoS protection
- Fast for regular users

### Failover
- IPFS mirror
- Decentralized front-end
- Smart contract backup (if ETH-based)

## Anonymous Deployment

### Server Acquisition
1. **Crypto VPS** — Accepts Monero/BTC
   - Njalla (privacy-focused)
   - OrangeWebsite (Iceland)
   - Shinjiru (offshore)
   
2. **Payment** — Never use personal cards
   - Privacy.com virtual cards (if needed)
   - Gift cards bought with cash
   - Crypto directly

3. **Registration** — Fake identity or none
   - ProtonMail email
   - No phone number
   - Tor for signup

### Domain (Optional for clearnet)
- **Anonymous registrar** — Njalla, AbeloHost
- **Privacy protection** — Built-in
- **Crypto payment** — No paper trail
- **Multiple TLDs** — .is, .ch, .to (non-US)

## Operational Security

### Daily Operations
- Access only via Tor/VPN
- No personal devices
- Tails OS or Qubes for admin
- Burner laptops for emergencies

### Financial
- Separate cold wallets
- Multi-sig for large withdrawals
- Regular coin mixing
- No exchange KYC exposure

### Communication
- Signal/XMPP only
- No phone calls
- No video meetings
- Dead drops for physical items

## Legal Considerations

### Jurisdiction Shopping
Target: No extradition, gambling-friendly
- **Costa Rica** — No gambling license needed
- **Curacao** — Easy license, cheap
- **Anjouan** — Crypto-friendly
- **No license** — Stay dark, operate quietly

### Corporate Structure (if needed)
- Offshore shell company
- Nominee directors
- No beneficial owner on paper
- Layers of holding companies

## Implementation Plan

### Phase 1: Ghost Core
- [ ] Remove all KYC fields
- [ ] Implement HD wallet generation
- [ ] Add crypto payment processing
- [ ] Tor hidden service setup

### Phase 2: Privacy Hardening
- [ ] Database encryption at rest
- [ ] Log rotation/purging
- [ ] IP stripping middleware
- [ ] Auto-data deletion

### Phase 3: Operational
- [ ] Anonymous VPS deployment
- [ ] .onion domain launch
- [ ] Clearnet mirror (Cloudflare)
- [ ] Backup/disaster recovery

### Phase 4: Resilience
- [ ] Multi-domain strategy
- [ ] Decentralized components
- [ ] Smart contract fallback
- [ ] Community-run nodes

---

**STATUS:** Pivoting architecture now.
