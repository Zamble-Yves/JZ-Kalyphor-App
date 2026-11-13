# DevisBTP CI — Guide de commercialisation

> **Référence importée — ne pas utiliser telle quelle.** Ces fichiers décrivent une application Next.js distincte de l'application Expo de ce dépôt. Ils sont conservés ici comme références et ne remplacent pas la configuration active. Les identifiants par défaut fournis ont été retirés ; configurez des secrets uniques hors du dépôt et faites tourner toute valeur qui aurait déjà été utilisée.

Application SaaS PWA de devis BTP par IA pour la Côte d'Ivoire. Ce guide couvre la mise en ligne, les accès, la sécurité et l'exploitation.

## 1. Ce qui est livré

- **Application PWA installable** (Android / iOS / bureau) : accueil public, connexion, tableau de bord, wizard 3 étapes, éditeur, export PDF **A4 / A3**, WhatsApp, signature client, factures d'acompte, avenants, dépenses, planning IA, profil entreprise.
- **Authentification multi-comptes** : mot de passe haché (scrypt), sessions signées 30 jours, données strictement isolées par compte, limitation de débit.
- **Paiement** Wave / Orange Money avec activation immédiate par ID de transaction + contrôle a posteriori dans `/admin`.
- **Espace administrateur** `/admin` : comptes, rôles, suspensions, activations, contrôle des paiements, synchronisation Supabase.
- **Pages légales** : `/mentions-legales`, `/cgu`, `/confidentialite` + 404 et page hors-ligne.
- **En-têtes de sécurité** : HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, `no-store` sur les API.

## 2. Accès à conserver

| Accès | Configuration |
| --- | --- |
| Connexion fondateur | Utiliser un compte configuré individuellement ; aucun identifiant par défaut n'est documenté ici. |
| Espace admin (`/admin`) | Définir un PIN administrateur unique via `ADMIN_PIN`. |
| Code fondateur (Mes Prix) | Définir un code fondateur unique via `FOUNDER_CODE`. |

**À faire avant l'ouverture commerciale** : définir `ADMIN_PIN`, `FOUNDER_CODE`, `AUTH_SECRET` dans les variables d'environnement, et changer le mot de passe du compte fondateur.

## 3. Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (obligatoire) |
| `AUTH_SECRET` | Clé de signature des sessions (recommandé, sinon valeur interne) |
| `ADMIN_PIN` / `FOUNDER_CODE` | Codes d'administration et d'accès illimité |
| `ADMIN_WHATSAPP` | Numéro de réception des confirmations de paiement |
| `SUPABASE_URL` / `SUPABASE_KEY` | Synchronisation optionnelle Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL publique (sitemap) |

## 4. Déploiement (Vercel ou VPS)

1. Pousser le dépôt, importer dans Vercel (ou `npm ci && npm run build && npm start` sur VPS avec reverse proxy HTTPS).
2. Renseigner les variables d'environnement.
3. Appliquer le schéma : `npx drizzle-kit push`.
4. Créer les tables Supabase si utilisées : `/admin` → **Copier le script SQL Supabase** → SQL Editor → Run.
5. Vérifier `https://votre-domaine/api/health` → `{"ok":true}`.

HTTPS est indispensable (installation PWA, caméra, presse-papiers).

## 5. Exploitation quotidienne

- **Paiements** : chaque activation apparaît dans `/admin` → *Activations à vérifier* (moyen, montant, référence, téléphone). Comparer avec Wave / Orange Money puis **Valider** ou **Rejeter** (le rejet annule les crédits).
- **Comptes** : recherche par e-mail, attribution de crédits, changement de rôle, suspension immédiate, réinitialisation de mot de passe.
- **Sauvegardes** : sauvegarde PostgreSQL quotidienne + synchronisation Supabase comme copie secondaire (bouton *Synchroniser maintenant*).
- **Support** : WhatsApp administrateur, diagnostic intégré (Mes Prix → Lancer le test).

## 6. Tarification commerciale

- Devis Unique : **4 900 FCFA**
- Pack Pro : **9 900 FCFA / mois** (5 devis)
- Illimité + Plan IA : **24 900 FCFA / 30 jours**
- 1 devis offert à l'inscription.

## 7. Points de contrôle avant lancement

- [ ] `ADMIN_PIN`, `FOUNDER_CODE`, `AUTH_SECRET` personnalisés
- [ ] Mot de passe du compte fondateur changé
- [ ] `NEXT_PUBLIC_SITE_URL` renseigné
- [ ] Liens Wave / Orange Money testés avec un petit montant
- [ ] `npx drizzle-kit push` exécuté sur la base de production
- [ ] Sauvegardes automatiques activées
- [ ] `/api/health` et une génération de devis testés sur le domaine final


