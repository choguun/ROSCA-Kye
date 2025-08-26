import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://98fe416d21f3b649705aa52e9825b581@o4507049319268352.ingest.us.sentry.io/4509905467539456",
  
  // Performance monitoring
  tracesSampleRate: 1.0,
  
  // Session replay
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // Debug in development
  debug: process.env.NODE_ENV === 'development',
  
  // Environment
  environment: process.env.NODE_ENV,

  // Filter out non-critical DappPortal SDK errors
  beforeSend(event) {
    const errorMessage = event.exception?.values?.[0]?.value || '';
    const errorType = event.exception?.values?.[0]?.type || '';
    
    // Suppress 403 errors from DappPortal APIs
    if (errorMessage.includes('Request failed with status code 403') || 
        errorMessage.includes('status code 403')) {
      
      // Check if it's from DappPortal SDK APIs
      const isDappPortalError = 
        errorMessage.includes('wallet.dappportal.io') ||
        errorMessage.includes('metric.dappportal.io') ||
        errorMessage.includes('/api/v1/events') ||
        errorMessage.includes('/api/v2/metric') ||
        event.exception.values[0].stacktrace?.frames?.some(frame => 
          frame.filename?.includes('dapp-portal-sdk') ||
          frame.filename?.includes('wallet.dappportal.io') ||
          frame.function?.includes('getEvents') ||
          frame.function?.includes('openEventBannerWhenStart') ||
          frame.function?.includes('sendWalletActivity')
        );
        
      if (isDappPortalError) {
        console.warn('Sentry: Filtering out non-critical DappPortal SDK 403 error');
        return null;
      }
    }

    // Suppress aborted request errors from DappPortal APIs  
    if (errorMessage.includes('Request aborted') || errorMessage.includes('aborted')) {
      const isDappPortalAbort = 
        errorMessage.includes('dappportal.io') ||
        event.exception.values[0].stacktrace?.frames?.some(frame =>
          frame.filename?.includes('dapp-portal-sdk')
        );
        
      if (isDappPortalAbort) {
        console.warn('Sentry: Filtering out non-critical DappPortal SDK abort error');
        return null;
      }
    }

    // Suppress LIFF "Unexpected API name" errors - this is due to incorrect isApiAvailable usage
    if (errorMessage.includes('Unexpected API name') && 
        event.exception.values[0].stacktrace?.frames?.some(frame =>
          frame.function?.includes('isApiAvailable') ||
          frame.filename?.includes('6105-') // LIFF SDK chunk
        )) {
      console.warn('Sentry: Filtering out LIFF API name error (fixed in code)');
      return null;
    }

    // Suppress network connectivity errors to api.line.me
    if ((errorMessage.includes('Failed to fetch') && errorMessage.includes('api.line.me')) ||
        errorMessage.includes('LIFF Network Connectivity Issue')) {
      console.warn('Sentry: Filtering out LINE network connectivity issue');
      return null;
    }

    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});