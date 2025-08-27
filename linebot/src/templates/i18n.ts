export class I18nManager {
  private messages = {
    ko: {
      // Notifications
      'notification.deposit_reminder': '입금 알림: {hoursRemaining}시간 남았습니다',
      'notification.deposit_confirmed': '입금이 확인되었습니다: {amount} USDT',
      'notification.payout_executed': '지급 완료: {amount} USDT가 지급되었습니다',
      'notification.round_started': '새 라운드가 시작되었습니다: 라운드 {roundIndex}',
      'notification.penalty_applied': '연체료가 적용되었습니다: {amount} USDT',
      'notification.circle_completed': '계모임이 성공적으로 완료되었습니다!',
      'notification.risk_alert': '위험 알림: 계모임 참여에 주의가 필요합니다',
      'notification.grace_period_granted': '유예 기간이 승인되었습니다',
      'notification.welcome': '계모임 봇에 오신 것을 환영합니다!',
      'notification.help': '도움이 필요하시면 언제든 말씀해 주세요',

      // Commands
      'command.create_circle': '새 계모임 만들기',
      'command.join_circle': '계모임 참가하기',
      'command.check_balance': '잔고 확인',
      'command.circle_status': '계모임 현황',
      'command.help': '도움말',

      // Responses
      'response.circle_created': '계모임이 생성되었습니다! 주소: {address}',
      'response.member_joined': '계모임에 성공적으로 참가했습니다!',
      'response.balance_info': '현재 잔고: {balance} USDT',
      'response.help_info': '계모임 봇 도움말:\n\n• "새 계모임" - 계모임 만들기\n• "참가" - 계모임 참가\n• "잔고" - USDT 잔고 확인\n• "현황" - 내 계모임 현황\n\n더 자세한 기능은 웹앱을 이용해 주세요!',
      'response.unknown': '죄송합니다. 이해하지 못했습니다. "도움말"을 입력해 보세요.',

      // Status
      'status.setup': '설정 중',
      'status.active': '진행 중',
      'status.completed': '완료됨',
      'status.cancelled': '취소됨',
      'status.disputed': '분쟁 중',

      // Time
      'time.hours': '시간',
      'time.days': '일',
      'time.remaining': '남음'
    },

    en: {
      // Notifications
      'notification.deposit_reminder': 'Deposit reminder: {hoursRemaining} hours remaining',
      'notification.deposit_confirmed': 'Deposit confirmed: {amount} USDT',
      'notification.payout_executed': 'Payout completed: {amount} USDT distributed',
      'notification.round_started': 'New round started: Round {roundIndex}',
      'notification.penalty_applied': 'Penalty applied: {amount} USDT',
      'notification.circle_completed': 'Circle completed successfully!',
      'notification.risk_alert': 'Risk alert: Please pay attention to your circle participation',
      'notification.grace_period_granted': 'Grace period granted',
      'notification.welcome': 'Welcome to the Kye Circle Bot!',
      'notification.help': 'Feel free to ask for help anytime',

      // Commands
      'command.create_circle': 'Create New Circle',
      'command.join_circle': 'Join Circle',
      'command.check_balance': 'Check Balance',
      'command.circle_status': 'Circle Status',
      'command.help': 'Help',

      // Responses
      'response.circle_created': 'Circle created! Address: {address}',
      'response.member_joined': 'Successfully joined the circle!',
      'response.balance_info': 'Current balance: {balance} USDT',
      'response.help_info': 'Kye Circle Bot Help:\n\n• "create circle" - Create new circle\n• "join" - Join a circle\n• "balance" - Check USDT balance\n• "status" - View my circles\n\nFor more features, please use the web app!',
      'response.unknown': 'Sorry, I didn\'t understand that. Try typing "help".',

      // Status
      'status.setup': 'Setup',
      'status.active': 'Active',
      'status.completed': 'Completed',
      'status.cancelled': 'Cancelled',
      'status.disputed': 'Disputed',

      // Time
      'time.hours': 'hours',
      'time.days': 'days',
      'time.remaining': 'remaining'
    },

    ja: {
      // Notifications
      'notification.deposit_reminder': '入金リマインダー: {hoursRemaining}時間残り',
      'notification.deposit_confirmed': '入金確認: {amount} USDT',
      'notification.payout_executed': '支払い完了: {amount} USDT が配布されました',
      'notification.round_started': '新しいラウンド開始: ラウンド {roundIndex}',
      'notification.penalty_applied': 'ペナルティ適用: {amount} USDT',
      'notification.circle_completed': 'サークルが正常に完了しました！',
      'notification.risk_alert': 'リスク警告: サークル参加に注意が必要です',
      'notification.grace_period_granted': '猶予期間が承認されました',
      'notification.welcome': 'Kyeサークルボットへようこそ！',
      'notification.help': 'いつでもヘルプをお求めください',

      // Commands
      'command.create_circle': '新しいサークル作成',
      'command.join_circle': 'サークル参加',
      'command.check_balance': '残高確認',
      'command.circle_status': 'サークル状況',
      'command.help': 'ヘルプ',

      // Responses
      'response.circle_created': 'サークル作成完了！アドレス: {address}',
      'response.member_joined': 'サークルに正常に参加しました！',
      'response.balance_info': '現在の残高: {balance} USDT',
      'response.help_info': 'Kyeサークルボット ヘルプ:\n\n• "create circle" - 新サークル作成\n• "join" - サークル参加\n• "balance" - USDT残高確認\n• "status" - マイサークル表示\n\n詳細機能はWebアプリをご利用ください！',
      'response.unknown': '申し訳ありませんが、理解できませんでした。「ヘルプ」と入力してみてください。',

      // Status
      'status.setup': 'セットアップ',
      'status.active': 'アクティブ',
      'status.completed': '完了',
      'status.cancelled': 'キャンセル',
      'status.disputed': '紛争中',

      // Time
      'time.hours': '時間',
      'time.days': '日',
      'time.remaining': '残り'
    }
  };

  getMessage(key: string, language: string = 'ko', params: Record<string, any> = {}): string {
    const langMessages = this.messages[language as keyof typeof this.messages] || this.messages.ko;
    let message = langMessages[key as keyof typeof langMessages] || this.messages.en[key as keyof typeof this.messages.en] || key;

    // Replace parameters
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(`{${param}}`, value.toString());
    });

    return message;
  }

  getAvailableLanguages(): string[] {
    return Object.keys(this.messages);
  }

  formatCurrency(amount: string, language: string = 'ko'): string {
    const amountUsdt = (parseInt(amount) / 1000000).toFixed(2);
    return `${amountUsdt} USDT`;
  }

  formatTimeRemaining(hours: number, language: string = 'ko'): string {
    if (hours < 24) {
      return `${hours} ${this.getMessage('time.hours', language)}`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days} ${this.getMessage('time.days', language)}` + 
             (remainingHours > 0 ? ` ${remainingHours} ${this.getMessage('time.hours', language)}` : '');
    }
  }
}