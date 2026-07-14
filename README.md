# Kai Desktop — modifier Stremio-Kai + changer les sources

Ce dépôt **n’est pas un site web**. C’est une mod du **client bureau Stremio-Kai** (`.exe` + `portable_config`) : on garde le lecteur MPV/SVP, on change **uniquement les sources** de contenus.

## Ce que tu gardes
- `stremio.exe` (Stremio-Kai / Community) — le vrai programme
- MPV, SVP, Anime4K, scripts dans `portable_config/`

## Ce qui change (les sources)
À la place de AIOStreams / Torrentio / addons cloud Stremio :

→ **MediaProvider local** sur `http://127.0.0.1:8765`  
   (catalogues anime Solo Leveling, AoT… + magnets de test ; optionnel nyaa/tpb via env)

Les configs addons Stremio d’origine sont archivées dans `legacy/stremio-ecosystem/`.

## Installation (Windows)

### 1. Installe / ouvre Stremio-Kai
Télécharge le build bureau : [Releases Stremio-Kai](https://github.com/allecsc/Stremio-Kai/releases)  
Note le dossier qui contient `stremio.exe` (ex. `C:\Stremio-Kai`).

### 2. Applique cette mod
```bat
cd C:\Users\iland\Stremio-Kai
git pull
git checkout cursor/kai-desktop-sources-2868
install-desktop.bat
```

Si `stremio.exe` n’est pas trouvé, **indique le chemin** :
```bat
find-stremio.bat
install-desktop.bat "D:\chemin\vers\stremio.exe"
```

> `C:\Stremio-Kai\stremio.exe` n’existe que si tu as extrait Kai **exactement** là.  
> Sinon télécharge : https://github.com/allecsc/Stremio-Kai/releases/latest

Le script :
1. démarre MediaProvider (`:8765`)
2. copie `portable_config` vers ton install Kai
3. lance `stremio.exe`

### 3. Une seule source dans Kai
Dans Stremio-Kai → **Addons** → installer :

```
http://127.0.0.1:8765/manifest.json
```

Désinstalle (ou ignore) les autres addons de streams/catalogs.

Login Stremio : **optionnel / inutile** (wizard Kai ne force plus le login).

## Sources live (optionnel)
```bat
set MEDIA_PROVIDERS=fake,nyaa,piratebay
cd media-provider
npm start
```

## Architecture

```
stremio.exe (Kai)
    ├── portable_config/     ← MPV + SVP + webmods (inchangés côté player)
    └── addon HTTP local
            └── media-provider :8765   ← TES sources
                    Board / Discover / Player = UI Kai native
```

Pas de `stremio-web`, pas de navigateur requis pour regarder.
