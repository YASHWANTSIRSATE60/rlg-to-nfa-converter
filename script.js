/* RLG -> NFA Converter | Yashwant Indrakumar Sirsate | CM24060 | Theory of Computation */
"use strict";
const EPS_WORDS = ["ε", "epsilon", "eps", "lambda", "λ"];
const FINAL = "F"; // final-state name (becomes "qf" only if the grammar already has a non-terminal F)

/* ---------- 1. Parser + validator ---------- */
function normalizeArrows(s) { return s.replace(/→|⟶|⇒|=>|-->|::=|:=/g, "->"); }

function checkAlt(alt, nt, line) {
  const where = `Line ${line} (${nt} → …): `;
  if (alt === "") return where + "empty alternative. Use ε explicitly for the empty string.";
  if (EPS_WORDS.includes(alt.toLowerCase()) || alt === "ε") return null;
  const bad = alt.match(/[^a-z0-9A-Z]/);
  if (bad) return where + `invalid symbol '${bad[0]}' in "${alt}". Only a–z, 0–9 (terminals) and A–Z (non-terminals) are allowed.`;
  if (/^[A-Z]/.test(alt)) return where + `"${alt}" starts with a non-terminal. This is left-linear / not right-linear. In RLG a non-terminal may appear only at the right end (A → aB).`;
  if (/^[a-z0-9][A-Z]$/.test(alt) || /^[a-z0-9]$/.test(alt)) return null;
  if (/[A-Z]/.test(alt.slice(0, -1))) return where + `"${alt}": a non-terminal appears before the end of the string. In RLG it may only be the LAST symbol.`;
  if (/[A-Z]{2,}$/.test(alt)) return where + `"${alt}" has more than one non-terminal. Right-linear allows at most one, at the end.`;
  return where + `"${alt}" has several terminals. This tool supports the normal form A → aB | a | ε (one terminal per production). Split it using extra non-terminals.`;
}

function parseGrammar(text) {
  const res = { ok: false, errors: [], warnings: [], productions: {}, order: [], start: null, terminals: [], rows: [] };
  if (!text || !text.trim()) { res.errors.push("Grammar is empty. Enter at least one production, e.g.  S -> aA | b"); return res; }
  const lines = normalizeArrows(text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const ln = i + 1, line = raw.trim();
    if (!line) return;
    const parts = line.split("->");
    if (parts.length !== 2) { res.errors.push(`Line ${ln}: "${line}" must have exactly one arrow (->  or →), e.g.  A -> aB | b`); return; }
    const lhs = parts[0].trim();
    if (!/^[A-Z]$/.test(lhs)) { res.errors.push(`Line ${ln}: left side "${lhs}" must be a single non-terminal (one capital letter A–Z).`); return; }
    if (!res.productions[lhs]) { res.productions[lhs] = []; res.order.push(lhs); }
    const alts = parts[1].split("|").map(a => a.replace(/\s+/g, ""));
    alts.forEach(a => {
      const err = checkAlt(a, lhs, ln);
      if (err) { res.errors.push(err); return; }
      const norm = EPS_WORDS.includes(a.toLowerCase()) ? "ε" : a;
      if (res.productions[lhs].includes(norm)) res.warnings.push(`Line ${ln}: duplicate alternative "${lhs} → ${norm}" ignored.`);
      else res.productions[lhs].push(norm);
    });
  });
  if (res.errors.length) return res;
  if (!res.order.length) { res.errors.push("No productions found."); return res; }
  const used = new Set(), terms = new Set();
  res.order.forEach(A => res.productions[A].forEach(p => {
    if (p === "ε") return;
    terms.add(p[0]); if (p[1]) used.add(p[1]);
  }));
  used.forEach(B => { if (!res.productions[B]) res.errors.push(`Non-terminal "${B}" is used on a right side but has no production of its own (missing definition).`); });
  if (res.errors.length) return res;
  res.start = res.order[0];
  res.terminals = [...terms].sort();
  // reachability warning
  const seen = new Set([res.start]), stack = [res.start];
  while (stack.length) { const A = stack.pop(); res.productions[A].forEach(p => { if (p[1] && !seen.has(p[1])) { seen.add(p[1]); stack.push(p[1]); } }); }
  res.order.forEach(A => { if (!seen.has(A)) res.warnings.push(`Non-terminal "${A}" is unreachable from start symbol ${res.start} (kept in the NFA, but never used).`); });
  res.ok = true; return res;
}

