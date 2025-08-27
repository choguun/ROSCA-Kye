# ROSCA Kye LINE@ Bot

Intelligent LINE@ bot for managing Korean Rotating Savings and Credit Associations (ROSCA) "Kye" circles with blockchain integration on Kaia network.

## 🌟 Features

### Core Functionality
- **Smart Contract Integration**: Real-time monitoring of KyeGroup contract events
- **Intelligent Notifications**: AI-powered personalized reminders and alerts
- **Multi-language Support**: Korean, English, and Japanese
- **Financial Intelligence**: Risk assessment and default prevention
- **Conversational AI**: Natural language processing for user interactions
- **Rich Messaging**: LINE Flex Messages with interactive elements

### Advanced Features
- **Event-Driven Architecture**: Responds to blockchain events in real-time
- **Behavioral Analytics**: Tracks user patterns for personalized experience
- **Grace Period Management**: Automated penalty calculations and reminders
- **Community Engagement**: Group-based messaging and celebrations
- **Security & Privacy**: Encrypted data storage and hashed user identities

## 🏗️ Architecture

```
linebot/
├── src/
│   ├── server.ts              # Main Express server
│   ├── types/                 # TypeScript type definitions
│   ├── services/              # Core business logic
│   │   ├── linebot.service.ts # LINE Bot SDK integration
│   │   ├── webhook.service.ts # Webhook event processing
│   │   └── notification.service.ts # Intelligent notifications
│   ├── blockchain/            # Blockchain integration
│   │   ├── monitor.ts         # Event monitoring system
│   │   ├── contracts.ts       # Contract interaction layer
│   │   └── events.ts          # Event handlers
│   ├── ai/                    # AI & Machine Learning
│   │   ├── intent.ts          # Intent recognition
│   │   ├── intelligence.ts    # Financial intelligence
│   │   └── personalization.ts # Personalized messaging
│   ├── templates/             # Message templates
│   │   ├── flex-messages.ts   # Rich message templates
│   │   └── i18n.ts           # Multi-language support
│   ├── database/              # Data layer
│   │   ├── schema.ts          # Database schema
│   │   ├── models.ts          # Data models
│   │   └── migrations.ts      # Database migrations
│   └── utils/                 # Utilities
│       ├── crypto.ts          # Encryption utilities
│       ├── validation.ts      # Input validation
│       └── logger.ts          # Logging system
└── tests/                     # Test suite
```

## 🚀 Quick Start

### Prerequisites
- Node.js ≥18.0.0
- LINE Developer Account
- Kaia Kairos Testnet access
- ngrok (for local webhook testing)

### Installation

1. **Clone and navigate to the project**:
   ```bash
   cd /path/to/ROSCA-Kye/linebot
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Initialize database**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Set up webhook URL** (in another terminal):
   ```bash
   npm run webhook:ngrok
   # Copy the HTTPS URL to LINE Developer Console
   ```

## 📋 LINE Developer Console Setup

### 1. Create Official Account
1. Go to [LINE Business ID](https://account.line.biz/)
2. Create a business account
3. Access [LINE Developers Console](https://developers.line.biz/)

### 2. Create Messaging API Channel
1. Click "Create New Channel" → "Messaging API"
2. Fill in channel information:
   - **Channel name**: "Kye Circle Bot"
   - **Channel description**: "Intelligent ROSCA savings circle management"
   - **Category**: "Finance"
   - **Region**: Your target region

### 3. Configure Channel Settings
1. **Basic Settings**:
   - Copy **Channel ID** and **Channel Secret**
   - Generate **Channel Access Token**
   
2. **Messaging API Settings**:
   - **Webhook URL**: `https://your-ngrok-url.ngrok.io/webhook`
   - **Use webhook**: Enabled
   - **Auto-reply messages**: Disabled
   - **Greeting messages**: Enabled (customize as needed)

3. **LINE Login Settings** (if using LIFF):
   - Create LIFF app
   - **Endpoint URL**: `https://your-domain.com`
   - **Scope**: `profile`, `openid`

## 🔧 Configuration

### Environment Variables

```env
# Required LINE Configuration
LINE_CHANNEL_ACCESS_TOKEN=channel_access_token_from_console
LINE_CHANNEL_SECRET=channel_secret_from_console
LINE_LIFF_ID=liff_id_if_using_liff_features

# Blockchain Integration (uses existing contract addresses)
KAIA_RPC_URL=https://public-en-kairos.node.kaia.io
USDT_CONTRACT_ADDRESS=0x8f198CD718aa1Bf2b338ddba78736E91cD254da6
KYE_FACTORY_ADDRESS=0x724f792F3d11C8eB1471e84ABef654c93cE639dE

# Integration with existing web app
WEB_APP_BASE_URL=http://localhost:3000
```

