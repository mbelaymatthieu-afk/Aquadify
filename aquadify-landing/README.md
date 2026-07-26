# Page publique de téléchargement — Aquadify

Fichier : **`telecharger.html`** (autonome, sans dépendance, HTTPS-ready, rapide, responsive iPhone/Android/ordinateur).

## URL cible (ne change JAMAIS — à mettre dans vos QR codes / flyers)
```
https://aquadify.com/telecharger
```

## Comment l'héberger sur aquadify.com
Le chemin doit être `/telecharger` (sans `.html`). Deux options courantes :

**Option A — dossier avec index**
- Créez un dossier `telecharger/` à la racine du site et placez ce fichier dedans en le renommant `index.html` :
  - `aquadify.com/telecharger/` → sert `telecharger/index.html`

**Option B — règle de réécriture**
- Gardez `telecharger.html` à la racine et ajoutez une règle serveur :
  - Nginx : `location = /telecharger { try_files /telecharger.html =404; }`
  - Apache (.htaccess) : `RewriteRule ^telecharger/?$ telecharger.html [L]`
  - Netlify (`_redirects`) : `/telecharger  /telecharger.html  200`
  - Vercel (`vercel.json` rewrites) : `{ "source": "/telecharger", "destination": "/telecharger.html" }`

> Aucune configuration Firebase Dynamic Links. Aucun faux lien de store.

## Ajouter les liens des stores (plus tard, SANS refaire les QR codes)
Ouvrez `telecharger.html` et modifiez UNIQUEMENT ces deux variables en haut du fichier :
```js
var APP_STORE_URL   = "";   // ex: "https://apps.apple.com/app/idXXXXXXXXX"
var GOOGLE_PLAY_URL = "";   // ex: "https://play.google.com/store/apps/details?id=com.mtagency.aquadify"
```
Comportement automatique une fois renseignés :
- **iPhone / iPad** → redirection immédiate vers `APP_STORE_URL` (via `location.replace`, aucune boucle).
- **Android** → redirection immédiate vers `GOOGLE_PLAY_URL`.
- **Ordinateur / appareil non reconnu** → les deux boutons deviennent cliquables (plus de mention « Bientôt disponible »).
- Tant qu'une variable est vide, le bouton correspondant reste **non cliquable** (aucun faux lien) et aucune redirection n'est déclenchée.

Le QR code (`https://aquadify.com/telecharger`) reste identique : vous ne changez que ces deux lignes.

## Aperçu de test
Une copie est servie sur l'aperçu de dev :
`https://<votre-preview>/telecharger.html`
(le fichier de référence à déployer est `aquadify-landing/telecharger.html`).
