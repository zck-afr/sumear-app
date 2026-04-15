// lib/i18n/dictionaries/fr.ts
// ─────────────────────────────────────────────

const fr = {
  meta: {
    title: 'Sumear — Assistant Shopping IA',
    description:
      'Clippe tes produits, pose tes questions à l\'IA, compare sans biais. Ton compagnon shopping indépendant.',
  },

  nav: {
    features: 'Fonctionnalités',
    pricing: 'Tarifs',
    login: 'Se connecter',
    install: 'Installer l\'extension',
  },

  hero: {
    eyebrow: 'Assistant IA pour vos achats',
    headline: 'Achetez mieux,<br><em>décidez vite.</em>',
    lead:
      'Sumear analyse les produits que vous consultez et répond à toutes vos questions en temps réel. Directement sur la page.',
    ctaPrimary: 'Ajouter à Chrome — gratuit',
    ctaGhost: 'Voir comment ça marche ↓',
    mockMessage1:
      'J\'ai analysé ce produit. Avec 2 341 avis et 4.7/5, c\'est l\'un des meilleurs rapports qualité/prix de sa catégorie. 🥾',
    mockQuestion: 'Ça tient bien sur terrain humide ?',
    mockMessage2:
      'D\'après les avis, oui. La semelle Contagrip est recommandée à 89% pour les sentiers mouillés.',
  },

  features: {
    title: 'Tout ce dont vous avez besoin',
    subtitle: 'Une extension légère, un assistant puissant.',
    items: [
      {
        icon: '🔍',
        title: 'Analyse instantanée',
        body:
          'Sumear lit la fiche produit à votre place et en extrait l\'essentiel : avis, points forts, points faibles.',
      },
      {
        icon: '💬',
        title: 'Chat contextuel',
        body:
          'Posez n\'importe quelle question sur le produit. L\'IA répond avec le contexte exact de la fiche.',
      },
      {
        icon: '⚖️',
        title: 'Comparaison multi-produits',
        body:
          'Ajoutez plusieurs produits et demandez à l\'IA de les comparer selon vos critères.',
      },
      {
        icon: '📋',
        title: 'Projets d\'achat',
        body:
          'Organisez vos produits par projet et demandez un brief complet à l\'IA.',
      },
      {
        icon: '🕐',
        title: 'Historique',
        body:
          'Retrouvez toutes vos conversations et analyses depuis votre dashboard.',
      },
      {
        icon: '🌐',
        title: 'Multi-sites',
        body:
          'Amazon, Decathlon, Fnac, Cdiscount et plus — Sumear fonctionne sur tous les grands sites marchands.',
      },
    ],
  },

  pricing: {
    title: 'Tarifs',
    monthly: 'Mensuel',
    yearly: 'Annuel',
    perMonth: '/ mois',
    perYear: '/ an',
    save: 'Économise 23%',
    free: {
      name: 'Free',
      price: '0 €',
      cta: 'Commencer gratuitement',
      features: [
        '25 messages IA / mois',
        '8 clips produits',
        '2 projets',
        'Claude Haiku 4.5',
      ],
    },
    complete: {
      name: 'Complete',
      priceMonthly: '12,90 €',
      priceYearly: '9,90 €',
      totalYearly: '118,80 €',
      cta: 'Passer au Complete',
      features: [
        '1 000 messages IA / mois',
        'Clips illimités',
        'Projets illimités',
        'Claude Sonnet 4.6',
      ],
    },
  },

  faq: {
    title: 'Questions fréquentes',
    items: [
      {
        q: 'Quels sites sont compatibles ?',
        a: 'Sumear fonctionne sur tous les sites avec des données produit structurées : Amazon, Fnac, Decathlon, Boulanger, Cdiscount, Darty, Sephora, et bien d\'autres.',
      },
      {
        q: 'Mes données sont-elles en sécurité ?',
        a: 'Oui. Tes données sont stockées sur des serveurs européens (Supabase EU). Nous ne vendons aucune donnée à des tiers. Voir notre politique de confidentialité.',
      },
      {
        q: 'Puis-je annuler à tout moment ?',
        a: 'Oui, sans engagement. Tu peux annuler ton abonnement Complete depuis tes paramètres, et tu conserves l\'accès jusqu\'à la fin de la période payée.',
      },
      {
        q: 'Pourquoi faire confiance à Sumear plutôt qu\'aux avis en ligne ?',
        a: 'Sumear n\'a aucun lien commercial avec les marchands. L\'IA analyse les données brutes du produit et les avis consommateurs sans filtre marketing.',
      },
    ],
  },

  footer: {
    legal: 'Conditions générales',
    privacy: 'Confidentialité',
    mentions: 'Mentions légales',
    rights: '© {year} Sumear. Tous droits réservés.',
  },

  legal: {
    comingSoon: 'Cette page sera disponible prochainement.',
    backHome: 'Retour à l\'accueil',
    cgu: {
      title: 'Conditions Générales d\'Utilisation',
    },
    privacy: {
      title: 'Politique de Confidentialité',
    },
    mentions: {
      title: 'Mentions Légales',
    },
  },
} as const;

export default fr;
export type Dictionary = typeof fr;
