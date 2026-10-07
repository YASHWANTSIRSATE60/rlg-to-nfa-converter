# RLG to NFA Converter

**TAE-1: Project Based Learning · Theory of Computation (N-PCCCM503T)**
Yashwant Indrakumar Sirsate · CM24060 · 5th Semester CSE (AI&ML)
S. B. Jain Institute of Technology, Management & Research, Nagpur · Session 2026–27 (ODD)

## Project
A browser-based tool that parses a Right-Linear Grammar (RLG), validates it, generates the equivalent **NFA** (transition table + SVG diagram) and checks whether a string is accepted. Pure HTML + CSS + JavaScript; no backend, database or API key.

## Problem Statement
Right-Linear Grammar (RLG) to FA: build a parser that converts a Right-Linear Grammar (e.g., A → aB | b) into its corresponding NFA transition table.

## Objective
Validate an RLG, convert it to an NFA, display the transition table and diagram, and demonstrate valid and invalid inputs.

## Theory
G = (V, T, P, S) is right-linear if every production is `A → wB` or `A → w` (a non-terminal only at the right end). Right-linear grammars generate exactly the **regular languages**, equivalent in power to NFAs, DFAs and regular expressions. The conversion here produces an **NFA** (not a DFA); a DFA would additionally need the subset construction.

NFA M = (Q, Σ, δ, q₀, F): Q = V ∪ {F}, Σ = T, q₀ = S, F-set = {F} ∪ {A : A → ε ∈ P}.

## Conversion Rules
| Production | NFA effect |
|---|---|
| `A → aB` | `A --a--> B` (add B to δ(A, a)) |
| `A → a` | `A --a--> F` (F is the accepting final state, no outgoing moves) |
| `A → ε` | no transition; A is added to the final states |

F is created only if a terminal-only production exists. If the grammar already uses a non-terminal named `F`, the final state is displayed as `qf` to avoid a clash.

## Algorithm
```
parse + validate G
Q = V ; q0 = S ; Σ = T ; finals = {}
for each production A -> alpha:
    alpha = aB : add B to delta(A, a)
    alpha = a  : add F to delta(A, a) ; finals += F
    alpha = ε  : finals += A
simulate(w): active = {q0}; for each symbol c: active = union of delta(q, c); accept iff active ∩ finals ≠ ∅
```
Complexity: conversion O(m) for m productions; simulation O(|w|·m); states = |V| + 1.

## Features
- Clickable **Verification Test Cases** (5 valid, 7 invalid) with Expected vs Actual and a "Run all" button
- Section 1: grammar input, detected non-terminals / terminals / start symbol, VALID / INVALID status with the exact reason
- Section 2: states, alphabet, start and final state, transition table (Current State, Input, Next State, Production, Explanation), δ matrix, dynamic SVG diagram
- Section 3: string check with ✓ ACCEPTED / ✗ REJECTED, step-by-step trace, all active states tracked
- Responsive for mobile and desktop

## Input Syntax
One production per line · alternatives with `|` · `->` or `→` · capital letters = non-terminals · `a–z`, `0–9` = terminals · `ε` (or `eps`, `epsilon`, `lambda`, `λ`) = empty string · first left side = start symbol. Rejected with an explanation: empty input, missing arrow, left-linear rule (`Aa`), non-terminal not at the end (`aAb`), several terminals (`ab`), two non-terminals, undefined non-terminal, invalid symbol.

## Examples
```
S -> aA | b          Test 1: L = (aa)*(b | ab); aab accepted, abb rejected
A -> aS | b

S -> aA | b          Test 3: A -> ε makes A final; "a" accepted
A -> aB | ε
B -> b

S -> aS | aA | ε     Test 4: two moves on 'a' (non-deterministic)
A -> b
```

## Testing
`node tests/test.js` runs 75 checks (valid/invalid grammars, arrow and spacing variants, conversion rules, accepted/rejected strings, multiple transitions, terminal-only, ε, empty and malformed input, trace, diagram generation). The in-app "Run all" button evaluates the 12 verification cases.

## Project Structure
```
index.html      page layout
style.css       styling
script.js       parser, NFA builder, simulator, SVG drawing, UI
tests/test.js   automated checks
README.md
```

## How to Run
Open `index.html` in any browser (no server needed). Optional: `node tests/test.js`.

## GitHub Pages Deployment
1. Create a public repository `rlg-to-nfa-converter`.
2. Upload `index.html`, `style.css`, `script.js`, `README.md`, `tests/`.
3. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
4. Open `https://<your-username>.github.io/rlg-to-nfa-converter/` after about a minute.

## Limitations
Single-letter non-terminals; one terminal per production (normal form); left-linear grammars are rejected, not converted; output is an NFA only (no DFA conversion or minimisation).

## Future Scope
Multi-terminal productions (`A → abB`), left-linear support, NFA → DFA conversion, animated simulation on the diagram, CSV export of the table.
