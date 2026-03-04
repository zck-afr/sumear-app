# BriefAI — Architecture Reference Document
# Version: MVP v1.0 | Last updated: 2026-03-04
# ⚠️ CE FICHIER EST LA SOURCE DE VÉRITÉ DU PROJET.
# Donne-le en contexte à Cursor/Claude à chaque session de code.


## 1. Vision Produit

BriefAI est un assistant shopping e-commerce par IA. Positionnement : "le Notion Web Clipper du e-commerce".

**Deux composants :**
- **Extension Chrome** (clipper silencieux) → capture les données produit en 1 clic
- **Web App / Dashboard** (espace d'analyse) → comparaisons IA, verdicts, red flags

**Principe UX fondamental :** séparer la chasse (extension) du recueil (dashboard). L'extension ne fait RIEN d'analytique. Le dashboard fait TOUT le travail intelligent.

**Positionnement concurrentiel :** mandataire exclusif de l'acheteur. Aucun lien commercial avec les marchands. L'IA révèle ce que les fiches produit cachent.


## 2. Stack Technique

```
Frontend + Backend    : Next.js 14+ (App Router, TypeScript)
Base de données       : Supabase (PostgreSQL + Auth + RLS)
Hébergement           : Vercel
Paiements             : Stripe (Checkout + Webhooks)
APIs LLM              : Anthropic (Claude) + OpenAI (GPT)
Extension Chrome      : Manifest V3, vanilla TypeScript, Vite bundler
```

### Pourquoi ces choix
- **Next.js** : un seul repo pour le dashboard, les API routes (proxy LLM, webhooks Stripe), et la landing page. TypeScript partout.
- **Supabase** : Auth Google pré-intégré, PostgreSQL + RLS pour la sécurité par défaut, tier gratuit suffisant pour le MVP.
- **Vercel** : déploiement en `git push`, zéro DevOps.
- **Extension séparée** : repo distinct, cycle de release indépendant (soumission Chrome Web Store ≠ déploiement web).


## 3. Repos et Structure des Dossiers

### Repo 1 : `briefai-app` (Next.js)

```
briefai-app/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx              # Page de connexion Google
│   │   └── callback/page.tsx           # Callback OAuth Supabase
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Layout dashboard (sidebar + main)
│   │   ├── page.tsx                    # Vue d'ensemble / projets récents
│   │   ├── projects/
│   │   │   ├── page.tsx                # Liste des projets
│   │   │   └── [id]/page.tsx           # Détail projet (clips + comparaisons)
│   │   ├── clips/
│   │   │   └── page.tsx                # Tous les clips (vue plate)
│   │   ├── compare/
│   │   │   └── [id]/page.tsx           # Résultat d'une comparaison
│   │   └── settings/
│   │       ├── page.tsx                # Profil + plan
│   │       └── api-keys/page.tsx       # Gestion clés BYOK
│   ├── (marketing)/
│   │   ├── page.tsx                    # Landing page
│   │   └── pricing/page.tsx            # Page pricing
│   ├── api/
│   │   ├── clips/
│   │   │   └── route.ts               # POST: recevoir un clip depuis l'extension
│   │   ├── compare/
│   │   │   └── route.ts               # POST: lancer une comparaison IA
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts         # Webhooks Stripe
│   │   └── health/
│   │       └── route.ts               # Health check
│   └── layout.tsx                      # Root layout
├── components/
│   ├── ui/                             # Composants UI réutilisables (shadcn/ui)
│   ├── dashboard/                      # Composants spécifiques au dashboard
│   ├── comparison/                     # Composants d'affichage des résultats IA
│   └── marketing/                      # Composants landing page
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Client Supabase (browser)
│   │   ├── server.ts                   # Client Supabase (server-side)
│   │   └── types.ts                    # Types auto-générés depuis le schema
│   ├── llm/
│   │   ├── provider.ts                 # Abstraction multi-provider (Anthropic + OpenAI)
│   │   ├── prompts.ts                  # Prompts système (comparaison + solo)
│   │   └── parser.ts                   # Parsing + validation du JSON LLM
│   ├── stripe/
│   │   ├── client.ts                   # Config Stripe
│   │   └── webhooks.ts                 # Logique de traitement des webhooks
│   └── utils/
│       ├── quota.ts                    # Vérification des quotas utilisateur
│       ├── encryption.ts               # Chiffrement/déchiffrement clés API (AES-256)
│       └── format.ts                   # Helpers de formatage (prix, dates, specs)
├── database/
│   ├── schema.sql                      # Migration initiale (le fichier qu'on a créé)
│   └── schema.mermaid                  # Diagramme ERD
├── prompts/
│   └── briefai_prompts.py              # Prompts de référence (source de vérité)
├── public/
├── .env.local                          # Variables d'environnement (JAMAIS commité)
├── .env.example                        # Template des variables requises
└── package.json
```

### Repo 2 : `briefai-extension` (Chrome Extension)

```
briefai-extension/
├── src/
│   ├── manifest.json                   # Manifest V3
│   ├── background/
│   │   └── service-worker.ts           # Service worker (gère la comm avec le dashboard)
│   ├── content/
│   │   ├── extractor.ts                # Logique d'extraction JSON-LD + fallback Markdown
│   │   ├── jsonld.ts                   # Parser JSON-LD / Schema.org
│   │   └── markdown.ts                 # Conversion HTML → Markdown (Turndown.js)
│   ├── popup/
│   │   ├── popup.html                  # UI du popup (mini, 3 boutons max)
│   │   ├── popup.ts                    # Logique du popup
│   │   └── popup.css
│   └── utils/
│       ├── api.ts                      # Appels vers briefai.com/api/clips
│       └── auth.ts                     # Gestion du token auth (cookie Supabase)
├── vite.config.ts
└── package.json
```


## 4. Modèle de Données

### Tables (7 tables)

| Table | Rôle | Clés importantes |
|-------|------|-----------------|
| `profiles` | Utilisateurs (extension de auth.users) | `plan` (free/pro/complete) |
| `api_keys` | Clés BYOK chiffrées | `UNIQUE(user_id, provider)` |
| `projects` | Dossiers d'achat | `position` pour le tri drag & drop |
| `clips` | Produits capturés | `raw_jsonld`, `extracted_specs`, `extracted_reviews` |
| `comparisons` | Analyses IA générées | `result_matrix`, `result_analysis`, `api_cost_usd` |
| `comparison_clips` | Liaison N:N clips↔comparaisons | `PRIMARY KEY(comparison_id, clip_id)` |
| `usage` | Compteurs mensuels | `UNIQUE(user_id, year, month)` |

### Fichier SQL complet : `database/schema.sql`

### Fonctions Supabase clés
- `increment_usage()` : upsert atomique des compteurs mensuels
- `check_quota()` : retourne un JSON avec usage actuel + limite + is_allowed


## 5. Système d'Extraction (Extension Chrome)

### Stratégie à 3 niveaux (dans cet ordre de priorité)

**Niveau 1 — JSON-LD (prioritaire)**
```
Document → querySelectorAll('script[type="application/ld+json"]')
         → parse → chercher @type: "Product"
         → extraire : name, brand, price, rating, review, offers
```
Couverture : Amazon, Cdiscount, FNAC, Darty, la majorité des gros e-commerce (SEO oblige).

**Niveau 2 — DOM ciblé pour les avis**
Les avis sont rarement dans le JSON-LD. Extraction séparée depuis le DOM :
```
Amazon : #cm-cr-dp-review-list .review
Générique : [itemprop="review"], .customer-review, .review-text
```
Nettoyage : garder les 20 avis les plus récents/utiles, tronquer à 200 mots chacun.

**Niveau 3 — Fallback Markdown (Turndown.js)**
Si pas de JSON-LD ni de sélecteurs connus :
```
Document.body → Turndown.js → Markdown nettoyé
→ Supprimer : nav, footer, aside, scripts, ads
→ Garder : main content, product info, reviews
```

### Données envoyées au backend (POST /api/clips)
```typescript
interface ClipPayload {
  source_url: string;
  source_domain: string;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  review_count: number | null;
  raw_jsonld: object | null;
  raw_markdown: string | null;
  extraction_method: 'jsonld' | 'markdown' | 'hybrid';
  extracted_specs: Record<string, string>;
  extracted_reviews: Array<{
    text: string;
    rating: number | null;
    date: string | null;
    helpful_count: number | null;
  }>;
}
```


## 6. Architecture LLM

### Abstraction Multi-Provider

```typescript
// lib/llm/provider.ts — Interface unifiée

interface LLMProvider {
  generateComparison(clips: Clip[]): Promise<ComparisonResult>;
  generateSingleAnalysis(clip: Clip): Promise<SingleAnalysisResult>;
}

// Le choix du provider dépend du plan :
// - free    → managed key, Haiku 4.5 (cheap)
// - pro     → BYOK key, modèle au choix de l'user
// - complete → managed key, Sonnet 4.5 (performant)
```

### Routing des modèles par plan

| Plan | Provider | Modèle | Qui paie l'API |
|------|----------|--------|---------------|
| Free | Anthropic (managed) | Claude Haiku 4.5 | Nous |
| Pro (BYOK) | Choix de l'user | Choix de l'user | L'utilisateur |
| Complete | Anthropic (managed) | Claude Sonnet 4.5 | Nous |

### Paramètres d'appel
```
temperature: 0.3
max_tokens: 4096
OpenAI: response_format: { type: "json_object" }
Anthropic: pas de JSON mode natif, le prompt suffit
```

### Prompts système : `prompts/briefai_prompts.py` (source de vérité)

### Format de sortie IA (3 couches)
1. **Verdict** : gagnant + résumé + confiance + is_clear_winner
2. **Insights par produit** : strengths, red_flags (severity + evidence + frequency), durability, value_for_money, best_for
3. **Key specs** (repliable) : 4-6 specs différenciantes avec insight contextuel


## 7. Flux de Données Principaux

### Flux 1 : Clipper un produit
```
[Extension Chrome]
  → Content script extrait JSON-LD + avis du DOM
  → Popup affiche "Clip ✓" + choix du projet (optionnel)
  → POST /api/clips avec le ClipPayload + auth token
[API Route /api/clips]
  → Validation du payload
  → Vérification quota (clips_count < limite)
  → INSERT dans table clips
  → increment_usage(clips: 1)
  → Response 201 + clip.id
```

### Flux 2 : Lancer une comparaison
```
[Dashboard — page projet]
  → User sélectionne 2-5 clips → clic "Comparer"
  → POST /api/compare { clip_ids: [...], project_id }
[API Route /api/compare]
  → Vérification quota (check_quota → is_allowed)
  → INSERT comparison (status: 'pending')
  → INSERT comparison_clips
  → Déterminer provider + modèle (selon plan + BYOK)
  → Si BYOK : déchiffrer la clé API de l'user
  → Construire le prompt (system + user avec données des clips)
  → Appel API LLM
  → Parser le JSON de réponse (avec retry si invalide)
  → UPDATE comparison (status: 'completed', result_matrix, result_analysis)
  → increment_usage(comparisons: 1, tokens, cost)
  → Response 200 + comparison.id
[Dashboard — page comparaison]
  → Polling ou realtime sur comparison.status
  → Quand 'completed' : afficher les 3 couches
```

### Flux 3 : Inscription + premier usage
```
[Landing page]
  → Clic "Commencer gratuitement"
  → Supabase Auth : Google OAuth
  → Trigger handle_new_user() → crée le profil (plan: 'free')
  → Redirect vers /dashboard
  → Onboarding : "Installez l'extension Chrome"
```

### Flux 4 : Upgrade vers un plan payant
```
[Dashboard — settings ou modal quota atteint]
  → Clic "Passer au Pro" ou "Passer au Complete"
  → Redirect vers Stripe Checkout (hosted page)
  → Paiement réussi → Stripe envoie webhook
[API Route /api/webhooks/stripe]
  → Event 'checkout.session.completed'
  → UPDATE profiles SET plan = 'pro' | 'complete'
  → Event 'customer.subscription.deleted'
  → UPDATE profiles SET plan = 'free'
```


## 8. Abonnements et Quotas

### Plans

| | Free | Pro (BYOK) | Complete |
|-|------|-----------|----------|
| **Prix** | 0 $ | 7,90 $/mois | 16,90 $/mois |
| **Analyses/mois** | 5 | Illimité | 40 |
| **Clips/mois** | 20 | Illimité | Illimité |
| **Modèle IA** | Haiku 4.5 | Choix user | Sonnet 4.5 |
| **Clé API** | Managed | BYOK | Managed |
| **Projets** | 3 | Illimité | Illimité |
| **Historique** | 30 jours | Illimité | Illimité |

### Logique de quota (côté backend)
```typescript
// Avant chaque action, vérifier :
const quota = await supabase.rpc('check_quota', { p_user_id: userId });
if (!quota.is_allowed) {
  return Response.json({ error: 'quota_exceeded', ...quota }, { status: 429 });
}
```


## 9. Sécurité

### Clés API BYOK
- Chiffrées AES-256-GCM avant stockage dans Supabase
- Clé de chiffrement dans `process.env.ENCRYPTION_KEY` (jamais en BDD)
- Déchiffrées uniquement côté serveur (API routes), jamais exposées au frontend
- Le frontend ne voit que le `key_hint` ("sk-...7xQ2")

### Row Level Security (RLS)
- Activé sur TOUTES les tables
- Chaque user ne peut accéder qu'à ses propres données
- Les fonctions `increment_usage()` et `check_quota()` sont en SECURITY DEFINER

### Auth
- Supabase Auth avec Google OAuth uniquement (MVP)
- L'extension Chrome récupère le token via un cookie partagé sur le domaine briefai.com
- Toutes les API routes vérifient le token Supabase en premier

### Variables d'environnement requises
```env
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Côté serveur uniquement
ANTHROPIC_API_KEY=sk-ant-...              # Clé managed (pour free + complete)
OPENAI_API_KEY=sk-...                     # Clé managed (fallback)
ENCRYPTION_KEY=...                        # AES-256 pour chiffrer les clés BYOK
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=https://briefai.com
```


## 10. Conventions de Code

### Nommage
- **Fichiers** : kebab-case (`comparison-card.tsx`, `llm-provider.ts`)
- **Composants React** : PascalCase (`ComparisonCard`, `RedFlagBadge`)
- **Fonctions/variables** : camelCase (`fetchComparison`, `clipCount`)
- **Tables BDD** : snake_case (`comparison_clips`, `api_keys`)
- **Types TypeScript** : PascalCase (`ClipPayload`, `ComparisonResult`)

### Patterns
- **Server Components par défaut** (Next.js App Router)
- **Client Components** seulement quand nécessaire (`'use client'` pour interactivité)
- **API Routes** pour toute logique serveur (appels LLM, Stripe, déchiffrement)
- **Pas de ternaires imbriqués** — if/else explicites pour la lisibilité
- **Erreurs explicites** — toujours retourner un objet `{ error: string, code: string }` en cas d'échec API

### UI
- **shadcn/ui** comme base de composants
- **Tailwind CSS** pour le styling
- **Pas de CSS custom** sauf exception justifiée
- **Mobile-responsive** dès le départ (le dashboard doit être utilisable sur tablette)


## 11. Roadmap des Phases

| Phase | Semaines | Objectif | Livrable |
|-------|----------|----------|----------|
| 1. Fondations | 1-2 | Setup complet | Auth + BDD + layout dashboard + déploiement Vercel |
| 2. Extension Chrome | 3-4 | Clipper fonctionnel | Extension qui extrait JSON-LD + avis → envoie au backend |
| 3. Cœur IA | 5-7.5 | Comparaison + analyse | Appels LLM, affichage résultats, abstraction BYOK |
| 4. Monétisation | 7.5-10 | Stripe + crédits | Checkout, webhooks, quotas, page settings BYOK |
| 5. Polish + Launch | 10-11 | Production ready | Landing page, onboarding, tests, soumission Chrome Web Store |


## 12. Décisions Techniques Figées

Ces décisions sont FINALES pour le MVP. Ne pas les remettre en question en cours de développement :

1. ✅ Next.js App Router (pas Pages Router)
2. ✅ Supabase (pas Firebase)
3. ✅ Extension et Web App dans des repos séparés
4. ✅ JSON-LD en priorité d'extraction (pas de DOM scraping pur)
5. ✅ Prompts système en anglais, réponses dans la langue des données
6. ✅ Sortie LLM en JSON structuré (pas de markdown à parser)
7. ✅ Chiffrement AES-256 pour les clés BYOK
8. ✅ Système de crédits (pas d'usage illimité sur le plan Complete)
9. ✅ Un seul provider BYOK supporté au lancement → les deux (OpenAI + Anthropic)
10. ✅ Google Auth uniquement (pas d'email/password pour le MVP)
