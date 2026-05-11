# Sumear — Architecture Reference Document
# Version: MVP v2.4 | Last updated: 2026-04-20
# ⚠️ CE FICHIER EST LA SOURCE DE VÉRITÉ DU PROJET.
# à donner en contexte à Cursor/Claude à chaque session de code.


## 1. Vision Produit

Sumear est un assistant shopping e-commerce par IA. Positionnement : "le Notion Web Clipper du e-commerce".

**Deux composants :**
- **Extension Chrome** (capture + interaction rapide) → clippe les produits, gère les projets, et donne un accès direct au chat IA en contexte
- **Web App / Dashboard** (espace d'analyse complet) → vue d'ensemble, projets, historique, paramètres, chat IA avec contexte enrichi

**Principe UX fondamental :** l'extension est le point d'entrée naturel — l'utilisateur navigue sur un site marchand, clippe un produit en un clic, et peut immédiatement poser des questions à l'IA depuis la page marchande (split-view). Le dashboard est l'espace d'organisation et de réflexion long-terme (projets, budgets, historique).

**Pivot v2 (mars 2026) :** le système de comparaison structurée (matrice JSON, verdict, red flags) initialement prévu a été remplacé par un **chat conversationnel contextualisé**. L'IA reçoit les données des produits sélectionnés et répond en langage naturel, avec streaming. Ce pivot est volontaire — l'expérience chat est plus naturelle et flexible qu'une matrice figée.

**Positionnement concurrentiel :** mandataire exclusif de l'acheteur. Aucun lien commercial avec les marchands. L'IA révèle ce que les fiches produit cachent.


## 2. Stack Technique

```
Frontend + Backend    : Next.js 16+ (App Router, TypeScript)
Base de données       : Supabase (PostgreSQL + Auth + RLS)
Hébergement           : Vercel
Paiements             : Stripe (Checkout, Customer Portal, Webhooks) — implémenté (test + prod à configurer)
APIs LLM              : Anthropic (Claude) — OpenAI reporté post-launch
Extension Chrome      : Manifest V3, vanilla TypeScript, Vite bundler
```

### Pourquoi ces choix
- **Next.js** : un seul repo pour le dashboard, les API routes (proxy LLM, webhooks Stripe), et la landing page. TypeScript partout.
- **Supabase** : Auth Google pré-intégré, PostgreSQL + RLS pour la sécurité par défaut, tier gratuit suffisant pour le MVP.
- **Vercel** : déploiement en `git push`, zéro DevOps.
- **Extension séparée** : repo distinct, cycle de release indépendant (soumission Chrome Web Store ≠ déploiement web).


## 3. Repos et Structure des Dossiers

### Repo 1 : `sumear-app` (Next.js)

```
sumear-app/
├── app/
│   ├── (auth)/
│   │   └── callback/route.ts           # Route handler OAuth callback
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Layout dashboard (DashboardShell, auth guard)
│   │   ├── page.tsx                    # Vue d'ensemble (3 stat cards : clips / projets actifs / discussions ; grille récents ; projets)
│   │   ├── projects/
│   │   │   ├── page.tsx                # Liste des projets
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Détail projet (Server Component — data fetching)
│   │   │       └── project-detail-client.tsx  # Client Component — split-view chat
│   │   ├── clips/page.tsx              # Tous les clips (grille 4 colonnes)
│   │   ├── chat/page.tsx               # Chat IA (page dashboard)
│   │   ├── historique/page.tsx          # Historique des conversations
│   │   └── settings/page.tsx           # Server — auth + profil → délègue à SettingsClient
│   ├── [lang]/
│   │   ├── layout.tsx                  # Validation locale (fr/en), pass-through
│   │   ├── login/
│   │   │   ├── page.tsx                # Page de connexion i18n (two-column layout, Server Component)
│   │   │   └── google-button.tsx       # Client Component — signInWithOAuth + loading + error display
│   │   └── (marketing)/
│   │       ├── layout.tsx              # Layout marketing : MarketingHeader + main + MarketingFooter
│   │       ├── page.tsx                # Landing page : HeroSection + FeaturesSection + PricingSection (dark) + FaqSection
│   │       └── legal/
│   │           ├── cgu/page.tsx        # CGU (markdown → HTML)
│   │           ├── privacy/page.tsx    # Politique de confidentialité
│   │           └── mentions/page.tsx  # Mentions légales
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts               # POST: chat IA (streaming SSE)
│   │   │   └── sessions/
│   │   │       ├── route.ts           # GET: liste des sessions
│   │   │       └── [id]/route.ts      # GET: détail d'une session
│   │   ├── clips/route.ts             # GET + POST: clips (auth + quota)
│   │   ├── projects/
│   │   │   ├── chat/route.ts          # POST: chat comparaison
│   │   │   └── [id]/route.ts          # GET: résultat comparaison
│   │   ├── projects/
│   │   │   ├── route.ts               # GET + POST: projets
│   │   │   └── [id]/clips/route.ts    # GET: clips d'un projet
│   │   ├── proxy-image/route.ts        # GET: proxy images (CORS)
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts       # POST: session Checkout (auth)
│   │   │   └── portal/route.ts         # POST: session Customer Portal (auth)
│   │   ├── webhooks/stripe/route.ts    # POST: Stripe (signature, service_role → Supabase)
│   │   └── health/route.ts            # Health check
│   ├── chat/embed/page.tsx             # Chat en iframe (extension split-view)
│   ├── layout.tsx                      # Root layout (fonts, theme script, pas d'auth)
│   └── globals.css                     # CSS: Tailwind + thèmes light/dark (CSS variables)
├── components/
│   ├── ui/
│   │   ├── sumear-logo-badge.tsx       # Badge logo (4 lignes, theme-aware)
│   │   ├── sumear-wordmark.tsx         # Wordmark "su·mear" (terracotta)
│   │   ├── button.tsx, card.tsx, ...   # Composants shadcn/ui
│   ├── chat/
│   │   └── chat-content.tsx            # ⭐ Chat (embed + dashboard + split-view) ; modal upgrade si QUOTA_EXCEEDED
│   ├── billing/
│   │   └── upgrade-modal.tsx           # Modal upgrade (quota) → Checkout
│   ├── dashboard/
│   │   └── embed-content.tsx           # Embed comparaison
│   ├── dashboard/
│   │   ├── sidebar.tsx                 # DashboardShell (sidebar + topbar + footer + theme toggle — masqué sur /settings)
│   │   ├── greeting.tsx                # Client — salutation contextuelle selon l'heure + prénom
│   │   ├── header.tsx                  # Header (legacy)
│   │   └── recent-clips-grid.tsx       # Grille produits récents (dashboard home)
│   ├── settings/
│   │   ├── settings-client.tsx         # Client — UI paramètres (Compte / Abonnement / Préférences / Zone sensible)
│   │   └── billing-section.tsx         # Client — boutons Stripe (legacy, logique intégrée dans settings-client)
│   ├── marketing/
│   │   ├── header.tsx                  # Header marketing (logo, nav, toggle langue, CTA login)
│   │   ├── footer.tsx                  # Footer marketing (liens légaux)
│   │   ├── hero-section.tsx            # Section hero (grille 2 col, mock navigateur, CTA Chrome)
│   │   ├── features-section.tsx        # Grille 6 features (icon + titre + body depuis dict)
│   │   ├── pricing-section.tsx         # Plans Free/Complete, toggle mensuel/annuel, onDarkBackground prop
│   │   ├── faq-section.tsx             # Accordion FAQ
│   │   └── legal-content.tsx           # Rendu HTML pages légales (depuis markdown)
│   ├── theme-provider.tsx              # Context provider thème
│   └── theme-toggle.tsx                # Bouton toggle thème
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Client Supabase (browser, createBrowserClient)
│   │   ├── server.ts                   # Client Supabase (server + JWT variant)
│   │   ├── admin.ts                    # Service role — webhooks uniquement (jamais côté client)
│   │   └── proxy.ts                    # Proxy pour requêtes iframe
│   ├── stripe.ts                       # Client Stripe, Checkout + Portal
│   ├── stripe-app-origin.ts            # Base URL trustée (success/cancel — évite open redirect)
│   ├── config/
│   │   └── plans.ts                    # PLAN_LIMITS, normalizeBillingPlan
│   ├── legal/
│   │   └── get-legal-content.ts        # Charge et convertit les fichiers markdown → HTML (pages légales)
│   ├── llm/
│   │   ├── provider.ts                 # Abstraction LLM: callLLM() + streamLLM() (Anthropic)
│   │   └── (provider.ts seul — prompts.ts supprimé avec compare)
│   ├── types/
│   │   └── ebay.ts                     # Types partagés eBay (EbayData, EbaySellerData, EbaySellerFeedback, EbayAuctionData, EbayDetailedRatings)
│   └── utils/
│       ├── quota.ts                    # checkQuota() + incrementUsage() par plan
│       ├── url.ts                      # extractDomain() + normalizeProductUrl() (strip tracking params, sort, trailing slash)
│       ├── sanitize.ts                 # sanitizeProductData() + detectSuspiciousMessage() (prompt injection)
│       ├── rate-limit.ts               # Sliding-window in-memory rate limiter
│       ├── ai-log.ts                   # logAiCall() fire-and-forget (table ai_logs)
│       ├── validate-ebay.ts            # Validation + clamp du payload ebay_data reçu par /api/clips
│       └── format-ebay-context.ts      # coerceEbayData + formatEbayContext + EBAY_SYSTEM_PROMPT_ADDENDUM (prompt LLM)
├── content/                            # Contenu markdown des pages légales (servi via get-legal-content.ts)
│   ├── fr/cgu.md, privacy.md, mentions.md
│   └── en/cgu.md, privacy.md, mentions.md
├── database/
│   ├── sumear_schema.sql              # Schéma de référence (install fraîche)
│   ├── chat_history.sql               # Tables chat (sessions, messages, …)
│   ├── stripe_profiles_migration.sql  # Colonnes Stripe + trigger anti-escalade plan
│   ├── quota_ai_messages_migration.sql, check_quota_migration.sql, project_ai_brief_cache_migration.sql
│   ├── ai_logs_migration.sql          # Table ai_logs (monitoring tokens)
│   ├── security_logs_migration.sql    # Table security_logs (prompt injection monitoring)
│   ├── clips_updated_at_migration.sql # Colonne updated_at sur clips (déduplication)
│   ├── clips_ebay_data_migration.sql  # Colonnes ebay_data (JSONB) + ebay_data_refreshed_at + index partiel + fonction TTL cleanup_ebay_seller_feedback()
│   ├── user_budget_migration.sql      # Colonne user_budget sur projects (budget cible injecté dans le brief IA)
│   └── sumear_schema.mermaid          # Diagramme ERD
├── ARCHITECTURE.md                     # CE FICHIER
└── package.json
```

**i18n marketing :** Les pages marketing sont servies sous `/fr/...` et `/en/...`. Le middleware (`proxy.ts`) redirige les URLs sans préfixe (`/`, `/legal`, `/privacy`, `/mentions`) vers la locale préférée (cookie `sumear-locale` → Accept-Language → `fr` par défaut). `getDictionary(locale)` appelle `notFound()` si la locale n'est pas `fr` ou `en`, évitant le crash quand `[lang]` capture un segment non-locale.

**⚠️ Point critique :** `app/layout.tsx` (root) ne contient AUCUNE logique d'auth ni de redirection.
L'auth guard est dans `app/(dashboard)/layout.tsx`. Séparer les deux layouts
a causé une boucle de redirection infinie quand le root layout contenait la logique dashboard.

**⚠️ Routing login :** La page de connexion est à `app/[lang]/login/` (i18n). L'auth guard redirige vers `/${locale}/login`. Le middleware `lib/supabase/proxy.ts` utilise `isLoginPath()` qui reconnaît `/login` ET `/${locale}/login` — sans ça une boucle de redirect se déclenche.

### Repo 2 : `sumear-extension` (Chrome Extension)

```
sumear-extension/
├── src/
│   ├── manifest.json                   # Manifest V3
│   ├── config.ts                       # Configuration (URLs)
│   ├── background/
│   │   └── service-worker.ts           # Service worker (comm avec le dashboard, auth relay)
│   ├── content/
│   │   ├── extractor.ts                # Orchestrateur 4 niveaux (merge + confidence) ; appelle extractEbay() en enrichissement si isEbayDomain(hostname)
│   │   ├── extract-jsonld.ts           # Level 1: JSON-LD schema.org/Product
│   │   ├── extract-amazon.ts           # Level 2: Sélecteurs Amazon (multi-locale)
│   │   ├── extract-microdata.ts        # Level 3: Microdata itemprop/itemscope
│   │   ├── extract-generic.ts          # Level 4: CSS fallback générique
│   │   ├── extract-ebay.ts             # Enrichissement eBay (async) : condition, listing_type, seller, feedback, auction, description iframe
│   │   ├── types-ebay.ts               # Types eBay partagés avec sumear-app/lib/types/ebay.ts (mirroir strict)
│   │   ├── content-script.ts           # Injection split-view (iframe chat)
│   │   ├── sync-auth.ts                # Synchronisation auth Supabase
│   │   ├── types.ts                    # Interfaces TypeScript (ProductData, etc. — ebay_data optionnel)
│   │   └── utils.ts                    # Parsers prix/rating/reviews
│   ├── popup/
│   │   ├── popup.html                  # Structure popup (4 sections : analyser ce produit / analyser des produits / projets)
│   │   ├── popup.ts                    # Logique popup (clip + compare list + projets). renderRatingOrSellerBadge() : sur eBay, remplace la note produit par un badge vendeur "{positive_feedback_percent}% positive ({items_sold} sales)" ; tint vert ≥98 %, rouge <90 %, neutre sinon. textContent-only (anti-XSS).
│   │   └── popup.css                   # Styles popup (+ classes .compare-* autonomes hex ; .seller-badge + variantes --success / --warning)
│   └── utils/
│       ├── api.ts                      # Appels vers sumear.app/api/* ; ClipResponse.code ('CLIP_CREATED'|'CLIP_UPDATED')
│       └── auth.ts                     # Gestion du token auth (cookies Supabase multi-origin)
├── package.json
├── tsconfig.json
└── vite.config.ts
```


## 4. Modèle de Données

### Tables (10 tables + 1 à créer)

| Table | Rôle | Clés importantes |
|-------|------|-----------------|
| `profiles` | Utilisateurs (extension de auth.users) | `plan` (enum BDD `free`/`pro`/`complete` — app : Free vs Complete), `stripe_customer_id`, `stripe_subscription_id` ; trigger `profiles_protect_billing_fields` (mise à jour plan/Stripe réservée au JWT `service_role`) |
| `api_keys` | Clés BYOK chiffrées | `UNIQUE(user_id, provider)` |
| `projects` | Dossiers d'achat | `emoji`, `position` pour le tri |
| `clips` | Produits capturés | `project_id` nullable, `raw_jsonld`, `extracted_specs`, `updated_at` (déduplication — migration `clips_updated_at_migration.sql`), `ebay_data` JSONB + `ebay_data_refreshed_at` (NULL sauf pour les fiches eBay — migration `clips_ebay_data_migration.sql`) |
| `comparisons` | **(legacy — supprimé du code, table conservée en DB)** | `result_matrix`, `result_analysis` |
| `comparison_clips` | **(legacy — supprimé du code, table conservée en DB)** | `PRIMARY KEY(comparison_id, clip_id)` |
| `usage` | Compteurs mensuels | `UNIQUE(user_id, year, month)` |
| `chat_sessions` | Sessions de chat IA | `user_id`, `title` |
| `chat_session_clips` | Liaison N:N sessions↔clips | `PRIMARY KEY(session_id, clip_id)` |
| `chat_messages` | Messages d'une session | `role` (user/assistant), `content` |
| `ai_logs` | Logs d'appels LLM (monitoring) | `model`, `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `cost_usd` |
| `security_logs` | Logs de messages suspects (prompt injection monitoring) | `user_id`, `message` (tronqué 500 chars), `triggers` (json), `ip`, `created_at` — consultables via `GET /api/admin/suspicious` |

**Note :** Les tables `comparisons` et `comparison_clips` sont legacy. Le code applicatif (routes, composants, prompts) a été supprimé — seules les tables DB restent pour l'historique.

### Fichiers SQL : `database/sumear_schema.sql` + `database/chat_history.sql` + migrations (`stripe_profiles_migration.sql`, quotas, brief cache — voir dossier `database/`)

### Fonctions Supabase clés
- `increment_usage()` : upsert atomique des compteurs mensuels (`clips_count`, `ai_messages_count`, tokens/coût)
- `check_quota(p_user_id)` : agrégat JSON aligné sur `lib/config/plans.ts` (clips/projets en COUNT, comparaisons + IA sur le mois courant). **Non appelée par l’app** aujourd’hui — l’enforcement passe par `checkQuota()` en TS. Exécuter `database/check_quota_migration.sql` sur les BDD existantes pour remplacer l’ancienne version (comparaisons seules, limites obsolètes).
- `cleanup_ebay_seller_feedback()` : `SECURITY DEFINER`, `search_path = public`. Vide l'array `seller_feedback` des clips eBay dont `ebay_data_refreshed_at` date de plus de 30 jours (TTL). Supabase n'a pas de cron natif — à câbler via `pg_cron` ou edge function schedulée pour tourner quotidiennement.


## 5. Système d'Extraction (Extension Chrome)

### Stratégie à 4 niveaux (cascade avec merge)

L'extraction exécute TOUS les niveaux applicables, puis merge les résultats
en priorisant les sources les plus fiables.

**Niveau 1 — JSON-LD (prioritaire)**
```
Document → querySelectorAll('script[type="application/ld+json"]')
         → parse → chercher @type: "Product" (case-insensitive)
         → extraire : name, brand, price, rating, reviewCount, offers, description
```
Couverture validée : Boulanger ✅, Cdiscount ✅, Decathlon ✅

**Niveau 2 — Sélecteurs Amazon (multi-locale)**
```
Détection : isAmazonDomain(hostname) + présence de #productTitle
Sélecteurs : #productTitle, input[name="priceValue"], #acrPopover, #bylineInfo, etc.
```
Couverture validée : Amazon FR/ES/DE ✅

**Niveau 3 — Microdata (itemprop/itemscope)**
```
Détection : [itemtype*="schema.org/Product"]
Sélecteurs : [itemprop="name"], [itemprop="price"], etc.
```
Couverture validée : Darty ✅, Sephora ✅

**Niveau 4 — CSS fallback générique**
```
Dernier recours : h1[class*="product-title"], og:title, og:image, etc.
```
Couverture validée : Fnac ⚠️ (fragile)

**Enrichissement eBay (additif, async)**
```
Détection : isEbayDomain(hostname) → /^(?:.*\.)?ebay\.[a-z.]+$/i
```
eBay expose déjà un JSON-LD Product (Niveau 1 remonte name/brand/price/images/model/mpn),
donc `extractEbay()` n'écrase RIEN de la cascade — il ajoute un champ `ebay_data`
à côté. Appelé depuis `extractor.ts` après le merge, dans un `try/catch` qui retombe
sur `null` en cas d'échec. Chaque champ est extrait dans son propre `try/catch`
pour ne jamais crasher l'extraction complète.

Champs remplis :
- `listing_type` (`buy_it_now | auction | both`) — détection via CTA "Place bid" / "Buy It Now" (multi-locale : FR/EN/ES)
- `condition` (string clamp 100 chars)
- `auction_data` (seulement si `listing_type ∈ {auction, both}`) — current_bid, bid_count, time_left, reserve_met (parsé depuis `.x-price-primary`, `[data-testid="x-bid-count"]`, `.x-end-time`, `.x-reserve-met`)
- `seller` (4 sections DOM agrégées) :
  - `.x-sellercard-atf` → `feedback_score` (shape `(705)`)
  - `.x-store-information` → `name`, `positive_feedback_percent`, `items_sold`, `member_since` (icône `#icon-calendar-16`), `response_time` (icône `#icon-clock-16` ou 2ᵉ ligne fallback)
  - `.fdbk-detail-list__title` → `feedback_count` (shape `Seller feedback (96)`)
  - `.fdbk-seller-rating__detailed-list` → `detailed_ratings` : `accurate_description`, `reasonable_shipping_cost`, `shipping_speed`, `communication` (floats 0–5)
- `seller_feedback` (max 8) — extraits de `.fdbk-detail-list__cards > li.fdbk-container` : `comment`, `username` (déjà pseudonymisé par eBay), `date`, `verified_purchase`, `item_name`. La page rend uniquement l'onglet "positif" par défaut → `rating: 'positive'` baked-in (hypothèse documentée dans le code)
- `seller_description` — iframe cross-origin (`iframe#desc_ifr` / `src*="ebaydesc.com"`). Fetch délégué au service worker (voir §5.1).

Couverture validée : ebay.com (Buy It Now + auction). Multi-locales partiellement couvertes via regex label fallback (FR/ES présentes, DE/IT silencieusement dégradées à `null`).

#### 5.1 Proxy iframe description eBay (service worker)

`chrome.runtime.onMessage` handler `fetchEbayDescription` dans `sumear-extension/src/background/service-worker.ts` :

- **Whitelist hôte stricte** : `itm.ebaydesc.com`, `vi.vipr.ebaydesc.com` uniquement (rejet `Domain not allowed` sinon).
- **HTTPS obligatoire** (rejet `HTTPS required`).
- `credentials: 'omit'` → aucune identité utilisateur leakée vers eBay.
- Timeout 5 s (`AbortController`).
- Cap réponse 50 KB streaming (queue de `reader.read()`, on annule dès dépassement).
- Parse côté content script via `DOMParser` + `textContent` (pas d'innerHTML) après strip des `script,style,noscript,iframe,link`. Clamp 3000 chars.

Sécurité de la surface d'attaque : `externally_connectable` n'est PAS déclaré dans le manifest, donc seuls les content scripts / popup / service worker de l'extension peuvent déclencher ce handler. Aucune page web tierce ne peut proxy des requêtes arbitraires via l'extension.

Permissions manifest ajoutées :
```json
"host_permissions": [
  "https://itm.ebaydesc.com/*",
  "https://vi.vipr.ebaydesc.com/*"
]
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
  description: string | null;
  raw_jsonld: object | null;
  raw_markdown: string | null;
  extraction_method: 'jsonld' | 'amazon' | 'microdata' | 'markdown' | 'hybrid';
  extraction_confidence: number;
  extracted_specs: Record<string, string>;
  extracted_reviews: Array<{
    text: string;
    rating: number | null;
    date: string | null;
    helpful_count: number | null;
  }>;
  // eBay-only (null partout ailleurs). Validé + clampé par lib/utils/validate-ebay.ts
  // avant persistance dans clips.ebay_data (JSONB). Si listing_type absent ou
  // invalide côté backend → rejet 400 INVALID_EBAY_DATA.
  ebay_data?: EbayData | null;
}
```


## 6. Architecture Chat IA

### Le chat remplace le système de comparaison structurée

Le cœur intelligent de Sumear est un **chat conversationnel contextualisé** :
- L'utilisateur sélectionne 1 à N produits (clips)
- Le system prompt reçoit toutes les données de ces produits
- L'IA répond en français, en langage naturel, en streaming
- Les conversations sont persistées (sessions + messages)

### Composant unique, 3 modes d'utilisation

`ChatContent` (`components/chat/chat-content.tsx`) est le composant central :

| Mode | Déclencheur | Props clés |
|------|------------|------------|
| **Extension split-view** | "Ouvrir le chat" depuis le popup | `isEmbed`, `embedAccessToken`, `zoom: 1.5` |
| **Dashboard page** | Navigation vers `/chat` | Aucune prop spéciale |
| **Project split-view** | "Ouvrir le chat" sur page projet | `initialClips`, `onClose`, `topbarLabel`, `noZoom` |

### Auto-scroll intelligent (v2.4)

Les trois layouts partagent un seul `scrollContainerRef` (un seul est monté à la fois) et un flag `shouldAutoScrollRef` :

- `onScroll` mesure la distance au bas. Seuil 60 px : au-delà, l'auto-scroll se met en pause pour laisser l'utilisateur lire librement pendant que l'IA rédige en streaming.
- Dès que l'utilisateur redescend près du bas, le flag se réarme tout seul.
- Un nouveau message de rôle `user` force le scroll + ré-arme le flag (ton propre message est toujours visible).
- Un nouveau message `assistant` ou un chunk `streamingContent` ne scrolle que si le flag est vrai.

### Welcome state + suggestion chips

- Quand `messages.length === 0`, les trois layouts affichent un welcome state (icône Sumear + "How can I help?" + sous-titre "I've analysed your N products…").
- Les chips de suggestion ("Is it worth the price?", etc.) ne sont rendues que tant que `messages.length === 0 && streamingContent === null`. Dès le premier message envoyé, elles disparaissent définitivement pour laisser place au thread.

### Streaming SSE

```
Client (ChatContent)
  → POST /api/chat { clip_ids, message, history, session_id }
API route
  → Auth + quota check
  → Resolve/create session
  → streamLLM() (Anthropic streaming API)
  → For each token: SSE "data: {"chunk":"..."}"
  → After stream: persist user + assistant messages to DB
  → Final: "data: {"done":true, "session_id":"..."}"
Client
  → Read SSE stream via response.body.getReader()
  → Buffer tokens, drain word-by-word at 180ms interval
  → Display with pulsing cursor animation
```

### Anti-abus du chat

- **Scope rules (v2.4)** : le system prompt autorise l'inférence contextuelle sur les questions vagues (ex. "how many inches" quand une TV est en contexte → taille d'écran) et ne refuse que les questions clairement hors-sujet (maths, code, poèmes, roleplay, présidents, etc.). Les règles anciennes "répondre uniquement `I am Sumear…`" ont été remplacées par une section `SCOPE RULES` plus permissive ; la section `SECURITY RULES` reste intacte (prompt injection, révélation du prompt, exécution de code toujours bloqués).
- **Message length** : 500 caractères max (frontend + API)
- **Token limit** : 1024 max_tokens pour le chat (vs 4096 pour les comparaisons)
- **Quotas** : messages IA mensuels, clips/projets totaux (free) — voir §9 ; code `QUOTA_EXCEEDED` côté API
- **No markdown** : le prompt interdit les formatages markdown dans les réponses
- **eBay addendum** : quand au moins un clip a `ebay_data`, `EBAY_SYSTEM_PROMPT_ADDENDUM` (depuis `lib/utils/format-ebay-context.ts`) est concaténé au system prompt : "consider BOTH the product and the seller's reputation … For auctions, advise on whether the current price is a good deal, NOT on bidding strategy."

### Formatage du contexte produit eBay

`lib/utils/format-ebay-context.ts` transforme le JSONB `ebay_data` en bloc texte ajouté après les champs produit standards. Toutes les valeurs passent par `sanitizeProductData()` pour neutraliser les tentatives de prompt injection cachées dans les descriptions vendeur ou les commentaires de feedback. `coerceEbayData()` gère la forme JSONB (objet, string JSON ou null) et rejette tout payload dépourvu de `listing_type`.

Utilisé dans :
- `app/api/chat/route.ts` — bloc eBay concaténé à chaque clip eBay, addendum ajouté au system prompt si au moins un clip eBay.
- `app/api/projects/[id]/brief/route.ts` — bloc indenté sous chaque produit eBay du brief, addendum au system prompt.

### System prompt (source de vérité dans `api/chat/route.ts`)

Le prompt est en français/anglais hybride :
- `SCOPE RULES` en anglais (inférence contextuelle autorisée, refus bref pour hors-sujet)
- `SECURITY RULES` en anglais (prompt injection + révélation du prompt + code execution bloqués)
- Règles de formatage en anglais
- La langue de la réponse suit automatiquement celle du user ("Always respond in the same language as the user's message")


## 7. Architecture LLM

### Provider : Anthropic uniquement (OpenAI reporté post-launch)

```typescript
// lib/llm/provider.ts
export async function callLLM(plan, systemPrompt, userMessage, options?)
export async function* streamLLM(plan, systemPrompt, userMessage, options?)
```

### Routing des modèles par plan

| Plan | Modèle | Qui paie l'API |
|------|--------|---------------|
| Free | Claude Haiku 4.5 | Nous |
| Complete | Claude Sonnet 4.6 | Nous |

### Paramètres d'appel
```
temperature: 0.3
max_tokens: 1024 (chat) / 256 (AI brief)
Streaming: client.messages.stream() (Anthropic SDK)
```

### Prompt caching (✅ Implémenté)
Le system prompt est envoyé avec `cache_control: { type: "ephemeral" }` pour que les tokens statiques (prompt + données produits) soient cachés côté Anthropic pendant 5 minutes. Un second breakpoint de cache est placé sur le dernier message d'historique pour maximiser les cache hits en multi-turn. `streamLLM()` et `callLLM()` acceptent `string | ChatMessage[]` — la route chat construit un tableau `ChatMessage[]` avec l'historique tronqué (2000 chars/msg). Seuil minimum : 2048 tokens (Haiku), 1024 tokens (Sonnet). `maxTokens` clampé au max du modèle pour éviter les abus.

### OpenAI (post-launch)
OpenAI sera ajouté comme second provider après le lancement. Le routing multi-provider n'est pas une priorité pour le MVP.


## 8. Flux de Données Principaux

### Flux 1 : Clipper un produit
```
[Extension Chrome — popup]
  → Content script exécute extractProduct(document)
  → Cascade : JSON-LD → Amazon → Microdata → CSS fallback
  → Merge des résultats, calcul du confidence score
  → Popup affiche les données extraites
  → User choisit : "Ajouter" (clip simple) ou sélectionne un projet
  → POST /api/clips avec le ClipPayload + auth token
[API Route /api/clips]
  → Auth check (cookie ou JWT)
  → Validation du payload
  → Déduplication : normalizeProductUrl() + candidates same user/domain/project
    → Doublon trouvé → UPDATE clip existant → Response 200 { code: "CLIP_UPDATED", clipId }
    → Pas de doublon → checkQuota(clips) → INSERT → Response 201 { code: "CLIP_CREATED", clipId }
[Extension — popup]
  → "CLIP_UPDATED" → feedback "Mis à jour ✓" (sans consommer de quota)
  → "CLIP_CREATED" → feedback "Ajouté ✓" + quota décrémenté
```

### Flux 2 : Chat IA depuis l'extension
```
[Extension — popup]
  → User clique "Ouvrir le chat" (avec clips ou avec projet)
  → openSplitView() injecte un iframe dans la page marchande
  → L'iframe charge /chat/embed?clips=id1,id2,...
[Chat embed page]
  → ChatContent s'initialise en mode embed
  → Auth via embedAccessToken (relayé par le service worker)
  → Fetch des clips depuis Supabase
  → User pose une question → POST /api/chat (streaming SSE)
  → Réponse affichée word-by-word avec animation
[Fermeture]
  → "Fermer ✕" → postMessage('sumear-close') → content script ferme l'iframe
```

### Flux 3 : Chat IA depuis la page projet (split-view)
```
[Dashboard — page projet /projects/[id]]
  → User clique "Ouvrir le chat" ou "Ouvrir le chat"
  → ProjectDetailClient setState: chatOpen = true
  → Le panneau chat slide-in depuis la droite (400px fixe)
  → ChatContent reçoit initialClips (les produits du projet) + onClose + topbarLabel
  → Même flux SSE que ci-dessus
[Fermeture]
  → "Fermer ✕" → onClose() → chatOpen = false → panel slide-out
  → L'état de la conversation est préservé (pas de remontage)
```

### Flux 4 : Inscription + premier usage
```
[Page /${locale}/login]
  → Clic "Continuer avec Google" (GoogleButton client component)
  → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: origin + '/callback' })
  → Redirect vers Google → consentement → redirect vers /callback
[Route /callback]
  → supabase.auth.exchangeCodeForSession(code)
  → Redirect vers / (dashboard)
[Dashboard layout]
  → supabase.auth.getUser() → redirect /${locale}/login si pas connecté
  → DashboardShell affiche sidebar + header + footer + toggle thème
```

### Flux 6 : Compare list (section "Analyser des produits" du popup)
```
[Extension — popup, section "Analyser des produits"]
  → Lecture de chrome.storage.local["sumear-compare-list"] au démarrage
  → "Ajouter" :
    → POST /api/clips (action 'clip' via service-worker)
    → Dédup locale (url ou clip_id déjà présent) → flash "Ajouté ✓" sans doublon
    → Sinon : push { url, name, price, image_url, clip_id } + save storage + re-render
  → "Retirer" (poubelle) : splice + save storage + re-render
  → "Ouvrir le chat" :
    → openSplitView avec tableau clipIds (toutes les clip_id de la liste)
    → Même mécanisme que le bouton existant — le chat reçoit N produits en contexte
  → Max 5 produits ; "Ajouter" désactivé à 5 (sous-label "5/5")
  → Dropdown ouvert par défaut si liste non vide
```

### Flux 5 : Upgrade vers un plan payant (implémenté)
```
[Dashboard — /settings ou modal quota sur erreur chat]
  → POST /api/stripe/checkout { billing: "monthly" | "yearly" } (auth cookie / session)
  → Réponse { url } → redirect vers Stripe Checkout (hosted)
  → success_url / cancel_url basés sur trustedAppOrigin() → NEXT_PUBLIC_SITE_URL en prod
[Stripe]
  → Paiement → Webhook POST /api/webhooks/stripe (signature STRIPE_WEBHOOK_SECRET)
[API /api/webhooks/stripe — runtime Node, corps brut]
  → checkout.session.completed → service_role Supabase : plan = complete + IDs Stripe
  → customer.subscription.updated (active/trialing) → synchro profil
  → customer.subscription.deleted → plan = free, stripe_subscription_id vidé
  → invoice.payment_failed → log (optionnel)
[Utilisateur Complete]
  → POST /api/stripe/portal → Customer Portal (annulation, CB) ; return_url vers /settings
```
Migr. BDD : `database/stripe_profiles_migration.sql`. Local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe` + `whsec` CLI dans `.env.local`.


## 9. Abonnements et Quotas

### Plans (pricing figé)

| | Free | Complete |
|-|------|----------|
| **Prix mensuel** | 0 € | 12.90 € |
| **Prix annuel** | — | 9.90 €/mois (118.80 €/an) |
| **Messages IA / mois** | 25 | 1 000 |
| **Projets** | 2 (total) | Illimités |
| **Clips** | 8 (total) | Illimités |
| **Modèle IA** | Claude Haiku 4.5 | Claude Sonnet 4.6 |

**Note :** Le plan Pro BYOK a été supprimé. L'enum `profiles.plan` est `free | complete`.

### Mesure d'usage

Un compteur unique `ai_messages` par mois. Chat + Briefs projet comptent dans le même quota. Les clips et projets sont des quotas absolus (pas mensuels) pour le plan free.

### Logique de quota (`lib/utils/quota.ts`)

```typescript
checkQuota(supabase, userId, 'ai_messages' | 'clips' | 'projects') → QuotaResult
incrementUsage(supabase, userId, 'clips' | 'ai_messages', amount)
```

### Config centralisée (`lib/config/plans.ts`)

```typescript
export const PLAN_LIMITS = {
  free: {
    ai_messages_per_month: 25,
    clips_total: 8,
    projects_total: 2,
  },
  complete: {
    ai_messages_per_month: 1000,
    clips_total: Infinity,
    projects_total: Infinity,
  },
} as const;
```

Voir PRELAUNCH.md pour le détail des tâches d'implémentation.


## 10. Design System

### Thèmes

Deux thèmes définis via `data-theme` sur `<html>`, persistés dans `localStorage('sumear-theme')` :

**Light (terracotta)** — défaut
```css
--bg-page: #F9F4F0; --bg-sidebar: #F0E8E0; --bg-card: #FFFCFA;
--accent: #B8715A; --text-primary: #2A1E18; --text-secondary: #7A6258;
```

**Dark (terre brûlée)**
```css
--bg-page: #1C1410; --bg-sidebar: #150F0B; --bg-card: #241A14;
--accent: #C8A882; --text-primary: #F0E0CC; --text-secondary: #C8B8A8;
```

### Anti-flash
Un script inline dans `app/layout.tsx` lit le thème depuis `localStorage` et applique `data-theme` avant le premier render, évitant le flash blanc.

### Polices
- **Plus Jakarta Sans** : texte courant (via `next/font/google`, variable `--font-plus-jakarta-sans`)
- **Playfair Display** : wordmark "su·mear" + prix (variable `--font-playfair-display`)
- **Fraunces** : titres de pages (variable `--font-fraunces`)

### Composants de marque
- `SumearWordmark` : "su·mear" avec su/· en terracotta, mear en couleur primaire
- `SumearLogoBadge` : badge carré avec 4 lignes horizontales, theme-aware


## 11. Sécurité

### Row Level Security (RLS)
- Activé sur TOUTES les 10 tables
- Chaque user ne peut accéder qu'à ses propres données
- Les fonctions `increment_usage()` et `check_quota()` sont en SECURITY DEFINER

### Auth
- Supabase Auth avec Google OAuth uniquement (MVP)
- Clients Supabase : browser (`client.ts`), server (`server.ts`, cookies + `createClientWithJWT` pour `Authorization: Bearer` / iframe). Pas de middleware auth global au MVP — `proxy.ts` gère uniquement le routing i18n.
- ⚠️ Le root layout (app/layout.tsx) ne doit JAMAIS contenir de logique d'auth
- L'extension récupère le token via cookies Supabase multi-origin + service worker relay

### ✅ Prompt injection defense (complété 13 avril 2026)
- `lib/utils/sanitize.ts` : `sanitizeProductData()` (strip patterns LLM dans les données produit) + `detectSuspiciousMessage()` (détection patterns injection dans les messages utilisateur, retourne `{ isSuspicious, triggers }`)
- `app/api/chat/route.ts` : `sanitizeProductData()` appliqué sur chaque champ textuel des clips avant injection dans le system prompt ; `detectSuspiciousMessage()` appelé après auth check, log dans `security_logs` si suspect (le message n'est pas bloqué — le system prompt renforcé le gère)
- Table `security_logs` : `user_id`, `message`, `triggers`, `ip`, `created_at` — migration `database/security_logs_migration.sql`
- `GET /api/admin/suspicious` : 50 derniers logs, protégé par `ADMIN_USER_ID` env var

### ✅ Audit de sécurité (complété 12 avril 2026, mis à jour 20 avril 2026 pour l'extraction eBay)

**App (3 tiers) :**
- Tier 1 (critique) : Stripe webhooks vérifient le statut réel de la subscription avant mise à jour profil ; checkout bloque les doubles souscriptions (409) ; portal/checkout ne leakent plus `e.message` ; stream SSE timeout 60s ; `maxTokens` clampé au max du modèle
- Tier 2 (élevé) : Input validation sur `/api/clips` (longueurs, types, max specs) ; ownership check `project_id` sur clips ; historique chat tronqué (2000 chars/msg) ; trigger DB `protect_billing_fields` étendu à `subscription_period_end` ; `validateEbayData()` rejette tout payload eBay malformé (400 `INVALID_EBAY_DATA`), clamp strings, array `seller_feedback` tronqué à 8 items
- Tier 3 (moyen) : Name update limité à 100 chars dans settings ; `proxy.ts` est le seul middleware (Next.js 16, pas de `middleware.ts`)

**Extension (3 axes) :**
- Auth & Token : JWT `exp` vérifié avant chaque appel ; `clearAuthToken()` sur 401 et expiry ; nettoyage `access_token` + `refresh_token`
- Content scripts : `cleanText()` migré de `innerHTML` vers `DOMParser` (safe) ; `chatUrl` validé contre origines de confiance ; origin check sur handler `sumear-close` ; `embedUrl` validé dans service-worker ; `extractEbay()` wrap chaque champ dans son propre try/catch, tous les textContent clampés par `cleanText()` + `clamp(max)` avant envoi
- Service worker : handler `fetchEbayDescription` avec whitelist hôte stricte (`itm.ebaydesc.com`, `vi.vipr.ebaydesc.com`), HTTPS obligatoire, timeout 5 s, cap 50 KB streaming, `credentials: 'omit'`. Pas d'`externally_connectable` dans le manifest → surface d'attaque limitée aux scripts internes de l'extension
- Popup : `innerHTML` dynamique remplacé par `createElement` + `textContent` (anti-XSS) ; `renderRatingOrSellerBadge()` utilise `textContent` + `classList.add` uniquement (jamais d'innerHTML pour les données vendeur tierces)

### Variables d'environnement requises
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                  # Webhooks Stripe + admin ; jamais exposé au client
ANTHROPIC_API_KEY=sk-ant-...
# Stripe — test (sk_test_ / whsec depuis stripe listen) ou live (sk_live_ / whsec endpoint Dashboard)
STRIPE_SECRET_KEY=sk_test_... ou sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...         # Si utilisé côté client
# Obligatoire en prod : URLs success/cancel Checkout / return Portal (pas d’open redirect via Origin)
NEXT_PUBLIC_SITE_URL=https://sumear.app
NEXT_PUBLIC_APP_URL=https://sumear.app            # Alias / usages internes si besoin
```


## 12. Conventions de Code

### Nommage
- **Fichiers** : kebab-case (`chat-content.tsx`, `extract-amazon.ts`)
- **Composants React** : PascalCase (`ChatContent`, `SumearLogoBadge`)
- **Fonctions/variables** : camelCase (`streamLLM`, `checkQuota`)
- **Tables BDD** : snake_case (`chat_sessions`, `chat_messages`)
- **Types TypeScript** : PascalCase (`ClipPayload`, `Clip`, `PlanType`)

### Patterns
- **Server Components par défaut** (Next.js App Router)
- **Client Components** seulement quand nécessaire (`'use client'` pour interactivité, thème, etc.)
- **API Routes** pour toute logique serveur (appels LLM, webhooks, déchiffrement)
- **Erreurs explicites** : `{ error: string, code: string }` en cas d'échec API

### Styling
Le projet utilise un mix de Tailwind CSS et d'inline styles (via `style={{}}`). Les CSS custom properties définies dans `globals.css` sont la source de vérité pour les couleurs et les thèmes.


## 13. Roadmap

| Phase | Objectif | Statut |
|-------|----------|--------|
| 0. Préparation | Fondations doc, schema SQL, prompts, fixtures | ✅ DONE |
| 1. Fondations | Auth Google + BDD + layout dashboard + API clips | ✅ DONE |
| 2. Extension Chrome | Extracteur 4 niveaux, popup, service worker, split-view | ✅ DONE |
| 3. Chat IA | Chat conversationnel, streaming SSE, sessions, anti-abus | ✅ DONE |
| 4. Dashboard & UX | Projets, clips, design system, thèmes, wordmark | ✅ DONE |
| 5. Quotas & Monétisation | Quotas, Stripe, plans Free/Complete | ✅ cœur fait — UI quota retirée du dashboard (décision design) |
| 6. Marketing | Landing page, pricing page, pages légales | ✅ Landing redesignée (Hero/Features/Pricing/FAQ) ; pages légales FR+EN (CGU renforcées : RGPD, prompt injection, partage compte, scraping) |
| 7. Sécurité & Monitoring | Audit sécurité, prompt caching, rate limiting, token logging | ✅ Audit app (3 tiers) + extension (3 axes) + prompt caching multi-turn + rate limiting (5 routes) + token logging (`ai_logs` + monthly aggregates) + prompt injection defense (`sanitize.ts`, `security_logs`) |
| 7b. UX & Qualité | Page login i18n, déduplication clips, compare list popup | ✅ Login page `[lang]/login` (two-column, i18n, fix boucle redirect) ; `normalizeProductUrl` + clips UPDATE/201 + feedback popup ; section "Analyser des produits" extension (compare list max 5, `openSplitView` multi-clips) |
| 7c. Enrichissement eBay | Extraction seller/feedback/auction, proxy iframe description, contexte LLM | ✅ `extract-ebay.ts` + `types-ebay.ts` extension ; `validate-ebay.ts` + `format-ebay-context.ts` app ; migration `clips_ebay_data_migration.sql` (JSONB + TTL) ; seller badge popup ; addendum system prompt `EBAY_SYSTEM_PROMPT_ADDENDUM` |
| 7d. UX Chat | Scope rules relâchées, auto-scroll intelligent, welcome state, suggestion chips | ✅ v2.4 — inférence contextuelle autorisée sur questions vagues, pause auto-scroll quand l'utilisateur remonte, chips cachées après premier message, welcome state dans les 3 layouts |
| 8. Launch | Chrome Web Store, onboarding, soumission | ⬜ TODO |
| Post-launch | OpenAI (second provider LLM) | 🔜 LATER |

Détail des tâches et planning semaine par semaine dans `PRELAUNCH.md`.


## 14. Décisions Techniques Figées

1. ✅ Next.js App Router (pas Pages Router)
2. ✅ Supabase (pas Firebase)
3. ✅ Extension et Web App dans des repos séparés
4. ✅ JSON-LD en priorité d'extraction
5. ✅ Chat conversationnel (pas de comparaison structurée JSON)
6. ✅ Streaming SSE pour les réponses IA (pas de réponse batch)
7. ✅ Google Auth uniquement (pas d'email/password pour le MVP)
8. ✅ Thème light/dark avec CSS custom properties
9. ✅ Deux plans uniquement : Free et Complete (pas de BYOK au launch)
10. ✅ Anthropic uniquement au launch (OpenAI post-launch)
