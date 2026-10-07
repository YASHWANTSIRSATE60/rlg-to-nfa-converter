// Run: node tests/test.js   (real assertions against script.js)
const { parseGrammar, buildNFA, simulate, drawNFA, evaluate, TESTS, G1 } = require("../script.js");
let pass = 0, fail = 0;
function t(name, cond) { cond ? pass++ : fail++; console.log((cond ? "PASS " : "FAIL ") + name); }
const nfaOf = g => buildNFA(parseGrammar(g)), acc = (g, s) => simulate(nfaOf(g), s).accepted;
const G2 = "S -> 0A | 1\nA -> 0S | 1", G3 = "S -> aA | b\nA -> aB | ε\nB -> b", G4 = "S -> aS | aA | ε\nA -> b", G5 = "S -> aS | bA | c\nA -> a";
// every built-in verification case behaves as declared
TESTS.forEach(c => t(`${c.id} (${c.what}) => ${c.expect}`, evaluate(c.g, c.str) === c.expect));
// A/J valid grammar, arrow + spacing variants
t("valid grammar", parseGrammar(G1).ok);
t("unicode arrows", parseGrammar("S → aA | b\nA → aS | b").ok);
t("odd spacing", parseGrammar("  S   ->   a A  |  b  \n A->aS|b ").ok);
t("chips data", parseGrammar(G1).order.join() === "S,A" && parseGrammar(G1).terminals.join() === "a,b" && parseGrammar(G1).start === "S");
// B/H/I invalid + malformed
t("empty input", parseGrammar("  ").errors[0].includes("empty"));
t("missing arrow", !parseGrammar("S aA | b").ok);
t("two arrows", !parseGrammar("S -> a -> b").ok);
t("lower-case left side", !parseGrammar("s -> a").ok);
t("empty alternative", !parseGrammar("S -> a |").ok);
t("two non-terminals", !parseGrammar("S -> aAB\nA -> a\nB -> b").ok);
t("undefined NT message", parseGrammar("S -> aB").errors[0].includes("missing definition"));
t("left-linear message", parseGrammar("S -> Aa\nA -> a").errors[0].includes("left-linear"));
// Conversion rules
const n1 = nfaOf(G1);
t("states S,A,F", n1.states.join() === "S,A,F");
t("S-a->A", n1.delta["S|a"].has("A")); t("S-b->F", n1.delta["S|b"].has("F"));
t("A-a->S", n1.delta["A|a"].has("S")); t("A-b->F", n1.delta["A|b"].has("F"));
t("start S, final F, 4 transitions", n1.start === "S" && n1.finals.join() === "F" && n1.transitions.length === 4);
t("final renamed qf if F is a non-terminal", nfaOf("S -> aF\nF -> b").finalName === "qf");
// C/D accepted & rejected
["b", "ab", "aab", "aaab", "aaaab"].forEach(s => t("G1 accepts " + s, acc(G1, s)));
["", "a", "aa", "abb", "ba"].forEach(s => t("G1 rejects '" + s + "'", !acc(G1, s)));
["1", "01", "001"].forEach(s => t("G2 accepts " + s, acc(G2, s))); ["0", "000", "11"].forEach(s => t("G2 rejects " + s, !acc(G2, s)));
["c", "aac", "ba", "aaba"].forEach(s => t("G5 accepts " + s, acc(G5, s))); ["b", "bac", "ab"].forEach(s => t("G5 rejects " + s, !acc(G5, s)));
// G epsilon
const n3 = nfaOf(G3);
t("G3 A final via ε", n3.finals.join() === "A,F" || n3.finals.includes("A"));
["b", "a", "aab"].forEach(s => t("G3 accepts " + s, simulate(n3, s).accepted)); ["", "aa", "ab", "aabb"].forEach(s => t("G3 rejects '" + s + "'", !simulate(n3, s).accepted));
// E multiple transitions
const n4 = nfaOf(G4);
t("G4 non-deterministic", n4.nondet && n4.delta["S|a"].size === 2);
t("G4 trace tracks both states", simulate(n4, "a").steps[1].states.join() === "S,A");
["", "aaa", "ab", "aab"].forEach(s => t("G4 accepts '" + s + "'", simulate(n4, s).accepted)); ["b", "abb"].forEach(s => t("G4 rejects " + s, !simulate(n4, s).accepted));
// F terminal-only
t("terminal-only grammar", simulate(nfaOf("S -> a"), "a").accepted && !simulate(nfaOf("S -> a"), "aa").accepted);
t("no F when unneeded", !nfaOf("S -> aS | ε").usesFinal);
t("trace moves recorded", simulate(n1, "aab").steps.slice(1).map(s => s.moves.join()).join(" | ") === "S --a--> A | A --a--> S | S --b--> F");
t("invalid string flagged", !!simulate(n1, "abc").error);
t("diagram renders", drawNFA(n1).startsWith("<svg") && drawNFA(n4).includes("circle"));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
