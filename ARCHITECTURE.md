# BriefAI — Architecture Reference Document
# Version: MVP v1.1 | Last updated: 2026-03-06
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
Frontend + Backend    : Next.js 16+ (App Router, TypeScript)
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
│   │   └── callback/route.ts           # Route handler OAuth callback
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Layout dashboard (sidebar + header, auth guard)
│   │   ├── page.tsx                    # Vue d'ensemble (stats + empty state)
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
│   │   │   └── route.ts               # GET + POST: clips (auth + quota)
│   │   ├── compare/
│   │   │   └── route.ts               # POST: lancer une comparaison IA
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts         # Webhooks Stripe
│   │   └── health/
│   │       └── route.ts               # Health check
│   ├── layout.tsx                      # Root layout (HTML shell, pas d'auth ici)
│   └── globals.css                     # Tailwind base styles
├── components/
│   ├── ui/                             # Composants UI réutilisables (shadcn/ui)
│   ├── dashboard/
│   │   ├── sidebar.tsx                 # Sidebar navigation (Client Component)
│   │   └── header.tsx                  # Header avec avatar + déconnexion
│   ├── comparison/                     # Composants d'affichage des résultats IA
│   └── marketing/                      # Composants landing page
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Client Supabase (browser, createBrowserClient)
│   │   ├── server.ts                   # Client Supabase (server, createServerClient)
│   │   └── middleware.ts               # Middleware Supabase (refresh session + auth guard)
│   ├── llm/
│   │   ├── provider.ts                 # Abstraction multi-provider (Anthropic + OpenAI)
│   │   ├── prompts.ts                  # Prompts système (comparaison + solo)
│   │   └── parser.ts                   # Parsing + validation du JSON LLM
│   ├── stripe/
│   │   ├── client.ts                   # Config Stripe
│   │   └── webhooks.ts                 # Logique de traitement des webhooks
│   └── utils/
│       ├── quota.ts                    # Vérification des quotas + increment usage
│       ├── encryption.ts               # Chiffrement/déchiffrement clés API (AES-256)
│       └── format.ts                   # Helpers de formatage (prix, dates, specs)
├── middleware.ts                        # ⚠️ RACINE — Next.js middleware (appelle lib/supabase/middleware)
├── database/
│   ├── briefai_schema.sql              # Migration initiale
│   └── briefai_schema.mermaid          # Diagramme ERD
├── prompts/
│   └── briefai_prompts.py              # Prompts de référence (source de vérité)
├── ARCHITECTURE.md                     # CE FICHIER
├── public/
├── .env.local                          # Variables d'environnement (JAMAIS commité)
└── package.json
```

**⚠️ Point critique :** `app/layout.tsx` (root) ne contient AUCUNE logique d'auth ni de redirection.
L'auth guard est dans `app/(dashboard)/layout.tsx` + `middleware.ts`. Séparer les deux layouts
a causé une boucle de redirection infinie quand le root layout contenait la logique dashboard.

### Repo 2 : `briefai-extension` (Chrome Extension)

```
briefai-extension/
├── src/
│   ├── manifest.json                   # Manifest V3
│   ├── background/
│   │   └── service-worker.ts           # Service worker (gère la comm avec le dashboard)
│   ├── content/
│   │   ├── extractor.ts                # ✅ Orchestrateur 4 niveaux (merge + confidence)
│   │   ├── extract-jsonld.ts           # ✅ Level 1: JSON-LD schema.org/Product
│   │   ├── extract-amazon.ts           # ✅ Level 2: Sélecteurs Amazon (multi-locale)
│   │   ├── extract-microdata.ts        # ✅ Level 3: Microdata itemprop/itemscope
│   │   ├── extract-generic.ts          # ✅ Level 4: CSS fallback générique
│   │   ├── types.ts                    # ✅ Interfaces TypeScript (ProductData, etc.)
│   │   └── utils.ts                    # ✅ Parsers prix/rating/reviews (EU/US, &nbsp;)
│   ├── popup/
│   │   ├── popup.html                  # UI du popup (mini, 3 boutons max)
│   │   ├── popup.ts                    # Logique du popup
│   │   └── popup.css
│   └── utils/
│       ├── api.ts                      # Appels vers briefai.com/api/clips
│       └── auth.ts                     # Gestion du token auth (cookie Supabase)
├── tests/
│   ├── validate-extraction.py          # ✅ Suite de tests Python (10/10 fixtures)
│   ├── run-extraction-tests.ts         # Suite de tests TypeScript (jsdom)
│   └── fixtures/                       # ✅ 10 pages HTML de test
│       ├── amazon_fr_aspirateur.txt    #   Dyson V8 (Level 2, complet)
│       ├── amazon_fr_livre.txt         #   Zarathoustra (Level 2, layout livre)
│       ├── amazon_fr_tv.txt            #   Xiaomi TV (Level 2, complet)
│       ├── amazon_es_telephone.txt     #   Galaxy S26 (Level 2, 0 avis, ES)
│       ├── boulanger_fr_aspirateur.txt #   Rowenta (Level 1, JSON-LD parfait)
│       ├── cdiscount_fr_trottinette.txt#   Ausom L2 (Level 1, @type lowercase)
│       ├── darty_fr_lave_linge.txt     #   Candy (Level 3, Microdata)
│       ├── decathlon_fr_tente_trekking.txt # MT900 (Level 1, sans rating)
│       ├── fnac_fr_casque.txt          #   Sony WH-CH720N (Level 4, CSS only)
│       └── sephora_fr_parfum.txt       #   Tom Ford (Level 3, multi-variantes)
├── package.json
├── tsconfig.json
└── vite.config.ts
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

