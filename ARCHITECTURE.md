# Sumear — Architecture Reference Document
# Version: MVP v2.1 | Last updated: 2026-04-12
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
│   │   ├── login/page.tsx              # Page de connexion Google
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
│   └── utils/
│       └── quota.ts                    # checkQuota() + incrementUsage() par plan
├── content/                            # Contenu markdown des pages légales (servi via get-legal-content.ts)
│   ├── fr/cgu.md, privacy.md, mentions.md
│   └── en/cgu.md, privacy.md, mentions.md
├── database/
│   ├── sumear_schema.sql              # Schéma de référence (install fraîche)
│   ├── chat_history.sql               # Tables chat (sessions, messages, …)
│   ├── stripe_profiles_migration.sql  # Colonnes Stripe + trigger anti-escalade plan
│   ├── quota_ai_messages_migration.sql, check_quota_migration.sql, project_ai_brief_cache_migration.sql
│   └── sumear_schema.mermaid          # Diagramme ERD
├── ARCHITECTURE.md                     # CE FICHIER
└── package.json
```

**i18n marketing :** Les pages marketing sont servies sous `/fr/...` et `/en/...`. Le middleware (`proxy.ts`) redirige les URLs sans préfixe (`/`, `/legal`, `/privacy`, `/mentions`) vers la locale préférée (cookie `sumear-locale` → Accept-Language → `fr` par défaut). `getDictionary(locale)` appelle `notFound()` si la locale n'est pas `fr` ou `en`, évitant le crash quand `[lang]` capture un segment non-locale.

**⚠️ Point critique :** `app/layout.tsx` (root) ne contient AUCUNE logique d'auth ni de redirection.
L'auth guard est dans `app/(dashboard)/layout.tsx`. Séparer les deux layouts
a causé une boucle de redirection infinie quand le root layout contenait la logique dashboard.

### Repo 2 : `sumear-extension` (Chrome Extension)

```
sumear-extension/
├── src/
│   ├── manifest.json                   # Manifest V3
│   ├── config.ts                       # Configuration (URLs)
│   ├── background/
│   │   └── service-worker.ts           # Service worker (comm avec le dashboard, auth relay)
│   ├── content/
│   │   ├── extractor.ts                # Orchestrateur 4 niveaux (merge + confidence)
│   │   ├── extract-jsonld.ts           # Level 1: JSON-LD schema.org/Product
│   │   ├── extract-amazon.ts           # Level 2: Sélecteurs Amazon (multi-locale)
│   │   ├── extract-microdata.ts        # Level 3: Microdata itemprop/itemscope
│   │   ├── extract-generic.ts          # Level 4: CSS fallback générique
│   │   ├── content-script.ts           # Injection split-view (iframe chat)
│   │   ├── sync-auth.ts                # Synchronisation auth Supabase
│   │   ├── types.ts                    # Interfaces TypeScript (ProductData, etc.)
│   │   └── utils.ts                    # Parsers prix/rating/reviews
│   ├── popup/
│   │   ├── popup.html                  # Structure popup (3 sections)
│   │   ├── popup.ts                    # Logique popup (clip + projets)
│   │   └── popup.css                   # Styles popup
│   └── utils/
│       ├── api.ts                      # Appels vers sumear.app/api/*
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
| `clips` | Produits capturés | `project_id` nullable, `raw_jsonld`, `extracted_specs` |
| `comparisons` | **(legacy — supprimé du code, table conservée en DB)** | `result_matrix`, `result_analysis` |
| `comparison_clips` | **(legacy — supprimé du code, table conservée en DB)** | `PRIMARY KEY(comparison_id, clip_id)` |
| `usage` | Compteurs mensuels | `UNIQUE(user_id, year, month)` |
| `chat_sessions` | Sessions de chat IA | `user_id`, `title` |
| `chat_session_clips` | Liaison N:N sessions↔clips | `PRIMARY KEY(session_id, clip_id)` |
| `chat_messages` | Messages d'une session | `role` (user/assistant), `content` |
| `ai_logs` | ⬜ TODO — Logs d'appels LLM (monitoring) | `model`, `input_tokens`, `output_tokens`, `cache_read_tokens` |

