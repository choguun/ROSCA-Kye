import { 
  FlexMessage, 
  FlexBubble, 
  FlexBox,
  DepositReminderData,
  CircleStatusData,
  PayoutNotificationData,
  RiskAlertData,
  CelebrationData,
  WelcomeMessageData,
  HelpMenuData,
  URGENCY_COLORS,
  PHASE_COLORS,
  MESSAGE_ICONS
} from '@/types';
import { getWebAppUrls } from '@/utils/config';

export class FlexMessageBuilder {
  private webAppUrls = getWebAppUrls();

  /**
   * Create deposit reminder message
   */
  createDepositReminderMessage(data: DepositReminderData, language: string = 'ko'): FlexMessage {
    const colors = URGENCY_COLORS[data.urgency];
    const icon = MESSAGE_ICONS.deposit_reminder;

    const messages = {
      ko: {
        title: data.urgency === 'critical' ? '⏰ 최종 알림' : '💰 입금 알림',
        timeRemaining: `남은 시간: ${data.hoursRemaining}시간`,
        depositAmount: '입금액',
        latePenalty: '연체료',
        actionButton: '지금 입금하기',
        altText: `입금 알림: ${data.hoursRemaining}시간 남음`
      },
      en: {
        title: data.urgency === 'critical' ? '⏰ FINAL REMINDER' : '💰 Deposit Reminder',
        timeRemaining: `Time remaining: ${data.hoursRemaining} hours`,
        depositAmount: 'Deposit Amount',
        latePenalty: 'Late Penalty',
        actionButton: 'Make Deposit Now',
        altText: `Deposit reminder: ${data.hoursRemaining}h remaining`
      },
      ja: {
        title: data.urgency === 'critical' ? '⏰ 最終リマインダー' : '💰 入金リマインダー',
        timeRemaining: `残り時間: ${data.hoursRemaining}時間`,
        depositAmount: '入金額',
        latePenalty: '延滞料',
        actionButton: '今すぐ入金',
        altText: `入金リマインダー: ${data.hoursRemaining}時間残り`
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;
    const depositAmountUsdt = (parseInt(data.depositAmount) / 1000000).toFixed(2);
    const penaltyUsdt = data.penalty !== '0' ? (parseInt(data.penalty) / 1000000).toFixed(2) : '0';

    const bodyContents: any[] = [
      {
        type: 'text',
        text: msg.timeRemaining,
        size: 'lg',
        weight: 'bold',
        color: colors.primary
      },
      {
        type: 'separator',
        margin: 'md'
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: msg.depositAmount,
            flex: 1,
            color: '#666666'
          },
          {
            type: 'text',
            text: `${depositAmountUsdt} USDT`,
            flex: 1,
            weight: 'bold',
            align: 'end'
          }
        ],
        margin: 'md'
      }
    ];

    // Add penalty info if applicable
    if (data.penalty !== '0') {
      bodyContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: msg.latePenalty,
            flex: 1,
            color: '#FF3333'
          },
          {
            type: 'text',
            text: `+${penaltyUsdt} USDT`,
            flex: 1,
            weight: 'bold',
            color: '#FF3333',
            align: 'end'
          }
        ],
        margin: 'sm'
      });
    }

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: msg.title,
          weight: 'bold',
          color: data.urgency === 'critical' ? '#FFFFFF' : colors.text,
          size: 'md'
        }],
        backgroundColor: colors.primary,
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: {
            type: 'uri',
            label: msg.actionButton,
            uri: `${this.webAppUrls.endpoints.deposit}&circle=${data.circleAddress}&round=${data.roundIndex}`
          },
          style: 'primary',
          color: colors.primary
        }],
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }

  /**
   * Create circle status message
   */
  createCircleStatusMessage(data: CircleStatusData, language: string = 'ko'): FlexMessage {
    const colors = PHASE_COLORS[data.phase];
    const progress = data.totalRounds > 0 ? (data.currentRound / data.totalRounds) * 100 : 0;

    const messages = {
      ko: {
        title: '📊 계모임 현황',
        members: '멤버',
        round: '라운드',
        progress: '진행률',
        nextDeadline: '다음 마감',
        totalValue: '총 가치',
        viewDetails: '자세히 보기',
        altText: `계모임 현황: ${progress.toFixed(1)}% 완료`
      },
      en: {
        title: '📊 Circle Status',
        members: 'Members',
        round: 'Round',
        progress: 'Progress',
        nextDeadline: 'Next Deadline',
        totalValue: 'Total Value',
        viewDetails: 'View Details',
        altText: `Circle status: ${progress.toFixed(1)}% complete`
      },
      ja: {
        title: '📊 サークル状況',
        members: 'メンバー',
        round: 'ラウンド',
        progress: '進捗',
        nextDeadline: '次の締切',
        totalValue: '総価値',
        viewDetails: '詳細を見る',
        altText: `サークル状況: ${progress.toFixed(1)}% 完了`
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;
    const totalValueUsdt = (parseInt(data.totalValueLocked) / 1000000).toFixed(2);

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: data.circleName,
          weight: 'bold',
          size: 'lg',
          color: '#FFFFFF'
        }, {
          type: 'text',
          text: msg.title,
          size: 'sm',
          color: '#FFFFFF',
          margin: 'xs'
        }],
        backgroundColor: colors.primary,
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: msg.members,
                flex: 1,
                color: '#666666'
              },
              {
                type: 'text',
                text: `${data.memberCount}/${data.maxMembers}`,
                flex: 1,
                weight: 'bold',
                align: 'end'
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: msg.round,
                flex: 1,
                color: '#666666'
              },
              {
                type: 'text',
                text: `${data.currentRound}/${data.totalRounds}`,
                flex: 1,
                weight: 'bold',
                align: 'end'
              }
            ],
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [{
              type: 'box',
              layout: 'horizontal',
              contents: [{
                type: 'box',
                layout: 'vertical',
                flex: progress,
                backgroundColor: colors.primary,
                height: '6px',
                cornerRadius: '3px'
              }, {
                type: 'box',
                layout: 'vertical',
                flex: 100 - progress,
                backgroundColor: '#E0E0E0',
                height: '6px',
                cornerRadius: '3px'
              }]
            }],
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: msg.progress,
                flex: 1,
                size: 'sm',
                color: '#666666'
              },
              {
                type: 'text',
                text: `${progress.toFixed(1)}%`,
                flex: 1,
                size: 'sm',
                align: 'end'
              }
            ],
            margin: 'sm'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: msg.totalValue,
                flex: 1,
                color: '#666666'
              },
              {
                type: 'text',
                text: `${totalValueUsdt} USDT`,
                flex: 1,
                weight: 'bold',
                align: 'end'
              }
            ],
            margin: 'md'
          }
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: {
            type: 'uri',
            label: msg.viewDetails,
            uri: `${this.webAppUrls.endpoints.dashboard}&circle=${data.circleAddress}`
          },
          style: 'secondary'
        }],
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }

  /**
   * Create payout notification message
   */
  createPayoutNotificationMessage(data: PayoutNotificationData, language: string = 'ko'): FlexMessage {
    const messages = {
      ko: {
        title: '🎉 지급 완료!',
        beneficiary: '수령자',
        amount: '지급액',
        roundComplete: `라운드 ${data.roundIndex} 완료`,
        nextRound: '다음 라운드',
        yieldEarned: '수익',
        altText: `지급 완료: ${data.beneficiaryName}님이 수령`
      },
      en: {
        title: '🎉 Payout Complete!',
        beneficiary: 'Beneficiary',
        amount: 'Amount',
        roundComplete: `Round ${data.roundIndex} Complete`,
        nextRound: 'Next Round',
        yieldEarned: 'Yield Earned',
        altText: `Payout complete: ${data.beneficiaryName} received payment`
      },
      ja: {
        title: '🎉 支払い完了！',
        beneficiary: '受益者',
        amount: '金額',
        roundComplete: `ラウンド ${data.roundIndex} 完了`,
        nextRound: '次のラウンド',
        yieldEarned: '利回り',
        altText: `支払い完了: ${data.beneficiaryName}が受領`
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;
    const amountUsdt = (parseInt(data.amount) / 1000000).toFixed(2);
    const yieldUsdt = data.yieldEarned ? (parseInt(data.yieldEarned) / 1000000).toFixed(2) : '0';

    const bodyContents: any[] = [
      {
        type: 'text',
        text: msg.roundComplete,
        size: 'lg',
        weight: 'bold',
        color: '#00B900'
      },
      {
        type: 'separator',
        margin: 'md'
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: msg.beneficiary,
            flex: 1,
            color: '#666666'
          },
          {
            type: 'text',
            text: data.beneficiaryName,
            flex: 2,
            weight: 'bold',
            align: 'end'
          }
        ],
        margin: 'md'
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: msg.amount,
            flex: 1,
            color: '#666666'
          },
          {
            type: 'text',
            text: `${amountUsdt} USDT`,
            flex: 2,
            weight: 'bold',
            align: 'end'
          }
        ],
        margin: 'sm'
      }
    ];

    // Add yield info if applicable
    if (data.yieldEarned && yieldUsdt !== '0') {
      bodyContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: msg.yieldEarned,
            flex: 1,
            color: '#00B900'
          },
          {
            type: 'text',
            text: `+${yieldUsdt} USDT`,
            flex: 2,
            weight: 'bold',
            color: '#00B900',
            align: 'end'
          }
        ],
        margin: 'sm'
      });
    }

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: msg.title,
          weight: 'bold',
          color: '#FFFFFF',
          size: 'md'
        }],
        backgroundColor: '#00B900',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }

  /**
   * Create risk alert message
   */
  createRiskAlertMessage(data: RiskAlertData, language: string = 'ko'): FlexMessage {
    const messages = {
      ko: {
        title: '🚨 위험 알림',
        issue: '문제',
        recommendations: '권장 조치',
        getHelp: '도움 받기',
        altText: `위험 알림: ${data.riskLevel} 수준`
      },
      en: {
        title: '🚨 Risk Alert',
        issue: 'Issue',
        recommendations: 'Recommended Actions',
        getHelp: 'Get Help',
        altText: `Risk alert: ${data.riskLevel} level`
      },
      ja: {
        title: '🚨 リスク警告',
        issue: '問題',
        recommendations: '推奨アクション',
        getHelp: 'ヘルプを受ける',
        altText: `リスク警告: ${data.riskLevel} レベル`
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;
    const riskColors = {
      medium: '#FF9500',
      high: '#FF6B35',
      critical: '#FF3333'
    };

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: msg.title,
          weight: 'bold',
          color: '#FFFFFF',
          size: 'md'
        }],
        backgroundColor: riskColors[data.riskLevel],
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: msg.recommendations,
            weight: 'bold',
            margin: 'md'
          },
          ...data.recommendedActions.map(action => ({
            type: 'text',
            text: `• ${action}`,
            size: 'sm',
            margin: 'xs',
            wrap: true
          }))
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: {
            type: 'postback',
            label: msg.getHelp,
            data: JSON.stringify({
              action: 'get_help',
              riskLevel: data.riskLevel,
              issueType: data.issueType
            })
          },
          style: 'primary',
          color: riskColors[data.riskLevel]
        }],
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }

  /**
   * Create celebration message
   */
  createCelebrationMessage(data: CelebrationData, language: string = 'ko'): FlexMessage {
    const messages = {
      ko: {
        altText: `축하합니다: ${data.title}`
      },
      en: {
        altText: `Celebration: ${data.title}`
      },
      ja: {
        altText: `おめでとうございます: ${data.title}`
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: MESSAGE_ICONS.celebration + ' ' + data.title,
          weight: 'bold',
          color: '#FFFFFF',
          size: 'lg'
        }],
        backgroundColor: '#4A90E2',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: data.description,
          wrap: true,
          color: '#333333'
        }],
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }

  /**
   * Create welcome message
   */
  createWelcomeMessage(data: WelcomeMessageData, language: string = 'ko'): FlexMessage {
    const messages = {
      ko: {
        title: `안녕하세요, ${data.userName}님!`,
        subtitle: '계모임 봇에 오신 것을 환영합니다',
        getStarted: '시작하기',
        altText: `환영합니다, ${data.userName}님!`
      },
      en: {
        title: `Hello, ${data.userName}!`,
        subtitle: 'Welcome to the Kye Circle Bot',
        getStarted: 'Get Started',
        altText: `Welcome, ${data.userName}!`
      },
      ja: {
        title: `こんにちは, ${data.userName}さん!`,
        subtitle: 'Kyeサークルボットへようこそ',
        getStarted: '開始する',
        altText: `ようこそ, ${data.userName}さん!`
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;

    const actionButtons = data.suggestedActions.slice(0, 3).map(action => ({
      type: 'button',
      action: {
        type: action.actionUrl ? 'uri' : 'postback',
        label: action.title,
        ...(action.actionUrl ? { uri: action.actionUrl } : { data: JSON.stringify({ action: action.actionType }) })
      },
      style: 'primary',
      margin: 'sm'
    }));

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: msg.title,
          weight: 'bold',
          color: '#FFFFFF',
          size: 'lg'
        }, {
          type: 'text',
          text: msg.subtitle,
          color: '#FFFFFF',
          size: 'sm',
          margin: 'xs'
        }],
        backgroundColor: '#00B900',
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: actionButtons,
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }

  /**
   * Create help menu message
   */
  createHelpMenuMessage(data: HelpMenuData, language: string = 'ko'): FlexMessage {
    const messages = {
      ko: {
        title: '❓ 도움말 메뉴',
        commonQuestions: '자주 묻는 질문',
        quickActions: '빠른 동작',
        altText: '도움말 메뉴'
      },
      en: {
        title: '❓ Help Menu',
        commonQuestions: 'Common Questions',
        quickActions: 'Quick Actions',
        altText: 'Help Menu'
      },
      ja: {
        title: '❓ ヘルプメニュー',
        commonQuestions: 'よくある質問',
        quickActions: 'クイックアクション',
        altText: 'ヘルプメニュー'
      }
    };

    const msg = messages[language as keyof typeof messages] || messages.en;

    const questionItems = data.commonQuestions.slice(0, 4).map(q => ({
      type: 'text',
      text: `• ${q.question}`,
      size: 'sm',
      color: '#4A90E2',
      margin: 'xs',
      action: {
        type: 'postback',
        data: JSON.stringify({
          action: 'help_answer',
          question: q.question,
          answer: q.answer
        })
      }
    }));

    const actionButtons = data.quickActions.slice(0, 2).map(action => ({
      type: 'button',
      action: {
        type: 'postback',
        label: action.label,
        data: action.data || JSON.stringify({ action: action.action })
      },
      style: 'secondary',
      margin: 'sm'
    }));

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: msg.title,
          weight: 'bold',
          color: '#FFFFFF',
          size: 'md'
        }],
        backgroundColor: '#4A90E2',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: msg.commonQuestions,
            weight: 'bold',
            margin: 'none'
          },
          ...questionItems
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: actionButtons,
        paddingAll: '20px'
      }
    };

    return {
      type: 'flex',
      altText: msg.altText,
      contents: bubble
    };
  }
}