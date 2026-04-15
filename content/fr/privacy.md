# Politique de Confidentialité

*Dernière mise à jour : avril 2026*

## 1. Responsable du traitement

Le responsable du traitement des données à caractère personnel est Sumear, micro-entreprise immatriculée sous le SIRET [TON_SIRET], représentée par [TON_NOM].

Contact : privacy@sumear.app

## 2. Données collectées

### 2.1 Données de compte

Lors de l'inscription via Google OAuth, nous collectons :

- Adresse email
- Nom et prénom
- Photo de profil (fournie par Google)

### 2.2 Données d'utilisation du Service

- Produits capturés (clips) : nom, prix, URL source, image, description, avis, spécifications techniques tels qu'extraits des sites marchands
- Projets d'achat créés par l'Utilisateur
- Conversations avec l'intelligence artificielle (messages envoyés et réponses reçues)
- Compteurs d'utilisation (nombre de messages, clips, projets)

### 2.3 Données techniques

- Logs de connexion (adresse IP, horodatage)
- Données de navigation liées à l'extension Chrome (URL des pages visitées lors de l'utilisation active de la fonctionnalité de capture uniquement)

### 2.4 Données de paiement

Les données bancaires sont collectées et traitées exclusivement par Stripe (notre prestataire de paiement, certifié PCI-DSS). Nous ne stockons aucune donnée bancaire. Nous conservons uniquement les identifiants Stripe nécessaires à la gestion de l'abonnement.

## 3. Finalités du traitement

| Finalité | Base légale (RGPD) |
|---|---|
| Fourniture du Service (clips, chat IA, projets) | Exécution du contrat (art. 6.1.b) |
| Gestion du compte et de l'abonnement | Exécution du contrat (art. 6.1.b) |
| Envoi du system prompt et des données produits au modèle d'IA pour générer des réponses | Exécution du contrat (art. 6.1.b) |
| Mesure d'usage et respect des quotas | Intérêt légitime (art. 6.1.f) |
| Amélioration du Service et correction de bugs | Intérêt légitime (art. 6.1.f) |
| Respect des obligations légales (facturation, lutte contre la fraude) | Obligation légale (art. 6.1.c) |

## 4. Sous-traitants et transferts de données

Nous faisons appel aux sous-traitants suivants :

| Sous-traitant | Rôle | Localisation des données |
|---|---|---|
| Supabase | Base de données, authentification | Union européenne (Francfort) |
| Vercel | Hébergement de l'application web | Union européenne (par défaut) |
| Anthropic | Fournisseur d'intelligence artificielle (Claude) | États-Unis |
| Stripe | Traitement des paiements | États-Unis / UE |
| ImprovMX | Redirection email | Union européenne |

**Concernant Anthropic :** les messages de l'Utilisateur et les données des produits clippés sont transmis à l'API d'Anthropic pour générer les réponses de l'IA. Anthropic traite ces données conformément à sa politique d'utilisation des données API, qui prévoit que les données ne sont pas utilisées pour entraîner ses modèles. Le transfert vers les États-Unis est encadré par les clauses contractuelles types de la Commission européenne.

## 5. Durée de conservation

| Données | Durée de conservation |
|---|---|
| Données de compte | Durée de l'inscription + 30 jours après suppression du compte |
| Clips, projets, conversations | Durée de l'inscription + 30 jours après suppression du compte |
| Logs de connexion | 12 mois |
| Données de facturation | 10 ans (obligation légale comptable) |
| Compteurs d'utilisation | Réinitialisés mensuellement, archivés 12 mois |

## 6. Droits de l'Utilisateur

Conformément au RGPD, l'Utilisateur dispose des droits suivants :

- **Droit d'accès** : obtenir une copie de ses données personnelles
- **Droit de rectification** : corriger des données inexactes
- **Droit à l'effacement** : demander la suppression de ses données (ou supprimer son compte directement depuis les paramètres)
- **Droit à la portabilité** : recevoir ses données dans un format structuré
- **Droit d'opposition** : s'opposer au traitement fondé sur l'intérêt légitime
- **Droit à la limitation** : demander la suspension du traitement

Pour exercer ces droits : privacy@sumear.app. Nous répondons dans un délai maximum de 30 jours.

En cas de réclamation, l'Utilisateur peut saisir la Commission Nationale de l'Informatique et des Libertés (CNIL) : [www.cnil.fr](https://www.cnil.fr).

## 7. Extension Chrome

### 7.1 Permissions

L'extension Chrome Sumear demande les permissions suivantes :

- **activeTab** : accéder au contenu de l'onglet actif uniquement lorsque l'Utilisateur clique sur l'extension
- **storage** : stocker localement les préférences et le token d'authentification
- **cookies** : gérer la session d'authentification avec sumear.app

### 7.2 Données transmises

L'extension transmet au serveur sumear.app uniquement les données de produit extraites de la page consultée (nom, prix, avis, spécifications) lorsque l'Utilisateur clique activement sur le bouton de capture. L'extension ne collecte aucune donnée de navigation en arrière-plan.

## 8. Cookies

Le Service utilise les cookies suivants :

| Cookie | Finalité | Durée |
|---|---|---|
| `sb-*-auth-token` | Session d'authentification Supabase | Durée de la session |
| `sumear-theme` | Préférence de thème (clair/sombre) | 1 an |
| `sumear-locale` | Préférence de langue (fr/en) | 1 an |

Aucun cookie de tracking, d'analytics ou publicitaire n'est utilisé.

## 9. Sécurité

Nous mettons en œuvre les mesures de sécurité suivantes :

- Chiffrement des communications (HTTPS/TLS)
- Row Level Security (RLS) sur toutes les tables de la base de données : chaque utilisateur n'accède qu'à ses propres données
- Authentification via OAuth 2.0 (Google)
- Clés API et secrets stockés en variables d'environnement, jamais exposés côté client
- Mises à jour de sécurité régulières des dépendances

## 10. Mineurs

Le Service n'est pas destiné aux personnes de moins de 16 ans. L'Éditeur ne collecte pas sciemment de données de mineurs de moins de 16 ans.

## 11. Modifications

La présente politique peut être modifiée à tout moment. Les modifications substantielles seront notifiées à l'Utilisateur par email. La date de dernière mise à jour est indiquée en haut de cette page.

## 12. Contact

Pour toute question relative à la protection de vos données : privacy@sumear.app