### Stratégie à 4 niveaux (cascade avec merge)

L'extraction exécute TOUS les niveaux applicables, puis merge les résultats
en priorisant les sources les plus fiables. Cela permet de compléter les
trous (ex: JSON-LD sans rating + Microdata avec rating = on garde les deux).

**Niveau 1 — JSON-LD (prioritaire)**
```
Document → querySelectorAll('script[type="application/ld+json"]')
         → parse → chercher @type: "Product" (case-insensitive !)
         → extraire : name, brand, price, rating, reviewCount, offers, description
```
Couverture validée : Boulanger ✅, Cdiscount ✅ (attention: @type lowercase), Decathlon ✅
Non couvert : Amazon (pas de JSON-LD Product), Fnac (pas de JSON-LD Product)

**Niveau 2 — Sélecteurs Amazon (multi-locale)**
```
Détection : isAmazonDomain(hostname) + présence de #productTitle
Sélecteurs principaux :
  - Titre       : #productTitle
  - Prix        : input[name="priceValue"] → .a-offscreen (skip vides) → .a-color-price
  - Note        : #acrPopover[title]
  - Avis        : #acrCustomerReviewText (⚠️ contient &nbsp; à parser)
  - Marque      : #bylineInfo (multi-locale: FR/ES/EN/DE/IT)
  - Image       : #landingImage[data-old-hires] → [data-old-hires] → #imgTagWrapperId img
  - Description : #feature-bullets .a-list-item → #bookDescription (livres)
  - ASIN        : input[name="asin"] → [data-asin]
```
Couverture validée : Amazon FR (aspirateur ✅, livre ⚠️ layout différent, TV ✅), Amazon ES ✅
⚠️ Les livres Amazon n'ont pas #feature-bullets ni #priceValue (utiliser .a-color-price)
⚠️ Produits récents peuvent n'avoir aucun avis (#acrPopover absent)

**Niveau 3 — Microdata (itemprop/itemscope)**
```
Détection : [itemtype*="schema.org/Product"] ou [itemtype*="schema.org/IndividualProduct"]
Sélecteurs : [itemprop="name"], [itemprop="price"], [itemprop="brand"], etc.
⚠️ Brand : chercher dans le scope Brand → meta[itemprop="name"][content]
⚠️ Multi-variantes : Sephora a 3 Offers (30ml/50ml/250ml) → prendre la première
```
Couverture validée : Darty ✅, Sephora ⚠️ (multi-variantes, pas de rating)

**Niveau 4 — CSS fallback générique**
```
Dernier recours. Sélecteurs communs e-commerce :
  - Titre  : h1[class*="product-title"], og:title
  - Prix   : [data-price], og:price:amount
  - Note   : [class*="rating"][aria-label], patterns "X,X" dans éléments courts
  - Avis   : pattern "\d+ avis|reviews" dans le body
  - Image  : og:image
  - Desc   : og:description, meta[name="description"]
```
Couverture validée : Fnac ⚠️ (extraction fragile mais fonctionnelle)

