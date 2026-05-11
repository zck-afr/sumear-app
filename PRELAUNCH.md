# Sumear — Plan de lancement pré-launch
# ⚠️ Ce fichier complète ARCHITECTURE.md. Donne les DEUX en contexte à Cursor.
# Généré le 29 mars 2026 — Mis à jour le 15 avril 2026


## Décisions prises depuis ARCHITECTURE.md

Ces décisions remplacent les sections correspondantes dans ARCHITECTURE.md :

1. **Le plan Pro BYOK est supprimé.** Deux plans uniquement : Free et Complete. Supprimer toute référence à BYOK, `api_keys`, encryption AES-256, routing multi-provider. La table `api_keys` peut rester dans le schema mais n'est plus utilisée.

2. **OpenAI est reporté post-launch.** Un seul provider au lancement : Anthropic. Ne pas implémenter le routing multi-provider.

3. **Le pricing est figé :**

| | Free | Complete |
|---|---|---|
| Prix mensuel | 0 € | 12.90 € |
| Prix annuel | — | 9.90 €/mois (118.80 €/an) |
| Messages IA / mois | 25 | 1 000 |
| Projets | 2 | Illimités |
| Clips | 8 | Illimités |
| Modèle IA | Claude Haiku 4.5 | Claude Sonnet 4.6 |

4. **La mesure d'usage IA est figée :** un compteur unique `ai_messages` par mois. Chat + Briefs projet comptent dans le même quota. Tokens loggés en parallèle mais non exposés à l'utilisateur.

5. **Le plan `profiles.plan` passe de `free/pro/complete` à `free/complete` uniquement.** Mettre à jour le type enum et toutes les références dans le code.

6. **La table `comparisons` et `comparison_clips` sont legacy.** Tables DB conservées pour l'historique, mais tout le code applicatif (routes API, pages, composants, prompts) a été supprimé.


## Tâches ordonnées par priorité

Implémenter dans cet ordre exact. Chaque tâche est autonome et testable.

---

### TÂCHE 1 — Mise à jour du système de quotas
**Fichiers concernés :** `lib/utils/quota.ts`, `database/sumear_schema.sql`
**Priorité :** CRITIQUE — bloquant pour le launch

Le système actuel gère `clips`, `projects` et `ai_messages`. Il faut :

1.1. Ajouter le type `ai_messages` à `checkQuota()` et `incrementUsage()`.

1.2. Ajouter le type `projects` à `checkQuota()` et `incrementUsage()`.

1.3. Mettre à jour la table `usage` si nécessaire pour accueillir les nouveaux compteurs (`ai_messages_count`, `projects_count`), ou utiliser des colonnes existantes.

1.4. Définir les limites dans un fichier de config centralisé :
```typescript
// lib/config/plans.ts
export const PLAN_LIMITS = {
  free: {
    ai_messages: 25,    // par mois
    clips: 8,           // total (pas par mois)
    projects: 2,        // total (pas par mois)
  },
  complete: {
    ai_messages: 1000,  // par mois
    clips: Infinity,
    projects: Infinity,
  },
} as const;
```

1.5. ~~Mettre à jour `check_quota()`~~ — Fait : `database/check_quota_migration.sql` + `sumear_schema.sql` (aligné `plans.ts`, garde-fou `auth.uid()`, `search_path`). L’app n’appelle pas cette RPC ; à exécuter manuellement sur Supabase si besoin de cohérence SQL / futurs outils.

**Test :** Un user free avec 25 ai_messages ce mois-ci se voit refuser un nouveau message chat. Un user complete avec 999 ai_messages peut encore envoyer.

---

### TÂCHE 2 — Brancher les quotas sur les API routes
**Fichiers concernés :** `app/api/chat/route.ts`, `app/api/clips/route.ts`, `app/api/projects/route.ts`
**Priorité :** CRITIQUE

2.1. **`POST /api/chat`** — Avant l'appel LLM :
- `checkQuota(supabase, userId, 'ai_messages')` → si `!is_allowed`, retourner `{ error: "Quota atteint", code: "QUOTA_EXCEEDED" }` avec status 429.
- Après le stream terminé et les messages persistés : `incrementUsage(supabase, userId, 'ai_messages', 1)`.

