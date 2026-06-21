# Règles de design — Exilium

Rubric que les bots utilisent pour **évaluer** le jeu, et que l'agent-designer
utilise pour **structurer ses recos**. Chaque règle dit : le principe, ce à quoi
ressemble « bon », et **comment c'est vérifié** :

- `[déterministe]` — mesurable par code, sans LLM (audit routes, compteur de clics…).
- `[persona]` — jugé par un bot-persona qui joue (tag la friction par règle + sévérité).
- `[designer]` — synthétisé par l'agent-designer à partir des findings.

> Statut : v1, à amender. Les règles marquées ⚠ ont déjà un constat mesuré (baseline).

---

## 1. Structure de l'information (IA)

- **R1 — Objet principal clair** `[persona]` : chaque écran a UN objet évident ; le
  joueur sait en < 5 s « où je suis et à quoi sert cet écran ».
- **R2 — Regroupement logique** `[persona][designer]` : les fonctions liées vivent
  au même endroit ; rien d'orphelin ni de doublonné entre deux écrans.
- **R3 — Profondeur maîtrisée** `[déterministe]` : pas plus de 3 niveaux de
  navigation pour atteindre une fonction de jeu courante.

## 2. Économie de clics (règle des clics)

- **R4 — Tâches fréquentes ≤ 3 clics** `[déterministe][persona]` : depuis l'accueil,
  les actions du quotidien (construire un bâtiment, lancer une recherche, produire
  un vaisseau, envoyer une flotte) s'atteignent en 3 clics max. Le bot **compte les
  clics réels** jusqu'à l'objectif → métrique par tâche.
- **R5 — Pas de clic mort** `[persona]` : aucune confirmation inutile, aucune étape
  vide ou redondante sur le chemin d'une action.

## 3. Adressabilité par URL  ⚠

- **R6 — Une destination = une URL** `[déterministe]` : tout ce que le joueur perçoit
  comme « une page » (onglet, sous-vue, détail) a une URL stable, partageable,
  qui survit au refresh.
- **R7 — L'état clé est dans l'URL, pas caché** `[déterministe]` : la **planète
  active**, l'onglet courant, l'entité sélectionnée doivent être dans l'URL
  (params/searchParams), pas dans un store/localStorage.
- **R8 — Retour & refresh ne perdent pas le contexte** `[persona]` : le bouton
  Retour ferme/recule logiquement ; F5 garde le joueur là où il était.

  **Baseline mesurée (2026-06-21)** : ⚠ `activePlanetId` vit dans `localStorage`
  (`stores/planet.store.ts`), aucune route n'a de `:planetId` → toute page
  planète-scopée viole **R7** (même URL pour planète A et B). Seuls 9 fichiers
  utilisent `useSearchParams` ; la majorité des onglets sont en `useState` local
  → violations partielles de **R6**.

## 4. Clarté & langage

- **R9 — Libellés explicites** `[persona]` : pas de jargon 4X non expliqué au moins
  une fois ; les intitulés d'action disent ce qui va se passer.
- **R10 — États vides actionnables** `[persona]` : un écran/section vide dit quoi
  faire ensuite, jamais juste « Aucun X ».

## 5. Feedback & cohérence

- **R11 — Retour immédiat** `[persona]` : toute action produit un retour visible
  (la construction lancée apparaît dans une file, un toast confirme, etc.).
- **R12 — Cohérence des patterns** `[persona][designer]` : un même type d'action se
  fait toujours de la même façon (même placement, même libellé, même interaction).

## 6. Accessibilité (cf. skill accessibility-review)

- **R13 — Contraste, cibles tactiles, clavier** `[déterministe][persona]` : contraste
  AA, cibles ≥ 44 px (PWA mobile), navigation clavier possible.

---

## Comment ça alimente la chaîne

1. Les bots-personas reçoivent ce rubric dans leur prompt → chaque friction est
   **taguée par règle** (`R4`, `R7`…) + sévérité, au lieu d'un ressenti libre.
2. Un **auditeur déterministe** (sans LLM) calcule les règles mesurables :
   couverture URL (R6/R7), profondeur (R3), clics par tâche (R4), a11y (R13).
3. L'**agent-designer** ingère findings persona + audit déterministe et produit
   `reco-design.md` : regroupé par thème, priorisé (impact × effort), avec des
   propositions concrètes — le livrable pour le designer humain (ou À sa place).
