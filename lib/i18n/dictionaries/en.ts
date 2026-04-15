// lib/i18n/dictionaries/en.ts
// ─────────────────────────────────────────────

import type { Dictionary } from './fr';

const en = {
  meta: {
    title: 'Sumear — AI Shopping Assistant',
    description:
      'Clip products, ask AI questions, compare smartly. Your unbiased shopping companion.',
  },

  nav: {
    features: 'Features',
    pricing: 'Pricing',
    login: 'Sign in',
    install: 'Install extension',
  },

  hero: {
    eyebrow: 'AI assistant for your shopping',
    headline: 'Shop smarter,<br><em>decide faster.</em>',
    lead:
      'Sumear analyses the products you browse and answers all your questions in real time. Right on the page.',
    ctaPrimary: 'Add to Chrome — free',
    ctaGhost: 'See how it works ↓',
    mockMessage1:
      'I\'ve analysed this product. With 2,341 reviews and 4.7/5, it\'s one of the best value-for-money options in its category. 🥾',
    mockQuestion: 'Does it hold up on wet terrain?',
    mockMessage2:
      'According to reviews, yes. The Contagrip sole is recommended by 89% of users for wet trails.',
  },

  features: {
    title: 'Everything you need',
    subtitle: 'A lightweight extension, a powerful assistant.',
    items: [
      {
        icon: '🔍',
        title: 'Instant analysis',
        body:
          'Sumear reads the product page for you and extracts what matters: reviews, strengths, weaknesses.',
      },
      {
        icon: '💬',
        title: 'Contextual chat',
        body:
          'Ask any question about the product. The AI answers with the exact context of the listing.',
      },
      {
        icon: '⚖️',
        title: 'Multi-product comparison',
        body:
          'Add multiple products and ask the AI to compare them by your criteria.',
      },
      {
        icon: '📋',
        title: 'Shopping projects',
        body:
          'Organise your products by project and ask the AI for a full brief.',
      },
      {
        icon: '🕐',
        title: 'History',
        body:
          'Find all your conversations and analyses from your dashboard.',
      },
      {
        icon: '🌐',
        title: 'Multi-site',
        body:
          'Amazon, Decathlon, Fnac, Cdiscount and more — Sumear works on all major e-commerce sites.',
      },
    ],
  },

  pricing: {
    title: 'Pricing',
    monthly: 'Monthly',
    yearly: 'Yearly',
    perMonth: '/ month',
    perYear: '/ year',
    save: 'Save 23%',
    free: {
      name: 'Free',
      price: '€0',
      cta: 'Get started for free',
      features: [
        '25 AI messages / month',
        '8 product clips',
        '2 projects',
        'Claude Haiku 4.5',
      ],
    },
    complete: {
      name: 'Complete',
      priceMonthly: '€12.90',
      priceYearly: '€9.90',
      totalYearly: '€118.80',
      cta: 'Upgrade to Complete',
      features: [
        '1,000 AI messages / month',
        'Unlimited clips',
        'Unlimited projects',
        'Claude Sonnet 4.6',
      ],
    },
  },

  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        q: 'Which websites are supported?',
        a: 'Sumear works on all sites with structured product data: Amazon, Best Buy, Target, Walmart, and many more.',
      },
      {
        q: 'Is my data safe?',
        a: 'Yes. Your data is stored on European servers (Supabase EU). We never sell data to third parties. See our privacy policy.',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes, no commitment. You can cancel your Complete subscription from your settings, and you keep access until the end of the paid period.',
      },
      {
        q: 'Why trust Sumear over online reviews?',
        a: 'Sumear has zero commercial ties with retailers. AI analyzes raw product data and consumer reviews without any marketing filter.',
      },
    ],
  },

  footer: {
    legal: 'Terms of Service',
    privacy: 'Privacy Policy',
    mentions: 'Legal Notice',
    rights: '© {year} Sumear. All rights reserved.',
  },

  legal: {
    comingSoon: 'This page will be available soon.',
    backHome: 'Back to home',
    cgu: {
      title: 'Terms of Service',
    },
    privacy: {
      title: 'Privacy Policy',
    },
    mentions: {
      title: 'Legal Notice',
    },
  },
} as const;

export default en as unknown as Dictionary;
