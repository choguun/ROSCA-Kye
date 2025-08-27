#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 ROSCA Kye LINE Bot Setup');
console.log('============================\n');

async function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  try {
    console.log('This script will help you configure the LINE Bot environment.\n');

    // Check if .env already exists
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const overwrite = await promptUser('⚠️  .env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        process.exit(0);
      }
    }

    // Collect configuration
    console.log('📋 LINE Bot Configuration:');
    const lineChannelAccessToken = await promptUser('Enter LINE Channel Access Token: ');
    const lineChannelSecret = await promptUser('Enter LINE Channel Secret: ');
    const lineLiffId = await promptUser('Enter LINE LIFF ID (optional): ');

    console.log('\n🌐 Server Configuration:');
    const port = await promptUser('Enter server port (default: 3001): ') || '3001';
    const baseUrl = await promptUser('Enter base URL (e.g., https://your-domain.com): ');

    console.log('\n⛓️  Blockchain Configuration:');
    const useKairosTestnet = await promptUser('Use Kaia Kairos Testnet? (Y/n): ');
    
    let kaiaRpcUrl, kaiaChainId, usdtAddress, kyeFactoryAddress, savingsPocketAddress;
    
    if (useKairosTestnet.toLowerCase() !== 'n') {
      // Use testnet defaults
      kaiaRpcUrl = 'https://public-en-kairos.node.kaia.io';
      kaiaChainId = '1001';
      usdtAddress = '0x8f198CD718aa1Bf2b338ddba78736E91cD254da6';
      kyeFactoryAddress = '0x724f792F3d11C8eB1471e84ABef654c93cE639dE';
      savingsPocketAddress = '0xC05Ba2595D916Ad94378438dBb3b6F3161bd6C5b';
      console.log('✅ Using Kaia Kairos Testnet with deployed contracts');
    } else {
      kaiaRpcUrl = await promptUser('Enter Kaia RPC URL: ');
      kaiaChainId = await promptUser('Enter Chain ID: ');
      usdtAddress = await promptUser('Enter USDT Contract Address: ');
      kyeFactoryAddress = await promptUser('Enter KyeFactory Contract Address: ');
      savingsPocketAddress = await promptUser('Enter SavingsPocket Contract Address: ');
    }

    console.log('\n🔐 Security Configuration:');
    const privateKey = await promptUser('Enter Private Key for contract interactions (optional): ');
    const encryptionKey = await promptUser('Enter Encryption Key (32 chars, or leave empty for auto-generation): ');
    const jwtSecret = await promptUser('Enter JWT Secret (32 chars, or leave empty for auto-generation): ');

    console.log('\n🤖 AI Configuration:');
    const openaiApiKey = await promptUser('Enter OpenAI API Key (optional): ');

    console.log('\n📱 Web App Integration:');
    const webAppBaseUrl = await promptUser('Enter Web App Base URL (optional): ') || 'http://localhost:3000';
    const liffBaseUrl = lineLiffId ? `https://liff.line.me/${lineLiffId}` : '';

    // Generate random keys if not provided
    const finalEncryptionKey = encryptionKey || require('crypto').randomBytes(32).toString('hex');
    const finalJwtSecret = jwtSecret || require('crypto').randomBytes(32).toString('hex');

    // Create .env content
    const envContent = `# LINE Bot Configuration
LINE_CHANNEL_ACCESS_TOKEN=${lineChannelAccessToken}
LINE_CHANNEL_SECRET=${lineChannelSecret}
${lineLiffId ? `LINE_LIFF_ID=${lineLiffId}` : '# LINE_LIFF_ID=your_liff_id_here'}

# Server Configuration
NODE_ENV=development
PORT=${port}
BASE_URL=${baseUrl}
WEBHOOK_PATH=/webhook

# Database Configuration
DATABASE_URL=./data/linebot.db

# Blockchain Configuration
KAIA_RPC_URL=${kaiaRpcUrl}
KAIA_CHAIN_ID=${kaiaChainId}
${privateKey ? `PRIVATE_KEY=${privateKey}` : '# PRIVATE_KEY=your_private_key_here'}

# Smart Contract Addresses
USDT_CONTRACT_ADDRESS=${usdtAddress}
SAVINGS_POCKET_ADDRESS=${savingsPocketAddress}
KYE_FACTORY_ADDRESS=${kyeFactoryAddress}

# Existing Web App Integration
WEB_APP_BASE_URL=${webAppBaseUrl}
${liffBaseUrl ? `LIFF_BASE_URL=${liffBaseUrl}` : '# LIFF_BASE_URL=https://liff.line.me/YOUR_LIFF_ID'}

# AI Configuration
${openaiApiKey ? `OPENAI_API_KEY=${openaiApiKey}` : '# OPENAI_API_KEY=your_openai_api_key_here'}
AI_ENABLED=${openaiApiKey ? 'true' : 'false'}

# Logging & Monitoring
LOG_LEVEL=debug
# SENTRY_DSN=your_sentry_dsn_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Security
ENCRYPTION_KEY=${finalEncryptionKey}
JWT_SECRET=${finalJwtSecret}

# Notification Scheduling
REMINDER_INTERVALS=48,24,6,1
DEFAULT_ROUND_DURATION=2592000

# Multi-language Support
DEFAULT_LANGUAGE=ko
SUPPORTED_LANGUAGES=ko,en,ja
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);

    // Create data directory
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create logs directory
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    console.log('\n✅ Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Build the project: npm run build');
    console.log('3. Start development server: npm run dev');
    console.log('4. Set up ngrok for webhook URL: npm run webhook:ngrok');
    console.log('\n📋 Configuration saved to .env');
    
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      console.log('\n⚠️  Note: You\'re using localhost for BASE_URL.');
      console.log('   For LINE webhooks, you\'ll need to use ngrok or deploy to a public server.');
      console.log('   Run: npm run webhook:ngrok');
    }

    console.log('\n🔗 Don\'t forget to:');
    console.log(`- Set webhook URL in LINE Developer Console: ${baseUrl}/webhook`);
    console.log('- Enable webhook in your LINE Messaging API settings');
    console.log('- Disable auto-reply messages in LINE Official Account Manager');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();