/* ---------- 2. RLG -> NFA ---------- */
function buildNFA(g) {
  const transitions = [], finals = new Set();
  let usesQf = false; const FN = g.productions.F ? "qf" : FINAL;
  g.order.forEach(A => g.productions[A].forEach(p => {
    if (p === "ε") { finals.add(A); return; }
    if (p.length === 2) transitions.push({ from: A, sym: p[0], to: p[1], prod: `${A} → ${p}`, type: `Non-terminal transition` });
    else { usesQf = true; transitions.push({ from: A, sym: p[0], to: FN, prod: `${A} → ${p}`, type: `Terminal transition to final state ${FN}` }); }
  }));
  if (usesQf) finals.add(FN);
  const states = [...g.order]; if (usesQf) states.push(FN);
  const delta = {};
  transitions.forEach(t => { const k = t.from + "|" + t.sym; (delta[k] = delta[k] || new Set()).add(t.to); });
  const nondet = Object.values(delta).some(s => s.size > 1);
  return { finalName: FN, usesFinal: usesQf, states, alphabet: g.terminals, start: g.start, finals: [...finals], transitions, delta, nondet,
           epsFinals: g.order.filter(A => g.productions[A].includes("ε")) };
}

/* ---------- 3. NFA simulation (set-of-states) ---------- */
function simulate(nfa, str) {
  const s = (str || "").replace(/\s+/g, "");
  for (const c of s) if (!nfa.alphabet.includes(c))
    return { error: `Invalid test string: symbol '${c}' is not in the alphabet Σ = { ${nfa.alphabet.join(", ")} }.` };
  let cur = new Set([nfa.start]);
  const steps = [{ read: "—", moves: [], states: [...cur] }];
  for (const c of s) {
    const nxt = new Set(), moves = [];
    cur.forEach(q => (nfa.delta[q + "|" + c] || []).forEach(t => { nxt.add(t); moves.push(`${q} --${c}--> ${t}`); }));
    cur = nxt; steps.push({ read: c, moves, states: [...cur] });
    if (!cur.size) break;
  }
  const consumed = steps.length - 1 === s.length;
  const hit = [...cur].filter(q => nfa.finals.includes(q));
  const accepted = consumed && hit.length > 0;
  let why;
  if (!consumed) why = "All paths died (no transition) before the string ended.";
  else if (accepted) why = `After the last symbol the active set contains final state ${hit.join(", ")}.`;
  else why = "After the last symbol no active state is a final state.";
  return { accepted, steps, why, str: s };
}

/* ---------- 4. Verification test cases (each is really evaluated) ---------- */
const G1 = "S -> aA | b\nA -> aS | b";
const TESTS = [
  { id: "Test 1", label: "S→aA|b / A→aS|b", g: G1, str: "aab", expect: "ACCEPTED", what: "valid grammar, accepted string" },
  { id: "Test 2", label: "S→0A|1 / A→0S|1", g: "S -> 0A | 1\nA -> 0S | 1", str: "000", expect: "REJECTED", what: "binary alphabet, rejected string" },
  { id: "Test 3", label: "S→aA|b / A→aB|ε / B→b", g: "S -> aA | b\nA -> aB | ε\nB -> b", str: "a", expect: "ACCEPTED", what: "epsilon production makes A final" },
  { id: "Test 4", label: "S→aS|aA|ε / A→b", g: "S -> aS | aA | ε\nA -> b", str: "aab", expect: "ACCEPTED", what: "multiple transitions on 'a' (non-deterministic)" },
  { id: "Test 5", label: "S→aS|bA|c / A→a", g: "S -> aS | bA | c\nA -> a", str: "bac", expect: "REJECTED", what: "terminal-only productions; extra symbol rejected" },
  { id: "Invalid 1", label: "S→Aa|b (left-linear)", g: "S -> Aa | b\nA -> a", str: "", expect: "INVALID GRAMMAR", what: "non-terminal on the left of a terminal", bad: 1 },
  { id: "Invalid 2", label: "S→aB|b (B undefined)", g: "S -> aB | b", str: "", expect: "INVALID GRAMMAR", what: "missing non-terminal definition", bad: 1 },
  { id: "Invalid 3", label: "S→ab (two terminals)", g: "S -> ab", str: "", expect: "INVALID GRAMMAR", what: "unsupported production form", bad: 1 },
  { id: "Invalid 4", label: "S→aAb (A in middle)", g: "S -> aAb\nA -> a", str: "", expect: "INVALID GRAMMAR", what: "non-terminal not at the right end", bad: 1 },
  { id: "Invalid 5", label: "S→a$ (bad symbol)", g: "S -> a$ | b", str: "", expect: "INVALID GRAMMAR", what: "symbol outside a–z, 0–9, A–Z", bad: 1 },
  { id: "Invalid 6", label: "Empty input", g: "", str: "", expect: "INVALID GRAMMAR", what: "empty grammar", bad: 1 },
  { id: "Invalid 7", label: "Test 1 grammar + string abc", g: G1, str: "abc", expect: "INVALID STRING", what: "symbol 'c' not in Σ = {a, b}", bad: 1 }
];
function evaluate(gText, str) {
  const g = parseGrammar(gText);
  if (!g.ok) return "INVALID GRAMMAR";
  const r = simulate(buildNFA(g), str);
  return r.error ? "INVALID STRING" : (r.accepted ? "ACCEPTED" : "REJECTED");
}