### Bugs connus corrigés
- `&nbsp;` dans les prix et review counts Amazon → parser avec .replace('&nbsp;', '')
- `||` vs `??` pour les valeurs falsy (prix=0, rating=0) → utiliser `??` partout
- @type "product" en minuscule (Cdiscount) → comparaison case-insensitive

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
  description: string | null;
  raw_jsonld: object | null;
  raw_markdown: string | null;
  extraction_method: 'jsonld' | 'amazon' | 'microdata' | 'markdown' | 'hybrid';
  extraction_confidence: number;       // 0-1
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
  → Content script exécute extractProduct(document)
  → Cascade : JSON-LD → Amazon → Microdata → CSS fallback
  → Merge des résultats, calcul du confidence score
  → Popup affiche "Clip ✓" + choix du projet (optionnel)
  → POST /api/clips avec le ClipPayload + auth cookie
[API Route /api/clips]
  → Auth check via supabase.auth.getUser()
  → Validation du payload (source_url + product_name requis)
  → Vérification quota (checkQuota → is_allowed)
  → INSERT dans table clips (utilise ?? pas || pour les valeurs falsy)
  → incrementUsage(clips: 1)
  → Response 201 + clip.id + quota restant
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
[Page /login]
  → Clic "Continuer avec Google"
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Redirect vers Google → consentement → redirect vers /callback?code=xxx
[Route /callback]
  → supabase.auth.exchangeCodeForSession(code)
  → Redirect vers / (dashboard)
[Middleware (middleware.ts)]
  → Chaque requête : refresh session via supabase.auth.getUser()
  → Routes /login, /callback, /api → pass through (pas de redirect)
  → Autres routes sans user → redirect vers /login
  → /login avec user → redirect vers /
[Dashboard layout]
  → Double vérification : supabase.auth.getUser() → redirect si pas connecté
  → Affiche sidebar + header avec avatar Google + nom
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

### Logique de quota (côté backend — implémenté dans lib/utils/quota.ts)
```typescript
// Avant chaque action, vérifier :
const quota = await checkQuota(supabase, user.id, 'clips');
if (!quota.is_allowed) {
  return NextResponse.json(
    { error: 'quota_exceeded', code: 'QUOTA_EXCEEDED', ...quota },
    { status: 429 }
  );
}
// Après l'action :
await incrementUsage(supabase, user.id, 'clips');
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
- 3 clients Supabase : browser (client.ts), server (server.ts), middleware (middleware.ts)
- Middleware Next.js (middleware.ts à la racine) refresh la session à chaque requête
- ⚠️ Le root layout (app/layout.tsx) ne doit JAMAIS contenir de logique d'auth
- L'auth guard est dans : middleware.ts (redirect) + (dashboard)/layout.tsx (double check)
- Routes exclues du redirect : /login, /callback, /api/*
- L'extension Chrome récupérera le token via un cookie partagé sur le domaine briefai.com
- Toutes les API routes vérifient le token via supabase.auth.getUser()

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

| Phase | Semaines | Objectif | Livrable | Statut |
|-------|----------|----------|----------|--------|
| 0. Préparation | 0 | Fondations doc | Architecture, schema SQL, prompts, 10 fixtures | ✅ DONE |
| 1. Fondations | 1-2 | Setup complet | Auth Google + BDD + layout dashboard + API clips | ✅ DONE |
| 2. Extension Chrome | 3-4 | Clipper fonctionnel | Extracteur 4 niveaux ✅, popup + service worker + packaging | ⏳ EN COURS |
| 3. Cœur IA | 5-7.5 | Comparaison + analyse | Appels LLM, affichage résultats, abstraction BYOK | ⬜ TODO |
| 4. Monétisation | 7.5-10 | Stripe + crédits | Checkout, webhooks, quotas, page settings BYOK | ⬜ TODO |
| 5. Polish + Launch | 10-11 | Production ready | Landing page, onboarding, tests, Chrome Web Store | ⬜ TODO |


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