**Note :** Les tables `comparisons` et `comparison_clips` sont legacy. Le code applicatif (routes, composants, prompts) a été supprimé — seules les tables DB restent pour l'historique.

### Fichiers SQL : `database/sumear_schema.sql` + `database/chat_history.sql` + migrations (`stripe_profiles_migration.sql`, quotas, brief cache — voir dossier `database/`)

### Fonctions Supabase clés
- `increment_usage()` : upsert atomique des compteurs mensuels (`clips_count`, `ai_messages_count`, tokens/coût)
- `check_quota(p_user_id)` : agrégat JSON aligné sur `lib/config/plans.ts` (clips/projets en COUNT, comparaisons + IA sur le mois courant). **Non appelée par l’app** aujourd’hui — l’enforcement passe par `checkQuota()` en TS. Exécuter `database/check_quota_migration.sql` sur les BDD existantes pour remplacer l’ancienne version (comparaisons seules, limites obsolètes).


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

- **Scope lock** : le system prompt refuse toute question non liée aux produits fournis
- **Message length** : 500 caractères max (frontend + API)
- **Token limit** : 1024 max_tokens pour le chat (vs 4096 pour les comparaisons)
- **Quotas** : messages IA mensuels, clips/projets totaux (free) — voir §9 ; code `QUOTA_EXCEEDED` côté API
- **No markdown** : le prompt interdit les formatages markdown dans les réponses

### System prompt (source de vérité dans `api/chat/route.ts`)

Le prompt est en français/anglais hybride :
- Règle de scope en français (pour qu'elle soit comprise par le modèle dans le contexte français)
- Règles de comportement en anglais
- Règles de formatage en anglais


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
  → INSERT dans table clips (avec project_id si projet sélectionné)
  → Response 201 + clip.id
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
[Page /login]
  → Clic "Continuer avec Google"
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Redirect vers Google → consentement → redirect vers /callback
[Route /callback]
  → supabase.auth.exchangeCodeForSession(code)
  → Redirect vers / (dashboard)
[Dashboard layout]
  → supabase.auth.getUser() → redirect si pas connecté
  → DashboardShell affiche sidebar + header + footer + toggle thème
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

### ✅ Audit de sécurité (complété 12 avril 2026)

**App (3 tiers) :**
- Tier 1 (critique) : Stripe webhooks vérifient le statut réel de la subscription avant mise à jour profil ; checkout bloque les doubles souscriptions (409) ; portal/checkout ne leakent plus `e.message` ; stream SSE timeout 60s ; `maxTokens` clampé au max du modèle
- Tier 2 (élevé) : Input validation sur `/api/clips` (longueurs, types, max specs) ; ownership check `project_id` sur clips ; historique chat tronqué (2000 chars/msg) ; trigger DB `protect_billing_fields` étendu à `subscription_period_end`
- Tier 3 (moyen) : Name update limité à 100 chars dans settings ; `proxy.ts` est le seul middleware (Next.js 16, pas de `middleware.ts`)

**Extension (3 axes) :**
- Auth & Token : JWT `exp` vérifié avant chaque appel ; `clearAuthToken()` sur 401 et expiry ; nettoyage `access_token` + `refresh_token`
- Content scripts : `cleanText()` migré de `innerHTML` vers `DOMParser` (safe) ; `chatUrl` validé contre origines de confiance ; origin check sur handler `sumear-close` ; `embedUrl` validé dans service-worker
- Popup : `innerHTML` dynamique remplacé par `createElement` + `textContent` (anti-XSS)

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
| 7. Sécurité & Monitoring | Audit sécurité, prompt caching, rate limiting, token logging | ✅ Audit app (3 tiers) + extension (3 axes) + prompt caching multi-turn + rate limiting (5 routes) + token logging (`ai_logs` + monthly aggregates) |
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
