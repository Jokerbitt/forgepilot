export interface BriefTemplate {
  id: 'saas' | 'mobile' | 'rest-api'
  name: string
  emoji: string
  description: string
  brief: {
    title: string
    problemStatement: string
    targetUsers: string
    coreFeatures: string[]
    techStack: string[]
    successMetrics: string[]
  }
}

export const BRIEF_TEMPLATES: BriefTemplate[] = [
  {
    id: 'saas',
    name: 'SaaS Product',
    emoji: '☁️',
    description: 'B2B/B2C Web-App mit Subscription-Modell',
    brief: {
      title: 'Neues SaaS-Produkt',
      problemStatement: 'Teams verlieren Zeit durch manuelle, repetitive Prozesse die automatisiert werden könnten.',
      targetUsers: 'Small Business Owner, 10-50 Mitarbeiter, wenig Tech-Expertise',
      coreFeatures: ['User Authentication & Billing', 'Dashboard mit KPIs', 'Team-Management', 'API-Integration', 'Email-Notifications'],
      techStack: ['Next.js 14', 'PostgreSQL', 'Stripe', 'Resend', 'Vercel'],
      successMetrics: ['100 zahlende Kunden in 3 Monaten', 'NPS > 50', 'Churn < 5%/Monat'],
    },
  },
  {
    id: 'mobile',
    name: 'Mobile App',
    emoji: '📱',
    description: 'React Native / Expo App für iOS + Android',
    brief: {
      title: 'Neue Mobile App',
      problemStatement: 'Nutzer brauchen unterwegs schnellen Zugang zu [Kernfunktion] ohne Desktop.',
      targetUsers: 'Mobile-first Nutzer, 18-35 Jahre, täglich Smartphone-Nutzung',
      coreFeatures: ['Onboarding Flow', 'Push Notifications', 'Offline-Modus', 'Biometric Auth', 'App Store Optimierung'],
      techStack: ['React Native', 'Expo', 'Supabase', 'RevenueCat', 'Sentry'],
      successMetrics: ['4.5+ App Store Rating', '10k Downloads in 60 Tagen', 'DAU/MAU > 40%'],
    },
  },
  {
    id: 'rest-api',
    name: 'REST API',
    emoji: '🔌',
    description: 'Public/Private API mit Dokumentation',
    brief: {
      title: 'Neue REST API',
      problemStatement: 'Entwickler brauchen programmatischen Zugang zu [Daten/Funktion] ohne eigene Implementierung.',
      targetUsers: 'Software-Entwickler, Startups, Integration-Teams',
      coreFeatures: ['JWT Authentication', 'Rate Limiting', 'OpenAPI/Swagger Docs', 'Webhooks', 'SDK-Generierung'],
      techStack: ['Node.js / Next.js API Routes', 'PostgreSQL', 'Redis', 'Zod Validation', 'Swagger UI'],
      successMetrics: ['< 100ms P95 Response Time', '99.9% Uptime', '1000 aktive API-Nutzer'],
    },
  },
]
