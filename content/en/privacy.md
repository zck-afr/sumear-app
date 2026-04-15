# Privacy Policy

*Last updated: April 2026*

## 1. Data controller

The data controller for personal data processing is Sumear, a sole proprietorship registered in France under SIRET [TON_SIRET], represented by [TON_NOM].

Contact: privacy@sumear.app

## 2. Data collected

### 2.1 Account data

When registering via Google OAuth, we collect:

- Email address
- First and last name
- Profile picture (provided by Google)

### 2.2 Service usage data

- Captured products (clips): name, price, source URL, image, description, reviews, technical specifications as extracted from merchant websites
- Shopping projects created by the User
- Conversations with the artificial intelligence (messages sent and responses received)
- Usage counters (number of messages, clips, projects)

### 2.3 Technical data

- Connection logs (IP address, timestamp)
- Browsing data related to the Chrome extension (URLs of visited pages only during active use of the capture feature)

### 2.4 Payment data

Banking data is collected and processed exclusively by Stripe (our payment provider, PCI-DSS certified). We do not store any banking data. We only retain the Stripe identifiers necessary for subscription management.

## 3. Purposes of processing

| Purpose | Legal basis (GDPR) |
|---|---|
| Provision of the Service (clips, AI chat, projects) | Performance of contract (Art. 6.1.b) |
| Account and subscription management | Performance of contract (Art. 6.1.b) |
| Sending system prompt and product data to the AI model to generate responses | Performance of contract (Art. 6.1.b) |
| Usage measurement and quota enforcement | Legitimate interest (Art. 6.1.f) |
| Service improvement and bug fixes | Legitimate interest (Art. 6.1.f) |
| Compliance with legal obligations (billing, fraud prevention) | Legal obligation (Art. 6.1.c) |

## 4. Sub-processors and data transfers

We use the following sub-processors:

| Sub-processor | Role | Data location |
|---|---|---|
| Supabase | Database, authentication | European Union (Frankfurt) |
| Vercel | Web application hosting | European Union (by default) |
| Anthropic | Artificial intelligence provider (Claude) | United States |
| Stripe | Payment processing | United States / EU |
| ImprovMX | Email forwarding | European Union |

**Regarding Anthropic:** User messages and clipped product data are transmitted to Anthropic's API to generate AI responses. Anthropic processes this data in accordance with its API data usage policy, which provides that data is not used to train its models. Transfers to the United States are governed by the European Commission's Standard Contractual Clauses.

## 5. Data retention

| Data | Retention period |
|---|---|
| Account data | Duration of registration + 30 days after account deletion |
| Clips, projects, conversations | Duration of registration + 30 days after account deletion |
| Connection logs | 12 months |
| Billing data | 10 years (legal accounting obligation) |
| Usage counters | Reset monthly, archived for 12 months |

## 6. User rights

Under the GDPR, the User has the following rights:

- **Right of access**: obtain a copy of their personal data
- **Right to rectification**: correct inaccurate data
- **Right to erasure**: request deletion of their data (or delete their account directly from settings)
- **Right to portability**: receive their data in a structured format
- **Right to object**: object to processing based on legitimate interest
- **Right to restriction**: request suspension of processing

To exercise these rights: privacy@sumear.app. We respond within a maximum of 30 days.

In case of complaint, the User may contact the French Data Protection Authority (CNIL): [www.cnil.fr](https://www.cnil.fr), or their local data protection authority.

## 7. Chrome extension

### 7.1 Permissions

The Sumear Chrome extension requests the following permissions:

- **activeTab**: access the content of the active tab only when the User clicks on the extension
- **storage**: locally store preferences and the authentication token
- **cookies**: manage the authentication session with sumear.app

### 7.2 Data transmitted

The extension transmits to the sumear.app server only the product data extracted from the viewed page (name, price, reviews, specifications) when the User actively clicks the capture button. The extension does not collect any browsing data in the background.

## 8. Cookies

The Service uses the following cookies:

| Cookie | Purpose | Duration |
|---|---|---|
| `sb-*-auth-token` | Supabase authentication session | Session duration |
| `sumear-theme` | Theme preference (light/dark) | 1 year |
| `sumear-locale` | Language preference (fr/en) | 1 year |

No tracking, analytics, or advertising cookies are used.

## 9. Security

We implement the following security measures:

- Encrypted communications (HTTPS/TLS)
- Row Level Security (RLS) on all database tables: each user can only access their own data
- Authentication via OAuth 2.0 (Google)
- API keys and secrets stored in environment variables, never exposed client-side
- Regular security updates of dependencies

## 10. Children

The Service is not intended for persons under the age of 16. The Publisher does not knowingly collect data from minors under 16 years of age.

## 11. Changes

This policy may be updated at any time. Substantial changes will be communicated to the User by email. The last update date is indicated at the top of this page.

## 12. Contact

For any questions about data protection: privacy@sumear.app
