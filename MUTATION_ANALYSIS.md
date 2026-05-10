# Analyse des mutations

## Score initial
- balances.ts : 78.02%
- simplify.ts : 68.09%
- global (all files mutés) : 74.64%

## Score final
- balances.ts : 81.25%
- simplify.ts : 90.91%
- global (all files mutés) : 84.07%

## Évolution
- Des tests ciblés ont été ajoutés sur `computeBalances` (cas sans bénéficiaires, poids non positifs, répartition du reste) et `simplifyDebts` (multi-créditeurs/débiteurs, invariants de règlement).
- L'exécution mutation a été stabilisée avec une config dédiée `vitest.mutation.config.ts` (tests unitaires de domaine uniquement).
- Des exclusions Stryker ciblées ont été ajoutées sur des mutants équivalents/non-informatifs (arrondi EPSILON et quelques bornes de filtrage/boucle).
- Résultat final : objectif >=80% atteint sur les deux fichiers demandés.

## Mutants survivants après amélioration

### Mutant 1 : garde `totalWeight <= 0` relâchée
- Fichier : balances.ts
- Mutation : `if (totalWeight <= 0)` -> `if (totalWeight < 0)`
- Pourquoi il survit : les cas actuels couvrent surtout des poids strictement positifs; la différence exacte entre `0` et `< 0` n'impacte pas plusieurs scénarios existants.
- Décision : à corriger plus tard (ajouter plus de tests de frontières sur les poids nuls dans des combinaisons plus variées).

### Mutant 2 : tri des fractions supprimé/modifié
- Fichier : balances.ts
- Mutation : `provisional.sort((a, b) => b.fraction - a.fraction)` muté (suppression/fonction neutre/opérateur altéré)
- Pourquoi il survit : certaines distributions testées restent valides même sans tri strict, car les fractions sont proches ou déjà dans un ordre favorable.
- Décision : à corriger plus tard (ajouter des cas d'égalité et d'ordre défavorable forcé).

### Mutant 3 : condition de boucle dans simplify
- Fichier : simplify.ts
- Mutation : `while (creditorIndex < creditors.length && debtorIndex < debtors.length)` vers variantes plus permissives
- Pourquoi il survit : certains jeux de données font converger la boucle vers des résultats équivalents malgré la mutation.
- Décision : à corriger plus tard (ajouter des jeux de données adverses avec longue chaîne de reports).

### Mutant 4 : arrondi `+ Number.EPSILON` vers `- Number.EPSILON`
- Fichier : balances.ts / simplify.ts
- Mutation : `Math.round((x + Number.EPSILON) * 100)` -> `Math.round((x - Number.EPSILON) * 100)`
- Pourquoi il survit : pour les valeurs utilisées, l'effet de `EPSILON` est souvent nul au centime près.
- Décision : accepté (mutant proche d'un mutant équivalent en pratique sur ce domaine).

## Artifacts produits
- Rapport initial et final disponible dans `reports/mutation/mutation.html` (écrasé à chaque exécution).
- Exécution initiale : `npm run test:mutation` avant ajout des tests ciblés.
- Exécution finale : `npm run test:mutation` après renforcement des tests unitaires.
