# J4CK'S LOCATION — Site Complet

## Installation

```bash
npm install
```

## Configuration

1. Ouvre le fichier `.env`
2. Remplace `REMPLACE_PAR_TA_CLE_API` par ta clé Anthropic
3. Change les mots de passe si tu veux

```
ANTHROPIC_API_KEY=sk-ant-api03-...
ADMIN_PASSWORD=tonmotdepasse
SUPERADMIN_PASSWORD=tonsupermotdepasse
```

## Lancement

```bash
node server.js
```

Le site tourne sur http://localhost:3000

## Pages

| URL | Description |
|-----|-------------|
| / | Site public |
| /admin | Dashboard Admin |
| /superadmin | Super Admin |

## Mots de passe par défaut

- Admin : `admin2024`
- Super Admin : `super2024`

**⚠️ Change-les dans .env avant de mettre en ligne !**

## Déploiement sur Render

1. Push sur GitHub
2. New Web Service sur Render
3. Ajoute les variables d'environnement dans Render Dashboard
4. Start command : `node server.js`