### Smart Contract Integration

The bot integrates with existing deployed contracts:
- **MockUSDT**: `0x8f198CD718aa1Bf2b338ddba78736E91cD254da6`
- **SavingsPocket**: `0xC05Ba2595D916Ad94378438dBb3b6F3161bd6C5b`
- **KyeFactory**: `0x724f792F3d11C8eB1471e84ABef654c93cE639dE`

## 🤖 Bot Commands & Interactions

### Natural Language Commands
- "Create a new circle" / "새 계모임 만들기"
- "Join circle ABC123" / "계모임 참가하기"
- "Check my balance" / "잔고 확인"
- "Circle status" / "계모임 현황"
- "Help" / "도움말"

### Automated Features
- **Deposit Reminders**: 48h, 24h, 6h, 1h before deadline
- **Payment Notifications**: Real-time deposit confirmations
- **Round Celebrations**: Payout completion messages
- **Risk Alerts**: Early intervention for at-risk members
- **Group Updates**: Circle progress and milestone notifications

## 📊 Monitoring & Analytics

### Real-time Event Monitoring
```bash
# Monitor blockchain events
npm run events:monitor

# View logs
tail -f logs/bot.log
```

### Performance Metrics
- Response time tracking
- User engagement analytics
- Circle completion rates
- Default prediction accuracy

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode for development
npm test:watch

# Test specific functionality
npm test -- --grep "notification"
```

### Test Coverage
- Unit tests for all services
- Integration tests for webhook handling
- End-to-end tests for complete user flows
- Load testing for high-volume scenarios

## 🚀 Deployment

### Production Deployment
1. **Environment Setup**:
   ```bash
   NODE_ENV=production
   # Set all production environment variables
   ```

2. **Build & Deploy**:
   ```bash
   npm run build
   npm start
   ```

3. **Database Migration**:
   ```bash
   npm run db:migrate
   ```

### Docker Deployment
```bash
# Build image
docker build -t rosca-kye-linebot .

# Run container
docker run -d -p 3001:3001 \
  --env-file .env.production \
  rosca-kye-linebot
```

## 🔒 Security & Privacy

### Data Protection
- **Encryption**: All sensitive data encrypted at rest
- **Hashing**: LINE user IDs hashed before blockchain storage
- **Access Control**: Role-based permissions
- **Rate Limiting**: Anti-spam protection
- **Input Validation**: Comprehensive input sanitization

### Privacy Compliance
- **Data Minimization**: Only collect necessary data
- **Consent Management**: Clear user consent flows
- **Right to Deletion**: User data deletion capabilities
- **Audit Logging**: Comprehensive activity logs

## 🤝 Integration with Existing ROSCA-Kye App

The LINE@ bot seamlessly integrates with the existing web application:

### Shared Resources
- **Smart Contracts**: Uses the same deployed contracts
- **Contract ABIs**: Imports from `../web/src/utils/contracts/abis.ts`
- **Address Configuration**: Leverages existing address management
- **Event System**: Monitors the same blockchain events

### Enhanced User Experience
- **Deep Linking**: Bot messages link to specific LIFF pages
- **Cross-Platform Sync**: Actions in bot reflect in web app
- **Unified Notifications**: Coordinated messaging across platforms
- **Shared User Identity**: Consistent identity management

## 📈 Roadmap

### Phase 1: Core Bot (Days 1-7) ✅
- [x] LINE SDK integration
- [x] Webhook handling
- [x] Basic message processing
- [x] Database setup
- [x] Smart contract integration

### Phase 2: Intelligence (Days 8-14)
- [ ] AI-powered intent recognition
- [ ] Financial intelligence system
- [ ] Personalized messaging
- [ ] Risk assessment

### Phase 3: Advanced Features (Days 15-21)
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Performance optimization
- [ ] Production deployment

## 🆘 Support & Troubleshooting

### Common Issues

**Webhook not receiving events**:
- Verify webhook URL in LINE Console
- Check ngrok is running for local development
- Ensure server is accessible

**Smart contract events not detected**:
- Verify contract addresses in .env
- Check Kaia RPC connection
- Review event monitoring logs

**Database connection errors**:
- Ensure database file path is writable
- Run migrations: `npm run db:migrate`
- Check file permissions

### Getting Help
- Review logs in `logs/` directory
- Check Sentry for error tracking
- Test webhook with LINE Bot Designer
- Validate smart contract integration with existing web app

## 📄 License

MIT License - see LICENSE file for details.

---

**Built for DoraHacks August 27 Submission** 🚀