/* ---------- 5. SVG diagram ---------- */
function drawNFA(nfa) {
  const W = 700, H = 380, R = 24, n = nfa.states.length, ns = "http://www.w3.org/2000/svg";
  const pos = {}, rx = n === 1 ? 0 : W / 2 - 90, ry = n <= 2 ? 0 : H / 2 - 80;
  nfa.states.forEach((q, i) => { const a = Math.PI + 2 * Math.PI * i / n; pos[q] = { x: W / 2 + rx * Math.cos(a), y: H / 2 + ry * Math.sin(a) }; });
  if (n === 2) { pos[nfa.states[0]] = { x: W / 2 - 150, y: H / 2 }; pos[nfa.states[1]] = { x: W / 2 + 150, y: H / 2 }; }
  const groups = {};
  nfa.transitions.forEach(t => { const k = t.from + ">" + t.to; (groups[k] = groups[k] || { from: t.from, to: t.to, syms: [] }).syms.push(t.sym); });
  let s = `<svg xmlns="${ns}" viewBox="0 0 ${W} ${H}" role="img" aria-label="NFA diagram"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>`;
  const cx = W / 2, cy = H / 2;
  Object.values(groups).forEach(e => {
    const label = [...new Set(e.syms)].sort().join(",");
    const a = pos[e.from], b = pos[e.to];
    if (e.from === e.to) {
      let ux = a.x - cx, uy = a.y - cy; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; if (l === 1 && ux === 0 && uy === 0) uy = -1;
      const deg = Math.atan2(ux, -uy) * 180 / Math.PI;
      s += `<path class="edge" marker-end="url(#ah)" transform="rotate(${deg} ${a.x} ${a.y})" d="M${a.x - 10},${a.y - R + 3} C${a.x - 34},${a.y - R - 46} ${a.x + 34},${a.y - R - 46} ${a.x + 10},${a.y - R + 3}"/>`;
      s += `<text class="elabel" x="${a.x + ux * (R + 50)}" y="${a.y + uy * (R + 50) + 4}" text-anchor="middle">${label}</text>`;
      return;
    }
    const rev = groups[e.to + ">" + e.from] ? 1 : 0;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const off = rev ? 38 : 0, c = { x: mx + (-dy / d) * off, y: my + (dx / d) * off };
    const u1 = Math.hypot(c.x - a.x, c.y - a.y) || 1, u2 = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const p1 = { x: a.x + (c.x - a.x) / u1 * R, y: a.y + (c.y - a.y) / u1 * R }, p2 = { x: b.x + (c.x - b.x) / u2 * (R + 2), y: b.y + (c.y - b.y) / u2 * (R + 2) };
    s += `<path class="edge" marker-end="url(#ah)" d="M${p1.x},${p1.y} Q${c.x},${c.y} ${p2.x},${p2.y}"/>`;
    const lx = 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x, ly = 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y;
    const sgn = rev ? 1 : 0, nx = -dy / d, ny = dx / d;
    s += `<text class="elabel" x="${lx + nx * (rev ? 12 : -10 )}" y="${ly + ny * (rev ? 12 : -10) + 4}" text-anchor="middle">${label}</text>`;
  });
  nfa.states.forEach(q => {
    const p = pos[q], fin = nfa.finals.includes(q);
    s += `<circle class="state${q === nfa.start ? " start" : ""}" cx="${p.x}" cy="${p.y}" r="${R}"/>`;
    if (fin) s += `<circle class="final" cx="${p.x}" cy="${p.y}" r="${R - 5}"/>`;
    s += `<text class="slabel" x="${p.x}" y="${p.y + 5}" text-anchor="middle">${q}</text>`;
  });
  const sp = pos[nfa.start]; let ux = sp.x - cx, uy = sp.y - cy; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  const ang = Math.atan2(uy, ux) + 1.0, ex = Math.cos(ang), ey = Math.sin(ang);
  s += `<line class="edge" marker-end="url(#ah)" x1="${sp.x + ex * (R + 42)}" y1="${sp.y + ey * (R + 42)}" x2="${sp.x + ex * (R + 2)}" y2="${sp.y + ey * (R + 2)}"/><text class="elabel" x="${sp.x + ex * (R + 56)}" y="${sp.y + ey * (R + 56) + 4}" text-anchor="middle">start</text>`;
  return s + "</svg>";
}

