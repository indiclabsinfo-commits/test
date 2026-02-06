# 🚀 Tacticash Arena - Quick Start Guide

## 1-Minute Setup (macOS)

### Prerequisites Check
```bash
node --version  # Should be 18+
psql --version  # Should be 14+
redis-server --version  # Should be 6+
```

### Auto Setup (Recommended)
```bash
./setup.sh
```

### Manual Setup

```bash
# 1. Install dependencies
npm install
cd server && npm install && cd ..

# 2. Create database
createdb tacticash
psql tacticash < server/database/schema.sql

# 3. Setup environment
cp .env.example .env
cp server/.env.example server/.env

# Edit server/.env:
# - Set DB_PASSWORD
# - Generate JWT_SECRET (random string)
# - Generate JWT_REFRESH_SECRET (random string)
# - Generate SERVER_SEED_SECRET (random string)

# 4. Start Redis
brew services start redis

# 5. Start servers (3 terminals)
# Terminal 1:
cd server && npm run dev

# Terminal 2:
npm run dev

# Terminal 3:
# Test API
curl http://localhost:3001/health
```

## Access Points

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001
- **WebSocket:** ws://localhost:3001/ws
- **Health Check:** http://localhost:3001/health

## First API Call

```bash
# Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testplayer",
    "email": "test@example.com",
    "password": "password123"
  }'

# Response will include accessToken and refreshToken
# Save the accessToken for next calls
```

## Test WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001/ws?token=YOUR_TOKEN');

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

// Place a crash bet
ws.send(JSON.stringify({
  type: 'place_bet',
  game: 'crash',
  data: { betAmount: 10, autoCashout: 2.0 }
}));
```

## Common Issues

**Database Connection Error**
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Start if needed
brew services start postgresql@14
```

**Redis Connection Error**
```bash
# Check Redis is running
brew services list | grep redis

# Start if needed
brew services start redis
```

**Port Already in Use**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill

# Kill process on port 5173
lsof -ti:5173 | xargs kill
```

## File Structure

```
game/
├── src/                    # Frontend
│   ├── components/        # React components
│   ├── contexts/          # State management
│   ├── services/          # API & WebSocket
│   └── utils/             # Helpers & sounds
├── server/                # Backend
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Game logic
│   │   ├── middleware/   # Auth, validation
│   │   ├── utils/        # Helpers
│   │   └── config/       # DB, Redis
│   └── database/         # SQL schema
├── README.md             # Overview
├── IMPLEMENTATION_GUIDE.md  # Detailed guide
└── COMPLETED_WORK_SUMMARY.md  # What's done
```

## Next Steps

1. ✅ Setup complete? → Read IMPLEMENTATION_GUIDE.md
2. 🔌 Connect frontend to backend
3. 🎮 Test all games
4. 💳 Add payment integration
5. 🚀 Deploy to production

## Useful Commands

```bash
# Frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend
cd server
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm start            # Start production server

# Database
psql tacticash                    # Open DB shell
psql tacticash -c "SELECT * FROM users;"  # Query
psql tacticash < schema.sql      # Run migrations

# Redis
redis-cli                        # Open Redis shell
redis-cli PING                   # Test connection
redis-cli KEYS *                 # List all keys
```

## Environment Variables Quick Reference

### Backend (server/.env)
```env
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/tacticash
REDIS_HOST=localhost
JWT_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>
SERVER_SEED_SECRET=<random-string>
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
```

## Testing Checklist

- [ ] Backend health check responds
- [ ] Can register new user
- [ ] Can login
- [ ] Can get user profile
- [ ] Can place bet (via API or WebSocket)
- [ ] Balance updates correctly
- [ ] Transactions are recorded
- [ ] WebSocket connects successfully
- [ ] Frontend displays correctly
- [ ] Sounds play (check browser console if not)

## Support

- 📖 Full docs: IMPLEMENTATION_GUIDE.md
- ✅ What's done: COMPLETED_WORK_SUMMARY.md
- 📝 Project overview: README.md
- 🐛 Issues: Check console logs & database

---

**Happy coding! 🎰**
