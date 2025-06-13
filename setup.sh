#!/bin/bash

echo "🚀 Setting up Dheenotifications Enterprise System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️ Docker is not installed. You'll need to set up PostgreSQL and Redis manually.${NC}"
fi

echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Setup Backend
echo -e "${YELLOW}📦 Setting up Backend...${NC}"
cd backend
npm install
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

# Setup Frontend
echo -e "${YELLOW}📦 Setting up Frontend...${NC}"
cd ../frontend
npm install
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"

cd ..

# Create environment files if they don't exist
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}📝 Creating backend .env file...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}⚠️ Please update backend/.env with your actual credentials${NC}"
fi

if [ ! -f frontend/.env.local ]; then
    echo -e "${YELLOW}📝 Creating frontend .env.local file...${NC}"
    cp frontend/.env.example frontend/.env.local
fi

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Update backend/.env with your database and service credentials"
echo "2. Start PostgreSQL and Redis (or use Docker)"
echo "3. Run 'cd backend && npx prisma migrate dev' to setup database"
echo "4. Run 'cd backend && npm run dev' to start backend"
echo "5. Run 'cd frontend && npm run dev' to start frontend"
echo ""
echo -e "${GREEN}🚀 Your enterprise notification system is ready!${NC}"