# JZ KALYPHOR – Plateforme de Suivi des Étudiants

## Vue d'ensemble
Application mobile (Expo) de suivi des étudiants pour JZ KALYPHOR, programme de coaching en certificats en ligne en Côte d'Ivoire. Interface 100% française, couleur bordeaux (#8A1C2B).

## Rôles
- **Étudiant** : voit uniquement ses propres données.
- **Admin / Coach** : seul `jeanjonathanzamble@gmail.com` a accès au panneau admin.

## Fonctionnalités Étudiant
- Message de bienvenue à la première connexion.
- Dashboard : certificat visé, date début, date limite, barre d'avancement %, jours restants.
- Liste des cours avec type (YouTube, PDF, Plateforme externe) et statut (À faire / En cours / Terminé) — l'étudiant peut changer le statut et ouvrir le lien.
- Dépôt de preuve hebdomadaire via sélecteur d'image (Emergent Object Storage) avec commentaire.
- Génération d'un bilan PDF (via page HTML imprimable).
- Messagerie privée avec le coach (polling 5s).
- Infos pratiques + bouton WhatsApp +225 07 00 92 19 22.
- Profil éditable (nom, téléphone) + stats globales.

## Fonctionnalités Admin / Coach
- Liste des étudiants avec filtres par cohorte (regroupement YYYY-MM) et statut (En cours / En retard / Terminé).
- Ajout / modification / suppression d'étudiants, mot de passe inclus.
- Attribution de cours (YouTube/PDF/Plateforme) + dates limites.
- Vue dédiée « Étudiants en retard » (pas de preuve depuis 7+ jours).
- Bouton WhatsApp pré-rempli pour relance rapide sur les cartes en retard.
- Fiche étudiant détaillée : avancement, historique des preuves, note privée du coach.
- Bilan général (BarChart et LineChart via react-native-gifted-charts) : total, retards, terminés, avancement moyen par cohorte.

## Architecture
- **Frontend** : Expo Router (file-based), React Native + TypeScript, bordeaux #8A1C2B.
- **Backend** : FastAPI + MongoDB + JWT (HS256, 30 jours), bcrypt pour mots de passe.
- **Storage** : Emergent Object Storage (bucket partagé via `/api/upload` et `/api/files/...` avec token signé).

## Comptes de démo seedés
- `jeanjonathanzamble@gmail.com` / `Kalyphor2026!` (coach)
- `amina.kone@demo.ci` / `Demo2026!` (étudiante, en cours)
- `yao.diomande@demo.ci` / `Demo2026!` (étudiant, en retard)
- `fatou.traore@demo.ci` / `Demo2026!` (étudiante, terminé)
- `koffi.aka@demo.ci` / `Demo2026!` (étudiant, en retard)

## Opportunité business
Ajouter un module de **paiement progressif** via Stripe/PayPal/Wave : chaque étudiant débloque sa cohorte en versant un acompte, et le coach suit en temps réel les paiements en retard dans la même vue "En retard". Monétise la plateforme et réduit l'attrition.
