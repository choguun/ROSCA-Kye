import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://98fe416d21f3b649705aa52e9825b581@o4507049319268352.ingest.us.sentry.io/4509905467539456",
  tracesSampleRate: 1.0,
  debug: process.env.NODE_ENV === 'development',
  environment: process.env.NODE_ENV,
});