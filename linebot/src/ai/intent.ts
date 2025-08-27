import { Intent, IntentRecognitionResult } from '@/types';
import { Logger } from '@/utils/logger';

interface MessageContext {
  text: string;
  userId: string;
  groupId?: string;
  timestamp: number;
}

export class IntentProcessor {
  private logger: Logger;
  private intentPatterns: Map<Intent, RegExp[]>;

  constructor() {
    this.logger = new Logger('IntentProcessor');
    this.setupIntentPatterns();
  }

  /**
   * Process a message and determine user intent
   */
  async processMessage(context: MessageContext): Promise<IntentRecognitionResult> {
    const text = context.text.toLowerCase().trim();
    const language = this.detectLanguage(text);

    // Check for each intent pattern
    for (const [intent, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const entities = this.extractEntities(text, intent);
          
          return {
            intent,
            confidence: this.calculateConfidence(text, pattern, intent),
            entities,
            originalText: context.text,
            language
          };
        }
      }
    }

    // Default to unknown intent
    return {
      intent: Intent.UNKNOWN,
      confidence: 0.0,
      entities: {},
      originalText: context.text,
      language
    };
  }

  /**
   * Setup regex patterns for intent recognition
   */
  private setupIntentPatterns(): void {
    this.intentPatterns = new Map([
      [Intent.CREATE_CIRCLE, [
        /(?:create|start|new|make|begin).*(?:circle|group|kye|계|モイム)/i,
        /(?:새로운|새|만들|생성|시작).*(?:계|계모임|동아리)/i,
        /(?:新しい|作る|始める).*(?:サークル|グループ)/i,
        /\/create/i,
        /계모임.*(?:만들|생성|시작)/i
      ]],

      [Intent.JOIN_CIRCLE, [
        /(?:join|participate|enter).*(?:circle|group|kye)/i,
        /(?:참가|가입|들어가|입장).*(?:계|계모임)/i,
        /(?:参加|加入|入る).*(?:サークル|グループ)/i,
        /\/join/i,
        /초대.*(?:코드|링크)/i,
        /invite.*code/i,
        /계모임.*(?:참가|가입)/i
      ]],

      [Intent.CHECK_BALANCE, [
        /(?:check|show|view|get).*(?:balance|money|usdt|amount)/i,
        /(?:잔고|잔액|돈|금액).*(?:확인|조회|보기)/i,
        /(?:残高|金額|お金).*(?:確認|チェック)/i,
        /balance/i,
        /잔고/i,
        /얼마.*(?:있|남)/i
      ]],

      [Intent.CIRCLE_STATUS, [
        /(?:status|state|info|information).*(?:circle|group)/i,
        /(?:circle|group).*(?:status|state|info)/i,
        /(?:상태|현황|정보).*(?:계|계모임)/i,
        /(?:계|계모임).*(?:상태|현황|정보)/i,
        /(?:状況|状態|情報).*(?:サークル|グループ)/i,
        /my.*(?:circle|group)s?/i,
        /내.*(?:계|계모임)/i
      ]],

      [Intent.DEPOSIT_INFO, [
        /(?:deposit|pay|payment|send).*(?:info|information|amount)/i,
        /(?:입금|납입|송금|지불).*(?:정보|금액|안내)/i,
        /(?:入金|支払い|送金).*(?:情報|金額)/i,
        /when.*(?:deposit|pay|due)/i,
        /언제.*(?:입금|납입)/i,
        /얼마.*(?:입금|납입)/i
      ]],

      [Intent.HELP, [
        /^(?:help|도움말|헬프|ヘルプ|\?|？)$/i,
        /(?:help|assist|support|guide)/i,
        /(?:도움|도와|안내|가이드|설명)/i,
        /(?:助けて|手伝い|サポート|ガイド)/i,
        /how.*(?:work|use)/i,
        /어떻게.*(?:사용|쓰)/i,
        /\/help/i
      ]],

      [Intent.GREETING, [
        /^(?:hi|hello|hey|yo|안녕|하이|헬로|こんにちは|ハイ)!?$/i,
        /^(?:good\s*(?:morning|afternoon|evening)|좋은\s*(?:아침|오후|저녁)|おはよう|こんばんは)!?$/i,
        /^(?:what'?s?\s*up|how\s*are\s*you|잘\s*지내|어떻게\s*지내|元気).*$/i
      ]]
    ]);
  }

  /**
   * Detect language from text
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on character sets
    const koreanPattern = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

    if (koreanPattern.test(text)) return 'ko';
    if (japanesePattern.test(text)) return 'ja';
    return 'en';
  }

  /**
   * Extract entities from text based on intent
   */
  private extractEntities(text: string, intent: Intent): Record<string, any> {
    const entities: Record<string, any> = {};

    switch (intent) {
      case Intent.JOIN_CIRCLE:
        // Extract invite code or circle address
        const codeMatch = text.match(/(?:code|코드|コード)[\s:]*(0x[a-fA-F0-9]{40}|[A-Za-z0-9]{6,})/i);
        if (codeMatch) {
          entities.inviteCode = codeMatch[1];
        }
        break;

      case Intent.CREATE_CIRCLE:
        // Extract circle name if mentioned
        const nameMatch = text.match(/(?:name|named|called|이름|명칭|という名前)[\s:]*([\w\s]+)/i);
        if (nameMatch) {
          entities.circleName = nameMatch[1].trim();
        }
        break;

      case Intent.DEPOSIT_INFO:
        // Extract circle reference
        const circleMatch = text.match(/(0x[a-fA-F0-9]{40})/);
        if (circleMatch) {
          entities.circleAddress = circleMatch[1];
        }
        break;
    }

    return entities;
  }

  /**
   * Calculate confidence score for intent match
   */
  private calculateConfidence(text: string, pattern: RegExp, intent: Intent): number {
    let confidence = 0.7; // Base confidence for pattern match

    // Increase confidence for exact matches
    if (text.toLowerCase() === intent.toLowerCase()) {
      confidence = 0.95;
    }

    // Increase confidence for command patterns
    if (text.startsWith('/')) {
      confidence = 0.9;
    }

    // Increase confidence for longer, more specific matches
    const matchLength = text.match(pattern)?.[0]?.length || 0;
    if (matchLength > text.length * 0.5) {
      confidence += 0.1;
    }

    // Decrease confidence for very short text
    if (text.length < 5) {
      confidence -= 0.2;
    }

    // Ensure confidence is within bounds
    return Math.max(0.0, Math.min(1.0, confidence));
  }

  /**
   * Get suggested responses based on intent
   */
  getSuggestedResponses(intent: Intent, language: string = 'en'): string[] {
    const responses = {
      [Intent.CREATE_CIRCLE]: {
        ko: [
          '새 계모임을 만드시는군요! 몇 가지 정보가 필요해요.',
          '계모임 생성을 도와드릴게요. 어떤 정보를 설정하시겠어요?'
        ],
        en: [
          'Creating a new circle! I\'ll need some information from you.',
          'Let\'s set up your savings circle. What details would you like to configure?'
        ],
        ja: [
          '新しいサークルを作りますね！いくつか情報が必要です。',
          'サークル作成をお手伝いします。どの情報を設定しますか？'
        ]
      },
      [Intent.JOIN_CIRCLE]: {
        ko: [
          '계모임에 참가하시는군요! 초대 코드가 있으신가요?',
          '어떤 계모임에 가입하고 싶으신가요?'
        ],
        en: [
          'Joining a circle! Do you have an invite code?',
          'Which circle would you like to join?'
        ],
        ja: [
          'サークルに参加しますね！招待コードはありますか？',
          'どのサークルに参加したいですか？'
        ]
      },
      [Intent.HELP]: {
        ko: [
          '안녕하세요! 계모임 봇입니다. 무엇을 도와드릴까요?',
          '계모임 관리를 도와드려요! 궁금한 것이 있으시면 언제든 물어보세요.'
        ],
        en: [
          'Hello! I\'m the Kye Circle Bot. How can I help you?',
          'I help manage your savings circles! Ask me anything.'
        ],
        ja: [
          'こんにちは！Kyeサークルボットです。お手伝いしましょうか？',
          'サークル管理をお手伝いします！何でも聞いてください。'
        ]
      }
    };

    const intentResponses = responses[intent];
    if (!intentResponses) return [];

    return intentResponses[language as keyof typeof intentResponses] || 
           intentResponses.en || 
           [];
  }

  /**
   * Check if message contains urgency indicators
   */
  hasUrgencyIndicators(text: string): boolean {
    const urgencyPatterns = [
      /(?:urgent|emergency|asap|immediately|quickly)/i,
      /(?:긴급|응급|급해|빨리|즉시)/i,
      /(?:緊急|急いで|すぐに)/i,
      /[!]{2,}/,
      /(?:help|도움|助けて).*[!]+/i
    ];

    return urgencyPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect sentiment (positive/negative/neutral)
   */
  detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'good', 'great', 'awesome', 'excellent', 'perfect', 'love', 'like', 'happy', 'pleased',
      '좋', '훌륭', '완벽', '사랑', '기뻐', '행복', '만족',
      '良い', '素晴らしい', '完璧', '愛', '好き', '嬉しい', '満足'
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'dislike', 'angry', 'frustrated', 'problem', 'issue',
      '나쁜', '끔찍', '싫어', '화', '문제', '이슈',
      '悪い', '酷い', '嫌い', '怒り', '問題'
    ];

    const text_lower = text.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => text_lower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text_lower.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
}