2.2. **`POST /api/clips`** — Avant l'INSERT :
- `checkQuota(supabase, userId, 'clips')` → vérifier le nombre TOTAL de clips du user (pas mensuel, c'est un quota absolu pour le free).
- ⚠️ Attention : pour les clips, c'est un quota total (8 clips max en free), pas mensuel. Adapter la logique.

2.3. **`POST /api/projects`** — Avant l'INSERT :
- `checkQuota(supabase, userId, 'projects')` → vérifier le nombre TOTAL de projets du user (2 max en free).

2.4. **Endpoint Brief IA** (là où le brief projet est généré) :
- Même check `ai_messages` que le chat.
- `incrementUsage(supabase, userId, 'ai_messages', 1)` après génération réussie.

**Test :** Créer un user free, lui faire créer 2 projets → le 3ème est refusé. Lui faire clipper 8 produits → le 9ème est refusé. Lui faire envoyer 25 messages → le 26ème est refusé.

---

### TÂCHE 3 — Debounce et cache du Brief IA projet
**Fichiers concernés :** Le composant ou la route qui génère le Brief IA sur la page projet
**Priorité :** HAUTE — protège le quota des utilisateurs

3.1. **Debounce 30 secondes** : quand l'utilisateur ajoute ou supprime un produit d'un projet, ne pas régénérer le brief immédiatement. Attendre 30 secondes après le dernier changement.

3.2. **Cache par hash de clip_ids** : avant de régénérer, calculer un hash des clip_ids actuels du projet (trié, jointé, hashé). Si le hash est identique au dernier brief généré, ne pas régénérer (servir le brief existant). Stocker le hash dans la table `projects` (ajouter une colonne `brief_clips_hash` et `brief_content`).

**Test :** Ajouter un produit, puis le retirer immédiatement → 0 appel LLM. Ajouter un produit et attendre 30s → 1 appel LLM. Recharger la page sans changement → 0 appel LLM (cache hit).

---

### TÂCHE 4 — Prompt caching Anthropic
**Statut : ✅ FAIT (12 avril 2026)**

**Implémenté :**
- `streamLLM()` et `callLLM()` envoient le system prompt avec `cache_control: { type: "ephemeral" }`
- Les deux fonctions acceptent `string | ChatMessage[]` pour les messages utilisateur
- Un second breakpoint de cache est placé sur le dernier message d'historique (`buildMessagesParam()`) pour maximiser les cache hits en multi-turn
- Seuils minimaux respectés : 2048 tokens pour Haiku (corrigé de 4096), 1024 tokens pour Sonnet
- `maxTokens` clampé via `Math.min(options?.maxTokens ?? config.maxTokens, config.maxTokens)` pour empêcher les abus
- Route `/api/chat` transforme `body.history` en `ChatMessage[]` avec troncature à 2000 chars/msg
- Stream SSE avec timeout hard de 60 secondes

**Test :** Envoyer 3 messages dans une session avec 2 produits en contexte. Vérifier dans les logs/response headers que le 2ème et 3ème message ont un `cache_read_input_tokens > 0`.

---

### TÂCHE 5 — Intégration Stripe
**Fichiers concernés :** `app/api/webhooks/stripe/route.ts`, `app/api/stripe/checkout`, `app/api/stripe/portal`, `app/(dashboard)/settings/page.tsx`, `components/settings/billing-section.tsx`, `components/billing/upgrade-modal.tsx`, `lib/stripe.ts`, `lib/supabase/admin.ts`, `database/stripe_profiles_migration.sql`
**Priorité :** CRITIQUE — pas de revenus sans ça

**Implémenté :** checkout + portal + webhook (`checkout.session.completed`, `subscription.deleted/updated`, log `invoice.payment_failed`), colonnes `stripe_customer_id` / `stripe_subscription_id`, trigger anti-escalade sur `plan`/Stripe côté client JWT, UI settings + modal upgrade sur quota chat.

5.1. **Créer les produits Stripe** (dans le dashboard Stripe, pas dans le code) :
- Produit "Sumear Complete"
- Prix mensuel : 12.90 € (EUR)
- Prix annuel : 118.80 € (EUR), soit 9.90 €/mois

5.2. **`lib/stripe.ts`** — Helper pour créer une Checkout Session :
```typescript
export async function createCheckoutSession(userId: string, priceId: string, successUrl: string, cancelUrl: string)
```
- Passer `client_reference_id: userId` pour le retrouver dans le webhook.
- Ajouter `allow_promotion_codes: true` (utile pour des codes promo au lancement).

5.3. **API Route `POST /api/stripe/checkout`** :
- Auth check
- Créer la Checkout Session
- Retourner l'URL de redirection

5.4. **Webhook `POST /api/webhooks/stripe`** :
- Vérifier la signature Stripe (`stripe.webhooks.constructEvent`)
- Gérer `checkout.session.completed` → UPDATE `profiles` SET `plan = 'complete'`, stocker `stripe_customer_id` et `stripe_subscription_id` dans `profiles` (ajouter ces colonnes).
- Gérer `customer.subscription.deleted` → UPDATE `profiles` SET `plan = 'free'`
- Gérer `customer.subscription.updated` → mettre à jour le plan si changement
- Gérer `invoice.payment_failed` → optionnel au launch, mais loguer l'événement

5.5. **UI Settings** — Sur la page `/settings` :
- Si plan free : bouton "Passer au Complete" → redirige vers Stripe Checkout
- Si plan complete : afficher le statut de l'abonnement, bouton "Gérer mon abonnement" → Stripe Customer Portal

5.6. **Modal upgrade** — Composant réutilisable qui s'affiche quand un quota est atteint :
- "Tu as utilisé tes 25 messages IA ce mois-ci. Passe au Complete pour 1 000 messages/mois."
- Bouton CTA vers Stripe Checkout

5.7. **Variables d'environnement à ajouter :**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_YEARLY=price_...
```

**Test :** Clic sur "Passer au Complete" → redirige vers Stripe → paiement test → webhook reçu → `profiles.plan` passe à `complete` → les quotas reflètent le nouveau plan. Annulation dans Stripe → webhook → plan revient à `free`.

---

### TÂCHE 6 — UI de feedback quota
**Statut : ✅ DÉCISION PRISE — barres et compteurs supprimés du dashboard**

**Décision design (12 avril 2026) :** Les barres de progression, le widget arc semi-circulaire (`AiQuotaCard`), les compteurs "X messages restants" et "X/1000" ont été retirés du dashboard. Raisons :
- Le dashboard home affiche 3 stat cards propres : **Produits analysés** / **Projets actifs** / **Discussions** (count `chat_sessions`).
- La page Paramètres (`/settings`) a été entièrement redesignée sans quota widget.
- Le feedback de quota reste présent **dans le chat** uniquement : quand le quota est atteint, l'API retourne `QUOTA_EXCEEDED` et le composant chat affiche la modale d'upgrade.

**Ce qui reste à faire (scope réduit) :**

6.1. ~~Barres de progression dans le dashboard~~ — **SUPPRIMÉ**

6.2. **Indicateur dans le chat** : quand quota atteint → modal upgrade (déjà implémenté via `QUOTA_EXCEEDED`). ✅

6.3. **Indicateur dans le popup extension** :
- Si quota clips atteint : désactiver le bouton "Ajouter" et afficher CTA upgrade
- Reste à implémenter côté extension

6.4. **API route `GET /api/usage`** (optionnelle — pour le popup extension uniquement).

---

### TÂCHE 7 — Landing page + page pricing
**Statut : ✅ FAIT (12 avril 2026)**

**Implémenté :**
- Route `app/[lang]/(marketing)/page.tsx` — bilingue FR/EN, routing i18n via `[lang]` segment
- `HeroSection` : grille 2 colonnes (headline `dangerouslySetInnerHTML` pour `<em>`, mock navigateur avec bulles chat, CTA Chrome Store)
- `FeaturesSection` : grille 3 colonnes, 6 items depuis le dictionnaire (`icon`, `title`, `body`)
- `PricingSection` : réutilisée avec prop `onDarkBackground` (bande sombre `#2A1E18`)
- `FaqSection` : accordion FAQ
- Layout marketing (`layout.tsx`) : `MarketingHeader` + main + `MarketingFooter`
- Dictionnaires i18n (`lib/i18n/dictionaries/fr.ts` + `en.ts`) : nouveaux blocs `hero` et `features`
- i18n routing sécurisé : `getDictionary` appelle `notFound()` pour toute locale invalide

**Reste :** La `CHROME_STORE_URL` est `'#'` — à remplacer par l'URL Chrome Web Store réelle avant launch.

---

### TÂCHE 8 — Pages légales
**Statut : ✅ FAIT (12–13 avril 2026)**

**Implémenté :**
- Contenu markdown dans `content/fr/` et `content/en/` : `cgu.md`, `privacy.md`, `mentions.md`
- `lib/legal/get-legal-content.ts` : charge le fichier markdown, convertit en HTML (parser interne minimal — bold, italic, liens, listes, tableaux, headings)
- `components/marketing/legal-content.tsx` : rendu du HTML + lien retour accueil
- Pages : `app/[lang]/(marketing)/legal/cgu/`, `privacy/`, `mentions/`
- Liées dans `MarketingFooter` (`/[lang]/legal/cgu`, `privacy`, `mentions`)
- `proxy.ts` redirige `/legal`, `/privacy`, `/mentions` (sans préfixe) vers `/[locale]/legal/...` (Next.js 16 : pas de `middleware.ts`, `proxy.ts` uniquement)

**Mise à jour CGU (13 avril 2026) — 4 protections légales ajoutées :**
- Article 4.2 : compte strictement personnel, interdiction de partage d'identifiants, suspension si usage partagé détecté
- Article 4.3 : interdiction du détournement de l'IA (prompt injection, extraction du system prompt), suspension immédiate
- Article 5.3 : l'extraction est déclenchée par l'action directe de l'Utilisateur (extension Chrome), pas par des serveurs automatisés de l'Éditeur
- Article 6 (nouveau) : renvoi explicite vers la Politique de Confidentialité, mention RGPD (Règlement UE 2016/679), droits d'accès/rectification/effacement/portabilité/opposition
- Numérotation mise à jour (13 articles au lieu de 12)
- Version anglaise synchronisée

**URL publique privacy :** `sumear.app/fr/legal/privacy` (ou `/en/...`) — à renseigner dans le Developer Dashboard Chrome Web Store.

---

### TÂCHE 9 — Fiche Chrome Web Store
**Priorité :** CRITIQUE — c'est le canal de distribution

9.1. **Optimiser le manifest.json** : vérifier les permissions (minimales), la description courte, les icônes (128x128, 48x48, 16x16).

9.2. **Listing Chrome Web Store** :
- Titre : "Sumear — AI Shopping Assistant" (EN) / "Sumear — Assistant Shopping IA" (FR)
- Description courte (132 caractères max) : "Clip products, ask AI questions, get smart insights. Your unbiased shopping companion."
- Description longue : features, cas d'usage, positionnement
- Catégorie : "Shopping"
- Screenshots : 1280x800 ou 640x400, montrant le popup, le split-view chat, le dashboard
- Icône promotionnelle : 440x280

9.3. **URL de politique de confidentialité** : pointer vers `sumear.app/privacy`

9.4. **Soumission** : soumettre pour review (compter 1-3 jours pour l'approbation Google).

---

### TÂCHE 10 — Onboarding minimal
**Fichiers concernés :** Popup extension, dashboard page d'accueil
**Priorité :** MOYENNE — améliore l'activation mais pas bloquant

10.1. **Premier lancement extension** : quand l'utilisateur installe l'extension et ouvre le popup pour la première fois, afficher un mini-guide :
- Étape 1 : "Navigue sur un site marchand (Amazon, Fnac, Decathlon...)"
- Étape 2 : "Clique sur Sumear et clippe le produit"
- Étape 3 : "Pose tes questions à l'IA"

10.2. **Dashboard vide** : quand le dashboard n'a aucun clip/projet, afficher un state vide engageant avec le même guide et un lien vers les sites compatibles.

---

### TÂCHE 11 — Rate limiting basique ✅ FAIT
**Fichier créé :** `lib/utils/rate-limit.ts` (sliding window in-memory avec cleanup automatique)
**Fichiers modifiés :** `app/api/chat/route.ts`, `app/api/clips/route.ts`, `app/api/projects/route.ts`, `app/api/projects/[id]/brief/route.ts`, `app/(auth)/callback/route.ts`

Implémentation :
- `checkRateLimit(key, max, windowMs)` — sliding window sur Map<string, number[]> avec cleanup toutes les 60s
- `rateLimitResponse(retryAfterMs)` — génère le body 429 + header `Retry-After`

Limites appliquées :
| Route | Limite | Clé |
|-------|--------|-----|
| `/api/chat` | 10/min | `chat:${userId}` |
| `/api/clips` POST | 8/min | `clips:${userId}` |
| `/api/projects/[id]/brief` | 5/min | `brief:${userId}` |
| `/api/projects` POST | 5/min | `projects:${userId}` |
| `/callback` (auth) | 5/min | `auth:${ip}` |

Réponse 429 : `{ error: "Trop de requêtes. Réessayez dans Xs.", code: "RATE_LIMITED" }`

Note : en serverless (Vercel), la Map vit ~5-15 min par instance — protection partielle mais suffisante combinée aux quotas. Upgrade vers Upstash Redis si nécessaire post-launch.

---

### TÂCHE 12 — Logging des tokens (monitoring) ✅ FAIT

**Fichiers créés :**
- `database/ai_logs_migration.sql` — table `ai_logs` + RLS (SELECT + INSERT own rows, append-only)
- `lib/utils/ai-log.ts` — `logAiCall()` fire-and-forget insert + calcul coût via `estimateCost()`

**Fichiers modifiés :**
- `lib/llm/provider.ts` — `streamLLM()` capture désormais les tokens via les events `message_start` (input/cache) et `message_delta` (output) ; nouveau type exporté `StreamUsage` ; passage via `options.usageRef`
- `lib/utils/quota.ts` — `incrementUsage()` accepte un paramètre optionnel `TokenUsage` pour agréger `total_input_tokens`, `total_output_tokens`, `total_api_cost_usd` dans la table `usage` mensuelle
- `app/api/chat/route.ts` — passe `usageRef` à `streamLLM`, appelle `logAiCall()` après le stream, passe les tokens à `incrementUsage()`
- `app/api/projects/[id]/brief/route.ts` — utilise `LLMResponse` de `callLLM()`, appelle `logAiCall()`, passe les tokens à `incrementUsage()`

**Table `ai_logs` :**
```
id, user_id, session_id (nullable), type ('chat'|'brief'), model, input_tokens,
output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost_usd, created_at
```

**Double logging :**
- `ai_logs` : log granulaire par appel (monitoring, analytics)
- `usage` : agrégats mensuels (`total_input_tokens`, `total_output_tokens`, `total_api_cost_usd`) pour quotas et facturation

**Migration à exécuter :** `database/ai_logs_migration.sql` sur chaque environnement.

---

### TÂCHE 13 — Audit de sécurité pré-launch
**Statut : ✅ FAIT (12–13 avril 2026)**
**Priorité :** CRITIQUE — sécurité avant le launch

**App — Tier 1 (critique) :**
- Stripe : `handleCheckoutCompleted` vérifie le statut réel de la subscription avant mise à jour profil ; checkout bloque les doubles souscriptions (409 `ALREADY_SUBSCRIBED`) ; portal/checkout retournent des messages d'erreur génériques (plus de leak `e.message`)
- Chat API : `maxTokens` clampé au max du modèle ; stream SSE avec timeout hard 60s ; historique tronqué à 2000 chars/msg
- LLM provider : `Math.min(options?.maxTokens, config.maxTokens)` empêche les requêtes de tokens arbitraires

**App — Tier 2 (élevé) :**
- `/api/clips` : validation serveur des champs (longueurs : `source_url` ≤ 2048, `product_name` ≤ 1000, `description` ≤ 10k, `extracted_specs` max 50 clés / 500 chars par valeur) ; ownership check `project_id`
- `/api/compare` : **supprimé** (feature legacy retirée)
- DB : trigger `profiles_protect_billing_fields` étendu à `subscription_period_end` (migration `protect_subscription_period_end.sql`)

**App — Tier 3 (moyen) :**
- Settings : name update limité à 100 chars (client + serveur)
- Proxy : `middleware.ts` supprimé (conflit Next.js 16) ; `proxy.ts` est l'unique point d'entrée middleware

**Extension — Auth & Token :**
- `auth.ts` : JWT `exp` décodé et vérifié avec marge 60s (`isTokenExpired()`) ; `isAuthenticated()` vérifie l'expiry, pas juste l'existence ; `clearAuthToken()` supprime `access_token` + `refresh_token`
- `api.ts` : helper `getValidToken()` vérifie l'expiry avant chaque appel ; toute réponse 401 déclenche `clearAuthToken()` ; helper `handleErrorResponse()` factorise le traitement d'erreur
- `popup.ts` : 401 sur `/api/projects` déclenche `clearAuthToken()`

**Extension — Content Scripts :**
- `utils.ts` : `cleanText()` migré de `innerHTML` (vulnérable `<img onerror>`) vers `DOMParser().parseFromString()` (safe)
- `content-script.ts` : `chatUrl` validé contre `isTrustedAppOrigin()` avant ouverture du split-view ; handler `sumear-close` vérifie `e.origin` via `isTrustedAppOrigin()`
- `service-worker.ts` : `embedUrl` validé contre `TRUSTED_ORIGINS` (construit depuis `getCandidateAppOrigins()`)

**Extension — Popup :**
- `popup.ts` : `innerHTML` avec `${p.name}` / `${p.emoji}` remplacé par `createElement` + `textContent` (anti-XSS)

---

### TÂCHE 14 — Page de connexion i18n
**Statut : ✅ FAIT (15 avril 2026)**

**Fichiers créés :**
- `app/[lang]/login/page.tsx` — Server Component, layout deux colonnes : panneau brand gauche (logo, headline, tagline, footer) + panneau formulaire droit (titre, sous-titre, bouton Google, liens légaux, retour accueil)
- `app/[lang]/login/google-button.tsx` — Client Component (`'use client'`) : `signInWithOAuth` via singleton `createClient()`, gestion état `loading`, détection `?error` dans l'URL via `useSearchParams`, enveloppé dans `Suspense`
- `lib/i18n/dictionaries/fr.ts` + `en.ts` — bloc `login` ajouté (title, subtitle, cta, legal\*, back, headlineL1/L2, tagline, error)

**Fichiers modifiés :**
- `proxy.ts` — `/login` ajouté dans `MARKETING_PATHS_EXACT` pour la redirection i18n
- `app/(dashboard)/layout.tsx` — redirect `/${locale}/login` au lieu de `/login` ; ajout `resolveLocale()` (cookie → Accept-Language → `fr`)
- `lib/supabase/proxy.ts` — nouveau helper `isLoginPath()` qui reconnaît `/login` ET `/${locale}/login` — corrige la boucle de redirect infinie
- `app/(auth)/login/page.tsx` — **supprimé** (remplacé par la page i18n)

**Points de sécurité :**
- Aucune logique auth dans root `layout.tsx`
- `redirectTo: window.location.origin + '/callback'` (jamais une valeur hardcodée)
- Hover bouton Google via CSS (`:hover:not(:disabled)`) plutôt que JS

---

### TÂCHE 15 — Déduplication des clips
**Statut : ✅ FAIT (15 avril 2026)**

**Fichiers créés :**
- `lib/utils/url.ts` — `extractDomain(url)` + `normalizeProductUrl(url)` (strip fragments, tracking params courants `utm_*` / `ref` / `tag` / etc., tri des params restants, strip trailing slash hors root)
- `database/clips_updated_at_migration.sql` — ajout colonne `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` avec backfill `= created_at`

**Fichiers modifiés :**
- `app/api/clips/route.ts` (POST) :
  - Avant le check quota : requête candidates `same user_id + source_domain + project_id`, normalise les URLs → si match, UPDATE + retour 200 `{ code: "CLIP_UPDATED" }`
  - Si aucun doublon : check quota → INSERT → retour 201 `{ code: "CLIP_CREATED" }`
  - `clipId` renvoyé dans les deux cas
- `src/utils/api.ts` (extension) — `ClipResponse.code?: 'CLIP_CREATED' | 'CLIP_UPDATED'`
- `src/background/service-worker.ts` — propagation du champ `code` + `clipId` vers le popup
- `src/popup/popup.ts` — feedback `"Mis à jour ✓ Ouverture…"` vs `"Ouverture…"` (btn analyse) ; `"Mis à jour ✓"` avec classe `.btn-info` vs `"Ajouté ✓"` (btn projet)
- `src/popup/popup.css` — classe `.btn.btn-info` (fond `#C8A882`) pour distinguer visuellement un re-clip

**Garanties :**
- Le quota n'est PAS consommé sur un UPDATE (guard quota court-circuité)
- La dédup compare sur `normalizeProductUrl` → `?utm_source=email` du même produit ne crée pas de doublon
- Le contexte (même `project_id` ou `null`) est inclus dans la comparaison — un produit dans deux projets distincts génère bien deux clips séparés

---

### TÂCHE 16 — Section "Analyser des produits" dans le popup
**Statut : ✅ FAIT (15 avril 2026)**

**Fichiers modifiés :**
- `src/popup/popup.html` — nouvelle section entre "analyser ce produit" et "projets" : header-row (label + trigger dropdown avec compteur + chevron), dropdown panel, boutons-row ("Ajouter" + "Ouvrir le chat")
- `src/popup/popup.css` — bloc `.compare-*` autonome ajouté en fin de fichier (couleurs hex en dur, aucune dépendance aux classes `.btn` / `.section-*` existantes)
- `src/popup/popup.ts` — module compare auto-contenu ajouté après `init()` :
  - `chrome.storage.local["sumear-compare-list"]` : `[{ url, name, price, image_url, clip_id }]`
  - `loadCompareList()` / `saveCompareList()` / `renderCompareSection()`
  - `handleCompareAdd()` : POST `/api/clips` via `chrome.runtime.sendMessage({ action: 'clip' })` → `clip_id` récupéré ; dédup locale (même URL ou même `clip_id` retourné par le serveur) → flash `"Ajouté ✓"` sans doublon
  - `handleCompareRemove(idx)` : suppression + sauvegarde
  - `handleCompareChat()` : `openSplitView` avec tableau `clipIds` (même mécanisme que "Ouvrir le chat" existant)
  - `MutationObserver` sur `state-ready` pour re-render quand `init()` a résolu `currentData`
  - Max 5 produits ; sous-label `"5/5"` + `is-disabled` sur "Ajouter" ; dropdown ouvert par défaut si liste non vide

**Garanties :**
- Aucune modification des sections "analyser ce produit" ni "projets"
- La dédup `/api/clips` (tâche 15) fait que re-cliquer un produit déjà dans la liste compare ne consomme pas de quota
- Tous les éléments interactifs sont des `div` (pas de `button`) pour éviter les surcharges de style de l'extension

---

## Ordre d'exécution recommandé

```
✅ Semaine 1 :
  TÂCHE 1  — Quotas (config + logique)              ✅
  TÂCHE 2  — Brancher quotas sur les API routes      ✅
  TÂCHE 5  — Stripe (checkout + webhook + UI)        ✅

✅ Semaine 2 :
  TÂCHE 6  — UI de feedback quota                    ✅ (décision : supprimé du dashboard)
  TÂCHE 4  — Prompt caching                          ✅
  TÂCHE 3  — Debounce/cache Brief IA                 ✅
  TÂCHE 7  — Landing page + pricing                  ✅

✅ Semaine 3 :
  TÂCHE 8  — Pages légales                           ✅ (+ CGU renforcées)
  TÂCHE 13 — Audit de sécurité                       ✅ (app + extension)
  TÂCHE 11 — Rate limiting                           ✅
  TÂCHE 12 — Logging tokens                          ✅
  TÂCHE 14 — Page de connexion i18n                  ✅
  TÂCHE 15 — Déduplication clips                     ✅
  TÂCHE 16 — Section "Analyser des produits" popup   ✅

⬜ Semaine 4 :
  TÂCHE 9  — Fiche Chrome Web Store + soumission     ⬜ TODO
  TÂCHE 10 — Onboarding minimal                      ⬜ TODO

→ Tâches restantes : 9, 10
→ Soumission Chrome Web Store dès tâche 9 prête
→ Review Google : 1-3 jours
→ Launch public après approval
```


## Historique des mises à jour d'ARCHITECTURE.md

**v2.0 (29 mars 2026) :**
- Section 9 (Abonnements) : pricing figé Free/Complete, BYOK supprimé
- Section 7 (Architecture LLM) : Anthropic uniquement au launch, prompt caching
- Section 11 (Sécurité) : BYOK retiré du scope launch
- Section 13 (Roadmap) : recalibrée avec les nouvelles phases
- Section 14 (Décisions) : mise à jour
- Nouvelle table `ai_logs` ajoutée en section 4

**v2.1 (12 avril 2026) :**
- Section 3 (Structure dossiers) : ajout `components/marketing/`, `components/settings/settings-client.tsx`, `components/dashboard/greeting.tsx`, `lib/legal/`, `content/`, route `app/[lang]/(marketing)/`
- Section 13 (Roadmap) : tâche 6 (quota UI supprimée — décision design), tâche 7 (landing ✅), tâche 8 (légales ✅)
- Note i18n routing ajoutée (section 3) : `getDictionary` sécurisé, `proxy.ts` shortcuts `/legal` → `/[lang]/legal/cgu` etc.
- Dashboard home : 3ème stat card = "Discussions" (count `chat_sessions`), plus de `AiQuotaCard`
- Page Paramètres : refonte complète (`SettingsClient`), édition du nom, toggle thème intégré, toggle langue (cookie), danger zone

**v2.2 (13 avril 2026) :**
- Section 7 (Architecture LLM) : prompt caching ✅, multi-turn `ChatMessage[]`, seuils corrigés (Haiku 2048)
- Section 11 (Sécurité) : audit complété (app 3 tiers + extension 3 axes) — remplace le TODO par la liste des corrections
- Section 13 (Roadmap) : phase 7 Sécurité ✅ (audit + caching), phase 6 Marketing mise à jour (CGU renforcées)
- `middleware.ts` supprimé (conflit Next.js 16) ; `proxy.ts` seul middleware
- CGU renforcées (FR + EN) : RGPD, prompt injection, partage compte, responsabilité extraction
- Extension : 7 fixes sécurité (cleanText DOMParser, popup textContent, chatUrl/embedUrl validation, origin checks, JWT expiry, 401 cleanup)

**v2.3 (15 avril 2026) :**
- Page de connexion i18n (`app/[lang]/login/`) avec layout deux colonnes, `GoogleButton` client, fix boucle redirect (`isLoginPath()` dans `proxy.ts`)
- Déduplication clips : `lib/utils/url.ts` (`normalizeProductUrl`), migration `updated_at`, `/api/clips` POST retourne 200/201 + `CLIP_UPDATED`/`CLIP_CREATED`, feedback popup extension
- Section "Analyser des produits" popup : compare list `chrome.storage.local`, max 5 produits, `handleCompareAdd`/`handleCompareRemove`/`handleCompareChat`, styles `.compare-*` autonomes (hex en dur)