/* ---------- 6. UI ---------- */
function $(id) { return document.getElementById(id); }
function esc(t) { return String(t).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
const chip = t => `<span class="pill">${esc(t)}</span>`;
let CURRENT = null, LAST = "";

function setChips(g) {
  $("ntChips").innerHTML = g && g.ok ? g.order.map(chip).join("") : "—";
  $("tmChips").innerHTML = g && g.ok ? (g.terminals.map(chip).join("") || "none") : "—";
  $("stChips").innerHTML = g && g.ok ? chip(g.start) : "—";
}
function hideResults() { CURRENT = null; $("sec2").hidden = true; $("sec3").hidden = true; $("result").innerHTML = ""; }

function generate() {
  const text = $("grammar").value; LAST = text;
  const g = parseGrammar(text); setChips(g);
  const box = $("validation");
  if (!g.ok) {
    hideResults(); box.className = "status bad"; box.hidden = false;
    box.innerHTML = `<div class="stitle">✗ INVALID GRAMMAR</div><ul>${g.errors.map(e => `<li>${esc(e)}</li>`).join("")}</ul>`;
    return false;
  }
  const nfa = buildNFA(g); CURRENT = nfa;
  box.className = "status good"; box.hidden = false;
  box.innerHTML = `<div class="stitle">✓ VALID RIGHT-LINEAR GRAMMAR</div><p>Every production has the form A → aB, A → a or A → ε, and every non-terminal used is defined.</p>` + (g.warnings.length ? `<ul>${g.warnings.map(w => `<li>Note: ${esc(w)}</li>`).join("")}</ul>` : "");
  $("sec2").hidden = false; $("sec3").hidden = false;
  const F = nfa.finals.join(", ");
  $("cards").innerHTML = [["States (Q)", "{ " + nfa.states.join(", ") + " }"], ["Alphabet (Σ)", "{ " + nfa.alphabet.join(", ") + " }"], ["Start state", nfa.start], ["Final state(s)", "{ " + F + " }"]].map(c => `<div class="mini"><span>${c[0]}</span><b>${esc(c[1])}</b></div>`).join("");
  const conv = [];
  conv.push(nfa.usesFinal ? `Final state <b>${nfa.finalName}</b> was added for the terminal-only productions (A → a).` : "No terminal-only production, so no extra final state was needed.");
  if (nfa.epsFinals.length) conv.push(`ε-production(s): <b>${nfa.epsFinals.join(", ")}</b> marked as final (no ε-transition is created).`);
  conv.push(nfa.nondet ? "This machine is a <b>non-deterministic</b> finite automaton (NFA): some state has several moves on the same symbol." : "Generated machine is an <b>NFA</b> (here each state happens to have at most one move per symbol, which is allowed for an NFA).");
  $("convNote").innerHTML = conv.map(c => `<li>${c}</li>`).join("");
  let rows = nfa.transitions.map(t => `<tr><td><b>${t.from}</b>${t.from === nfa.start ? ' <span class="tag">start</span>' : ""}</td><td class="mono">${esc(t.sym)}</td><td><b>${t.to}</b>${nfa.finals.includes(t.to) ? ' <span class="tag f">final</span>' : ""}</td><td class="mono">${esc(t.prod)}</td><td>${esc(t.type)}</td></tr>`).join("");
  nfa.epsFinals.forEach(A => rows += `<tr class="eps"><td><b>${A}</b></td><td class="mono">ε</td><td>—</td><td class="mono">${A} → ε</td><td>${A} is a final state (no transition)</td></tr>`);
  $("ttable").innerHTML = `<thead><tr><th>Current State</th><th>Input</th><th>Next State</th><th>Production</th><th>Explanation</th></tr></thead><tbody>${rows}</tbody>`;
  let m = `<thead><tr><th>δ</th>${nfa.alphabet.map(a => `<th>${esc(a)}</th>`).join("")}</tr></thead><tbody>`;
  nfa.states.forEach(q => { m += `<tr><td><b>${q === nfa.start ? "→" : ""}${nfa.finals.includes(q) ? "*" : ""}${q}</b></td>` + nfa.alphabet.map(a => { const v = nfa.delta[q + "|" + a]; return `<td class="mono">${v ? "{ " + [...v].join(", ") + " }" : "∅"}</td>`; }).join("") + "</tr>"; });
  $("matrix").innerHTML = m + "</tbody>";
  $("diagram").innerHTML = drawNFA(nfa);
  $("result").innerHTML = "";
  return true;
}

function check() {
  if (!CURRENT) { $("result").innerHTML = `<div class="status bad"><div class="stitle">✗ Enter a valid grammar first</div></div>`; return; }
  const r = simulate(CURRENT, $("teststr").value);
  if (r.error) { $("result").innerHTML = `<div class="status bad"><div class="stitle">✗ INVALID STRING</div><p>${esc(r.error)}</p></div>`; return; }
  const body = r.steps.slice(1).map((s, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(s.read)}</td><td class="mono">${s.moves.length ? s.moves.map(esc).join("<br>") : "no transition"}</td><td class="mono">${s.states.length ? "{ " + s.states.join(", ") + " }" : "∅"}</td></tr>`).join("");
  $("result").innerHTML = `<div class="verdict ${r.accepted ? "acc" : "rej"}"><span>${r.accepted ? "✓" : "✗"}</span> ${r.accepted ? "ACCEPTED" : "REJECTED"}</div>
   <p class="why"><b>Input:</b> <code>${r.str === "" ? "ε (empty string)" : esc(r.str)}</code><br>${esc(r.why)}</p>
   <p class="small">Start: active set = { ${r.steps[0].states.join(", ")} }</p>
   ${body ? `<div class="tablewrap"><table><thead><tr><th>Step</th><th>Read</th><th>Transitions (trace)</th><th>Active states</th></tr></thead><tbody>${body}</tbody></table></div>` : ""}
   <p class="small"><b>Result:</b> ${r.accepted ? "ACCEPTED" : "REJECTED"} — a string is accepted if some active state is final.</p>`;
}

function runTest(i) {
  const t = TESTS[i]; $("grammar").value = t.g; $("teststr").value = t.str;
  const ok = generate(); if (ok) check();
  const actual = evaluate(t.g, t.str), pass = actual === t.expect;
  $("testBanner").hidden = false; $("testBanner").className = "banner " + (pass ? "pass" : "fail");
  $("testBanner").innerHTML = `<b>${t.id}</b> — ${esc(t.what)}<br>Expected: <b>${t.expect}</b> · Actual: <b>${actual}</b> · ${pass ? "✓ PASS" : "✗ FAIL"}`;
  document.querySelectorAll(".tbtn").forEach((b, k) => b.classList.toggle("on", k === i));
  $(ok ? "sec1" : "sec1").scrollIntoView({ behavior: "smooth" });
}
function runAll() {
  const res = TESTS.map(t => evaluate(t.g, t.str) === t.expect), n = res.filter(Boolean).length;
  $("testBanner").hidden = false; $("testBanner").className = "banner " + (n === TESTS.length ? "pass" : "fail");
  $("testBanner").innerHTML = `<b>All verification tests:</b> ${n} / ${TESTS.length} passed ${n === TESTS.length ? "✓" : "✗"}`;
}

function init() {
  $("testBtns").innerHTML = TESTS.map((t, i) => `<button class="tbtn${t.bad ? " bad" : ""}" data-i="${i}"><b>${t.id}:</b> ${esc(t.label)}</button>`).join("");
  $("testBtns").addEventListener("click", e => { const b = e.target.closest(".tbtn"); if (b) runTest(+b.dataset.i); });
  $("btnAll").onclick = runAll;
  $("btnGen").onclick = () => { generate(); };
  $("btnEx").onclick = () => { $("grammar").value = G1; $("teststr").value = "aab"; generate(); };
  $("btnClear").onclick = () => { $("grammar").value = ""; $("teststr").value = ""; $("validation").hidden = true; $("testBanner").hidden = true; setChips(null); hideResults(); };
  $("btnReset").onclick = () => { $("testBanner").hidden = true; $("grammar").value = LAST || G1; generate(); };
  $("btnTest").onclick = check;
  $("teststr").addEventListener("keydown", e => { if (e.key === "Enter") check(); });
  $("grammar").addEventListener("input", () => { $("testBanner").hidden = true; });
  $("grammar").value = G1; $("teststr").value = "aab"; generate();
}
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
if (typeof module !== "undefined") module.exports = { parseGrammar, buildNFA, simulate, drawNFA, evaluate, TESTS, G1 };
