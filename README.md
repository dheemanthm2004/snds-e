# 🚀 Dheenotifications - Enterprise Notification System

A production-ready, scalable notification system supporting Email, SMS, and In-App notifications with advanced features like templates, batch processing, analytics, and real-time monitoring.

## 🌟 Features

### Core Functionality
- ✅ **Multi-Channel Notifications**: Email, SMS, In-App
- ✅ **Real-time Delivery**: WebSocket-based instant notifications
- ✅ **Scheduled Notifications**: Cron-based scheduling system
- ✅ **Queue Processing**: Redis + BullMQ for reliable delivery
- ✅ **Retry Mechanism**: Exponential backoff for failed deliveries

### Enterprise Features
- 🔐 **Authentication & Authorization**: JWT + API Keys + Role-based access
- 📊 **Analytics Dashboard**: Real-time metrics and delivery tracking
- 📝 **Template System**: Reusable notification templates
- 📦 **Batch Processing**: Send notifications to multiple recipients
- 🛡️ **Rate Limiting**: Protection against abuse
- 📈 **Monitoring**: Health checks and performance metrics
- 🔍 **Advanced Logging**: Structured logging with error tracking

### Security
- 🔒 **Input Validation**: Comprehensive request validation
- 🛡️ **Error Handling**: Secure error responses
- 🔑 **API Security**: Rate limiting and authentication
- 📝 **Audit Logging**: Complete activity tracking

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Services      │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   (External)    │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • REST API      │    │ • Email (SMTP)  │
│ • Analytics     │    │ • WebSocket     │    │ • SMS (Twilio)  │
│ • Templates     │    │ • Queue Worker  │    │ • Database      │
│ • Batch Send    │    │ • Scheduler     │    │ • Redis         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### Installation

1. **Clone and Setup**
   ```bash
   git clone <your-repo>
   cd dheenotifications-enhanced
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure Environment**
   ```bash
   # Update backend/.env with your credentials
   cp backend/.env.example backend/.env
   
   # Update frontend/.env.local
   cp frontend/.env.example frontend/.env.local
   ```

3. **Database Setup**
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Start Services**
   ```bash
   # Terminal 1: Backend API
   cd backend
   npm run dev
   
   # Terminal 2: Background Worker
   cd backend
   npm run worker
   
   # Terminal 3: Frontend
   cd frontend
   npm run dev
   ```

## 📖 API Documentation

### Authentication
```bash
# Register new user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Notifications
```bash
# Send immediate notification
POST /api/notify
Authorization: Bearer <token>
{
  "to": "recipient@example.com",
  "channel": "email",
  "message": "Hello World",
  "templateId": "optional-template-id"
}

# Schedule notification
POST /api/notify
Authorization: Bearer <token>
{
  "to": "recipient@example.com",
  "channel": "email",
  "message": "Scheduled message",
  "sendAt": "2024-12-25T10:00:00Z"
}

# Batch notifications
POST /api/notify/batch
Authorization: Bearer <token>
{
  "recipients": ["user1@example.com", "user2@example.com"],
  "channel": "email",
  "message": "Batch notification",
  "templateId": "welcome-template"
}
```

### Templates
```bash
# Create template
POST /api/templates
Authorization: Bearer <token>
{
  "name": "Welcome Email",
  "subject": "Welcome {{name}}!",
  "content": "Hello {{name}}, welcome to our platform!",
  "channel": "email"
}

# Use template
POST /api/notify
Authorization: Bearer <token>
{
  "to": "user@example.com",
  "channel": "email",
  "templateId": "welcome-template",
  "variables": {
    "name": "John Doe"
  }
}
```

## 📊 Dashboard Features

### Analytics
- Real-time delivery metrics
- Success/failure rates
- Channel performance
- Historical trends

### Template Management
- Create/edit templates
- Variable substitution
- Preview functionality
- Usage statistics

### Batch Operations
- CSV upload for recipients
- Progress tracking
- Delivery reports

### User Management
- Role-based access control
- API key management
- Activity logs

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/dheenotifications"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
TWILIO_PHONE="+1234567890"

# Rate Limiting
RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"
```

**Frontend (.env.local)**
```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000/api"
NEXT_PUBLIC_WS_URL="http://localhost:4000"
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## 📈 Monitoring

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status

### Metrics
- Delivery rates by channel
- Queue processing times
- Error rates and types
- System resource usage

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis connection established
- [ ] SSL certificates installed
- [ ] Rate limiting configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern TypeScript stack
- Powered by Next.js and Express
- Queue processing by BullMQ
- Real-time features with Socket.IO

---

**Made with ❤️ by Dheemanth M**

For questions or support, please open an issue or contact [dheemanthmadaiah@gmail.com](mailto:dheemanthmadaiah@gmail.com)