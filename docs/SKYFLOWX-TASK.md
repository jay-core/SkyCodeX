# SkyFlowX — analysis specification (task file)

**Status:** specification only. Nothing here is implemented until the user says "Skyflow execute!". We are in the discovery phase: new designs beyond the industry standards are welcome, each proven by a theorem or by measurement before it is adopted.
**Scope:** an analogue of every component of LDRA's tool suite, built only from published methods and standards. Component names follow LDRA's public product literature (Testbed, TBvision, TBrun, TBextreme, TBmanager, LDRArules, LDRAcover, LDRAunit). They are used only to map coverage and never appear in our product. LDRA's internals aren't public, so everything below is our own design.
**Sources:**
- the published papers named in each section
- MISRA C/C++ and DO-178C (the user's licensed copies, read locally, never copied into the repo)
- ISO 26262-8 (if the user has it)
- the free downloads: CERT, CWE, AUTOSAR C++14, JSF AV

Related: [ROADMAP.md](ROADMAP.md), the SkyFlowX section.

---

## 0. Certainty labels used throughout

| Label | Meaning | Promise |
|---|---|---|
| **E: exact** | The answer follows from a definition or a decidable property | No misses and no false alarms, given correct build flags |
| **S: sound** | An over-approximation of an undecidable property | No misses within the stated scope; it may raise false alarms; every finding is labelled *proven*, *possible* or *can't tell* |
| **B: best effort** | A search or heuristic, such as test generation | Reports what it found and what it didn't; never claims completeness |
| **P→E: fingerprint, then confirmed** | A hash or fingerprint used as a shortcut | Every hit is confirmed by exact comparison, so the result is exact |

**No silent passes:** a check that times out, hits a limit or meets an unsupported construct reports *can't tell*, with the reason. It is never silently treated as passing.

---

## 1. Definitions

### 1.1 Flow
- **Control flow:** the directed graph G = (N, E) of a function. N holds the basic blocks plus a unique *entry* and *exit* node; E holds the possible transfers between them.
- **Call flow:** the call graph, plus call/return edges joining the function graphs into one *supergraph*.
- **Data flow:** how values move. Definitions reach uses along control-flow paths.
- **Resource flow:** paired operations (lock/unlock, malloc/free, open/close, interrupt disable/enable) along paths.

### 1.2 Flow integrity
A function's graph has flow integrity when all of these invariants hold. Each is checked in linear or near-linear time.

| # | Invariant | Formal statement | Check |
|---|---|---|---|
| I1 | Reachability | Every node is reachable from *entry* | DFS from entry, O(N+E); the unreached nodes are unreachable code |
| I2 | Co-reachability | Every node reaches *exit* or a declared no-return call | Reverse DFS from exit; the rest are endless loops or traps (fine if intended, e.g. `for(;;)` in a scheduler) |
| I3 | Conservation | For execution counts x on edges, inflow equals outflow at every inner node: B·x = 0 once an exit→entry edge is added (B is the incidence matrix) | Coverage self-check, §4.4 |
| I4 | Consistent resource state | Every path into a node carries the same resource balance (a "potential" exists) | Coboundary check, §4.3 |
| I5 | Structured (reducible) | Every retreating edge points to a dominator of its source | Dominator tree plus DFS, near-linear |
| I6 | Single entry | Only *entry* has no predecessors; there are no jumps into the middle of loops | Comes with I5 |
| I7 | Matched calls | Across functions, every return goes back to its own call site; paths are well-bracketed (a Dyck language) | CFL-reachability / IFDS, §3 M9 |
| I8 | Ordered nesting | Nested resources are released in reverse order | Group-valued potential, §4.3 |

A **flow break** is a concrete violation of one of I1–I8, reported with the smallest piece of evidence: the edge, the fundamental cycle or the path.

### 1.3 Continuity
Code passes through several representations: source → preprocessed → AST → CFG → SSA → summaries → instrumented code → object code. **Continuity** means no flow is lost or invented between two consecutive representations.

Formally:
- Give each graph its **reachability topology**: the open sets are the upward-closed sets of the reachability preorder (the Alexandrov topology).
- A map h from representation A to representation B is **continuous** exactly when it preserves reachability: u ⇝ v in A implies h(u) ⇝ h(v) in B.

We require three conditions, each checked edge by edge in linear time:

| # | Condition | Meaning |
|---|---|---|
| C1 | **Graph map** | Each edge goes to an edge or collapses to one node (a simplicial map of 1-complexes); this gives continuity |
| C2 | **Onto** | Every node and edge of B has a preimage: no invented flow |
| C3 | **Path lifting** | Every path in B lifts to a path in A, so flows seen later existed earlier |
| C4 | **Subdivision** for instrumentation | The instrumented CFG must be a subdivision of the original (probes only split edges), i.e. homeomorphic to it. Check: smooth out the probe nodes, which have degree 2 and are labelled, then compare the graphs node by node |

**A continuity break** is the edge where C1–C4 fails. It always means a bug in our own pipeline, so it is reported as an internal error, never as a finding about the user's code.

### 1.4 Finding states
- **Violation** (proven)
- **Possible**, with the path that might cause it
- **Can't tell**, with the reason
- **Deviation**: accepted by the user, with a recorded justification. MISRA's deviation process.
- **Pass**: proven absent. Only labels E and S can claim this.

---

## 2. Levels of trickling

Results trickle down through the levels: each level uses the results of the ones above. Changes trickle up: an edit invalidates only the levels and parts that depend on it, tracked with a dependency graph and content fingerprints (labelled P→E).

### 2.1 What each level does and when it runs

| Level | Name | Input → output | Typical checks | Runs |
|---|---|---|---|---|
| T0 | Lexical | Bytes → tokens and preprocessor events | Character sets, comments, literals, preprocessor rules, macro graph | On each keystroke, visible file |
| T1 | Syntax | Tokens → AST (clang) | Grammar-shaped rules: switch form, braces, declaration form | On each keystroke, visible file |
| T2 | Semantic, one file | AST plus types | Essential types, conversions, pointer casts, side-effect order inside expressions, banned library functions | Keystroke (debounced) or save |
| T3 | Inside each function | CFG, dominators, SSA | Metrics, unreachable code, data-flow anomalies, goto/structure rules, uninitialised reads (simple cases), resource potentials | On save |
| T4 | Across functions | Call graph, summaries | Recursion, unused results, global side effects, information flow, interprocedural data flow | On save, in the background |
| T5 | Whole system | All files linked | Declarations agreeing across files, unique identifiers, unused across files, threads and interrupts, races, shared-data rules | Background |
| T6 | Deep semantics | Abstract interpretation | Null, bounds, overflow, division, invariant conditions, undecidable rules | Background, with a time budget, cached |
| T7 | Dynamic | Instrumented builds and runs | Statement, decision, MC/DC and LCSAJ coverage; unit tests on host or target | On demand |
| T8 | Compliance | All of the above plus requirements | Traceability, compliance matrices, reports, qualification evidence | On demand |

### 2.2 Benchmarks per level
These are targets to be measured on tinyhttp, ThreadX and an LLVM-sized project. 8 cores; 100 kLOC means 100,000 lines.

| Level | Speed target | Quality target |
|---|---|---|
| T0 | ≥ 20 MB/s per core; < 5 ms per edited file | E: 100% agreement on the known-answer tests |
| T1 | ≤ 1.2× clang `-fsyntax-only` | E: 100% |
| T2 | ≤ +20% on top of T1 | E for decidable rules: 100% |
| T3 | Median ≤ 1 ms per function, p99 ≤ 20 ms; memory O(N+E) | E for metrics and graph facts; S for anomalies on infeasible paths, which are labelled |
| T4 | 100 kLOC full run ≤ 10 s; ≤ 1 s after an edit | E for direct calls; S for indirect ones (candidate sets) |
| T5 | 100 kLOC ≤ 30 s | E for cross-file declarations and identifiers; S for races |
| T6 | ≤ 2 s per function, then *can't tell*; 100 kLOC first run ≤ 10 min, after an edit ≤ 30 s | S: no misses on the in-scope Juliet cases; precision measured and recorded per check |
| T7 | Build ≤ 1.5×; run time ≤ 1.3× with hit bits, ≤ 2× with counts; on-target memory 1 bit per probe | E: matches gcov/llvm-cov on statement and branch; MC/DC matches hand-worked tables |
| T8 | Report for 100 kLOC < 2 s | E |

**On every level:**
- **Determinism:** identical output on two runs, and with 1 thread versus N threads.
- **Metamorphic invariance:** renaming variables, reformatting, and reordering independent declarations leave every result unchanged, apart from names and positions in messages.

---

## 3. Mathematical toolkit (shared by all components)

Each entry gives the concept, its **binding property** (the theorem that makes it reliable), how it **speeds things up**, and where it is **used**.

**M1. Lattices and monotone frameworks** (Kildall 1973; Kam–Ullman 1977)
- **Concept:** data-flow facts form a lattice of finite height, and each statement's effect is a monotone function on it.
- **Binding:**
  - By Knaster–Tarski, a least fixpoint exists, and iteration reaches it.
  - When the functions distribute over join (bit-vector problems: reaching definitions, live variables, available expressions), the fixpoint equals the meet over all paths. The answer is exact over all paths without listing them.
- **Speed:** a worklist in reverse postorder converges in about d+2 passes, where d is the loop nesting depth.
- **Used in:** S5, S6, S7, R9, R2.

**M2. Boolean semiring algebra for gen/kill**
- **Concept:** in the semiring ({0,1}, ∨, ∧), each block's effect is f(x) = g ∨ (x ∧ ¬k).
- **Binding:**
  - Such functions are closed under composition: f₂∘f₁ = (g₂ ∨ (g₁∧¬k₂)) ∨ (x ∧ ¬k₁ ∧ ¬k₂). A whole region therefore summarises into one (g, k) pair.
  - Loop closure is idempotent: (id ∨ f)* = id ∨ f, so a loop is summarised in one step.
- **Speed:** 64 facts per machine word, and each region is summarised once (Tarjan's path expressions).
- **Used in:** S5, S4.

**M3. The algebraic path problem: matrices over semirings** (Tarjan 1981; Kleene algebra)
- **Concept:** one solver, different semirings:
  - Boolean (∨, ∧): reachability
  - (ℕ, +, ×): number of paths (NPATH)
  - (min, +) tropical: shortest path
  - (max, +): longest path, worst-case stack depth, longest call chain
- **Binding:** Kleene's theorem (closure A* = I ⊕ A ⊕ A² ⊕ … is well defined in closed semirings).
- **Speed:** compute once per strongly connected component, in topological order of the condensation; Boolean matrices are bit-packed.
- **Used in:** S3, S4, S6, S12 (stack usage).

**M4. Equivalence relations and quotients**
- **Concept:** partition the objects into classes and work on one representative per class.
- **Binding:** any property that is constant on each class factors uniquely through the quotient map.
- **Speed:**
  - **Strongly connected components:** the quotient of the call graph or CFG by mutual reachability is a DAG (Tarjan, linear time).
  - **Union-find:** near-linear, α(n). Used for Steensgaard points-to analysis and type unification across files.
  - **Identifier prefixes:** names that agree on their significant prefix form classes. Bucketing finds clashes in O(n) rather than O(n²) (R5).
  - **Congruence closure** (Downey–Sethi–Tarjan): equal expressions get one value number (R13, redundant checks).
- **Used in:** S2, S4, S7, S11, R5, R8.

**M5. Homomorphisms**
- **Concept:** a structure-preserving map: abstraction, summaries, and folds over trees.
- **Binding:**
  - An expression tree is a term in an initial algebra, so every attribute defined by a fold is **unique and well defined** (the initial-algebra property). MISRA's essential type of an expression is such a fold (R10).
  - Any monoid homomorphism from paths (the free monoid of edges) into a group is fixed by its values on edges. This is the basis of §4.3.
- **Speed:** one bottom-up pass per tree; summaries compose without reanalysing the function.
- **Used in:** S2, S5, S6, S9.

**M6. Isomorphism and canonical forms**
- **Concept:** structurally identical code (template instances, repeated macro expansions, duplicated functions) is analysed once.
- **Binding:**
  - Rooted, labelled trees have canonical forms computable in linear time (the AHU algorithm). Two ASTs are isomorphic exactly when their canonical forms are equal.
  - Results transfer **only for properties invariant under the isomorphism**. A result that depends on names, positions or the surrounding context is never transferred.
- **Speed:** canonical hash (P), then exact confirmation (→E), then reuse. Large template-heavy C++ code shrinks considerably.
- **Used in:** S2, S3, S7.

**M7. Galois connections and abstract interpretation** (Cousot and Cousot 1977)
- **Concept:** concrete sets of states C and abstract values A, linked by α: 𝒫(C) → A and γ: A → 𝒫(C) with α(X) ⊑ a ⟺ X ⊆ γ(a).
- **Binding:** if each abstract step over-approximates the concrete one (F#(a) ⊒ α(F(γ(a)))), every fixpoint result is **sound**.
- **Widening (∇):** guarantees termination on loops. Narrowing then recovers precision.
- **Domains:**
  - intervals
  - congruences a ≡ b (mod m) (Granger 1989): alignment and stride
  - octagons ±x ± y ≤ c (Miné 2006)
  - a reduced product of several domains
- **Speed:** octagons are stored as a difference-bound matrix (2n×2n); closure is Floyd–Warshall over (min, +) in O(n³) on packs of related variables only.
- **Used in:** S7, R9, R12, R14, R18, R1 (undefined behaviour).

**M8. Fields and vector spaces**
- **GF(2), the cycle space:** a graph's cycles form a vector space over GF(2) of dimension E − N + c. Fundamental cycles from a spanning tree form a **basis**. This is McCabe's basis-path idea (§4.1, S3).
- **GF(2), MC/DC:**
  - **The Boolean derivative:** ∂f/∂xᵢ(x) = f(x|xᵢ=0) ⊕ f(x|xᵢ=1). Condition i has a unique-cause independence pair at x exactly when ∂f/∂xᵢ(x) = 1 (S9).
  - **The algebraic normal form** (a polynomial over GF(2)) gives these derivatives symbolically.
- **ℚ, affine relations** (Karr 1976): linear equalities between variables, such as i = 2·j + 1. They are found exactly for affine code, using the affine hull as the join (S7).
- **GF(q), covering arrays:**
  - **Construction:** orthogonal arrays OA(q², q+1, q, 2) built over a finite field (Bose). They give pairwise test designs for up to q+1 parameters with q values each in **q² tests instead of q^(q+1)** (S11).
  - **Binding:** the field axioms guarantee that every pair of values appears exactly once.
- **ℤ/2ⁿℤ, machine arithmetic:** unsigned C arithmetic is the ring ℤ/2ⁿℤ, so wrap-around is exact. A signed overflow is an interval leaving [−2ⁿ⁻¹, 2ⁿ⁻¹−1] (S7, R12).
- **GF(2)[x], Rabin fingerprints:** cache keys and change detection (P→E) for trickle invalidation.

**M9. Context-free reachability, Dyck languages** (Reps, Horwitz and Sagiv 1995, IFDS; Reps 1998)
- **Concept:** a valid interprocedural path has calls and returns matched like brackets.
- **Binding:**
  - IFDS answers distributive problems over finite sets **exactly** over all valid paths, in O(E·D³) time (D is the size of the fact domain).
  - Function summaries are Boolean D×D relation matrices, and composing them is matrix multiplication (M3).
- **Used in:** S4, S5, S6, R17, R22.

**M10. Partial orders**
- **Concept:** C's sequencing rules (sequenced-before) and threads (happens-before) are partial orders.
- **Binding:** two accesses conflict when they touch the same object, at least one writes, and they are **unordered**. They then form an antichain pair in the order.
- **Speed:** one algorithm finds unsequenced side effects inside an expression (R13) and races between threads and interrupts (S12). Locksets are intersected as a meet in the lattice of lock sets (Eraser, Savage et al. 1997).
- **Used in:** R13, S12, R22.

**M11. Dominance and dependence** (Lengauer–Tarjan; Cytron et al. 1991; Ferrante, Ottenstein and Warren 1987)
- **Concept:** the dominator and post-dominator trees, dominance frontiers, SSA form, control dependence, and the program dependence graph.
- **Binding:** every path from entry to a node v passes through each dominator of v. This is exact.
- **Speed:** SSA makes data flow sparse (each use gets its one definition directly), so the work is about O(uses) rather than O(N·facts). Slicing becomes reachability on the dependence graph.
- **Used in:** S4, S5, S6, S9 (probe reduction), the visuals for a value's journey.

**M12. Graph reduction** (Hecht and Ullman 1974; McCabe 1976)
- **Concept:** the T1/T2 transformations collapse structured regions.
- **Binding:**
  - A graph is reducible exactly when T1/T2 collapse it to a single node.
  - Essential complexity is the cyclomatic number of what remains, and it equals 1 exactly when the function is structured.
- **Used in:** S3, R15.

**M13. Interval crossings, for knots** (Woodward, Hennell and Hedley 1979)
- **Concept:** every jump is an interval [min(a,b), max(a,b)] over line numbers. Two jumps form a knot when their intervals partly overlap.
- **Speed:** a sweep with a Fenwick tree counts the knots in O(J log J) instead of O(J²).
- **Used in:** S3.

**M14. Binary decision diagrams (ROBDD)** (Bryant 1986)
- **Concept:** a decision with a fixed condition order (C's short-circuit order) has one canonical reduced diagram.
- **Binding:** two decisions are equivalent exactly when their diagrams are identical (canonicity). Paths through the diagram are exactly the short-circuit evaluations.
- **Speed:** MC/DC independence pairs are read off the diagram. Decisions with the same canonical diagram share one analysis, up to renaming their conditions (M6).
- **Used in:** S9, R14.

**M15. Cohomology of graphs** (§4.3)
- **Concept:** edge labels in a group form a 1-cochain. If it is a coboundary, a consistent "state at each node" exists. If not, the obstruction is non-zero on some fundamental cycle, and that cycle **locates the break**.
- **Used in:** S5, S12, R22, I4, I8.

**M16. Set cover and covering matrices**
- **Concept:** test × goal matrices, where goals are branches, MC/DC pairs or requirements.
- **Binding:** finding the minimum covering set is NP-hard. The greedy method is within ln n of optimal and is labelled B; gaps found are exact (E).
- **Used in:** S10, S11, S13.

---

## 4. A topological model of flow and finding where it breaks

### 4.1 The building blocks
- **The complex:** a function's CFG, with one extra edge exit→entry, is a 1-dimensional cell complex. Nodes are 0-cells and edges are 1-cells.
- **Incidence matrix B** (N × E, entries in {−1, 0, +1}): this is the boundary map ∂₁ from edges to nodes.
- **H₀**, the connected components, gives c. In the directed sense, nodes not reached from entry are I1 breaks.
- **H₁** (= ker ∂₁) is the cycle space, of dimension β₁ = E − N + c (the first Betti number).
- **Cyclomatic complexity:** V(G) = E − N + 2P = β₁ of the graph with the extra edge. So **V(G) is a topological invariant**, and McCabe's basis paths are a basis of H₁.
- **Self-check:** compute V(G) twice, from the Euler characteristic (χ = N − E) and as decisions + 1. Any disagreement is a continuity error.

### 4.2 A basis gives the remaining cases
- **Basis:** a spanning tree T gives E − N + 1 fundamental cycles. Each is one non-tree edge closed by its tree path, and together they are a basis of H₁.
- **Linear combinations:** the edge vector of every entry→exit path is an integer combination of the basis paths. Measuring the basis therefore determines every other path's *counts*, using I3.
- **Limit (stated honestly):** a combination of feasible paths need not itself be feasible. The basis drives probe placement and test planning. It does **not** prove semantic coverage on its own.

### 4.3 Consistency of state: the coboundary check (I4, I8)
> **Superseded (2026-10-31)** by [discoveryAndConnection.md](discoveryAndConnection.md) D2.1–D2.2. The labels must form **monoids** (bicyclic / polycyclic), not groups. A group cancels "release then acquire" and would hide that bug. The spanning-tree check holds for any monoid (proof in D2.2).

- **Labels:** each edge e gets a label w(e) in a group 𝔾:
  - in ℤʳ: +1 for acquire and −1 for release, per resource kind
  - in the free group on the resources, when order matters (I8)
- **The theorem:** if every node is reachable from entry, the following are equivalent:
  - every entry→v path gives the same product;
  - there is a potential φ with w(u,v) = φ(u)⁻¹φ(v) (in the abelian case, w = δφ);
  - w is trivial on every fundamental cycle.
- **The algorithm**, O(E):
  1. Build a spanning tree from entry and set φ along it.
  2. For each non-tree edge (u,v), test w(u,v) = φ(u)⁻¹φ(v).
  3. A failing edge identifies its fundamental cycle. **That cycle is where the flow breaks**, for example a loop that locks without unlocking, or a branch that frees on one side only.
  4. Also require φ(exit) = identity (everything released) and the prefix condition (no release before acquire: φ stays a positive word).
- **Across functions:** each function summarises to the group element of entry→exit. Composition along call edges is multiplication (M5, M9).

### 4.4 Conservation and probe reduction (I3, S9)
- **Counts** (Knuth and Stevenson 1973; Ball and Larus 1994):
  - Place counters only on the edges *outside* a maximum-weight spanning tree: E − N + 1 counters per function.
  - The other counts follow **exactly** by solving B·x = 0 along the tree.
- **Hit bits** (Agrawal 1994):
  - OR is not linear, so for bits use dominators instead: if v ran, every dominator of v ran.
  - Probes go only on the leaves of the dominator-based super-block graph.
  - Post-dominators are **not** used, because a run can stop early (a reset, an exception or a debugger halt). Using them would claim coverage that never happened.
- **Guardrail:** if measured counts break B·x = 0 for a completed function, the instrumentation or the run is faulty. Report it, never hide it.

### 4.5 Continuity between representations (C1–C4)
Each change of representation has its own continuity check:

| Step | Check |
|---|---|
| Source → preprocessed | Line maps and macro expansion records (clang) must be onto and keep order |
| AST → CFG | A graph map with path lifting, against clang's own CFG as a second opinion |
| CFG → SSA | Same graph; the φ placement must equal the dominance frontiers |
| CFG → instrumented | A subdivision (C4) |
| Source → object | The DWARF line table must be a graph map onto the object-code flow, for object-code coverage. Gaps are listed as optimised away, never as uncovered |

---

## 5. Matrices, bases of categories and fewer computations

### 5.1 Rule checking through a feature basis
- **Features:**
  - Each AST node gets a feature vector φ(n) ∈ {0,1}ᵏ over k primitive predicates. Examples: node kind, essential type category, has side effect, is constant, is lvalue, in macro, signedness, pointer depth.
  - The node × feature matrix is F, of size |nodes| × k.
- **Rules:** each rule's *candidate test* is a Boolean formula gᵣ over the features, so rule r = gᵣ ∘ φ.
- **Binding:** any function that is constant on the classes of φ factors through φ (§3 M4).
  - **First saving:** nodes with identical vectors are equivalent for every candidate test, so each test runs once per distinct vector, not once per node.
  - **Second saving:** each feature is computed once, giving O(nodes × k + classes × rules) instead of O(nodes × rules × cost).
- **The basis:** choose a minimal set of features from which every rule's candidate test can be written (an irredundant generating set). New rules usually need no new features.
- **The second stage stays exact:** candidates still go through the rule's full check. The feature stage only filters, and it is proven to keep every true violation.

### 5.2 Subsumption between rules
- **Order:** violation sets are ordered by inclusion, which forms a lattice.
- **Use:** if rule A's violations are always among rule B's, B's candidate set prefilters A's checks.
- **Every rule is still reported separately,** because MISRA requires each one.

### 5.3 Coverage and traceability matrices
- **The matrices:**
  - C, tests × goals (branches, MC/DC pairs, statements)
  - R, requirements × code
  - T, tests × requirements
- **Each answer is a product or a zero line:**

| Question | Computed as |
|---|---|
| Untested requirements | Zero rows of T |
| Dead code | Zero columns of R |
| Requirements that are verified | Boolean product Rᵀ·Cᵀ checked against T |
| Tests to rerun after a change | Changed goals Δ multiplied by C, plus tests that touch the changed globals (via the call-graph closure, M3) |

### 5.4 One solver, many semirings
Reachability, path counts, shortest and longest paths, and summary composition share one closure engine (M3). A single, well-tested implementation serves S3, S4, S6, S12 and S13.

---

## 6. Components, each dissected

Each component lists: its LDRA analogue · subcomponents · relations to other components · checks · guardrails · flow · mathematics · trickle levels · certainty.

### S1. Front end (Testbed's parser)
- **Subcomponents:**
  - S1.1 compile database reader (flags per file, compiler identity)
  - S1.2 clang driver configured to the target compiler (gcc, IAR, Keil, GHS, MSVC dialects and built-ins)
  - S1.3 preprocessor event log: macro definitions and expansions, includes, conditional regions
  - S1.4 AST with full types
  - S1.5 source map: spelling locations versus expansion locations
- **Relations:** feeds every other component. Its fingerprints drive trickle invalidation (§2).
- **Checks:** parse errors are shown as *can't analyse this file*, never as a pass.
- **Guardrails:**
  - a configuration fingerprint (flags, defines, compiler and clang version) is stamped into every report
  - a warning when a file has no compile entry
  - the clang version is fixed per release
- **Mathematics:** M6 canonical forms for repeated macro and template code; Rabin fingerprints (M8).
- **Levels:** T0–T1. **Certainty:** E, given correct flags.

### S2. Rule checker (LDRArules; Testbed main static analysis)
- **Subcomponents:**
  - S2.1 rule catalogue, holding for each rule: id, standard, category (mandatory / required / advisory), decidability, scope (one file / system), our own wording, links to the specification and tests
  - S2.2 feature extractor (§5.1)
  - S2.3 checks per level (T0–T6)
  - S2.4 deviation manager: records, justifications, approvals
  - S2.5 cross-standard map (MISRA ↔ CERT ↔ CWE ↔ AUTOSAR), so one check can serve several rules
- **Relations:**
  - uses S1, S3 (some rules use metrics), S4/S5 (flow rules), S7 (undecidable rules) and S12 (concurrency rules)
  - feeds S14 and S13
- **Checks:** see §7.
- **Guardrails:**
  - every rule has a written specification and at least one compliant and one non-compliant test
  - an undecidable rule never reports *pass* unless it was proven
  - a deviation needs a reason and is shown in every report
- **Mathematics:**
  - M4 equivalence classes, for the identifier rules
  - M5 folds, for essential types
  - M10 partial orders, for side effects
  - M14 BDDs, for invariant conditions
  - §5 the feature basis
- **Levels:** T0–T6. **Certainty:** E for decidable rules; S for undecidable ones.

### S3. Metrics (Testbed quality reports)
- **Subcomponents:**

| # | Metric | How it's computed |
|---|---|---|
| S3.1 | Cyclomatic complexity V(G) | Computed two ways (§4.1) |
| S3.2 | Essential complexity ev(G) | M12 |
| S3.3 | Knots | M13 |
| S3.4 | Halstead | n₁, n₂, N₁, N₂; vocabulary n = n₁+n₂; length N; volume V = N·log₂n; difficulty D = (n₁/2)(N₂/n₂); effort E = D·V |
| S3.5 | Nesting depth | Loop nesting forest |
| S3.6 | NPATH | M3 over (ℕ, +, ×) |
| S3.7 | Size | Lines, statements, comment density |
| S3.8 | LCSAJ count | S9.4 |
| S3.9 | Fan-in and fan-out | Call graph degrees |
| S3.10 | Thresholds and quality model | Configurable limits per project |

- **Relations:** S1 and S4; S3.8 is shared with S9.
- **Guardrails:** counting rules vary between tools (Halstead operators, how `&&`/`||` count towards V(G), `switch` cases). Each convention is written down, can be switched, and is stated in the report.
- **Mathematics:** Betti numbers, Euler characteristic, interval crossings, semiring path counts.
- **Levels:** T3. **Certainty:** E.

### S4. Control-flow and call graphs (Testbed graphs; TBvision)
- **Subcomponents:**
  - S4.1 CFG per function, cross-checked against clang's CFG
  - S4.2 dominator and post-dominator trees
  - S4.3 loop nesting forest and reducibility
  - S4.4 call graph
  - S4.5 indirect-call candidates (the address-taken set, plus Steensgaard and then Andersen points-to)
  - S4.6 entry points: `main`, threads, interrupt handlers, callbacks
  - S4.7 supergraph
- **Relations:** used by S3, S5, S6, S7, S9, S12 and S14. **This replaces the flow facts of today's TypeScript engine** (see the roadmap).
- **Checks:**
  - I1, I2, I5, I6
  - recursion: a non-trivial SCC or a self-loop (R17)
  - unreachable functions from the entry points (R2)
- **Guardrails:** candidates for indirect calls are always labelled as candidates, never as definite calls.
- **Mathematics:** M4 (SCC quotients), M11, M12, M3 (closure).
- **Trickling:** Steensgaard runs at T4 for speed (near-linear), and Andersen at T5 for precision (cubic, on demand). The coarse result is always replaced by the fine one, never mixed with it.
- **Levels:** T3–T5. **Certainty:** E for direct calls; S for indirect ones.

### S5. Data flow (Testbed data-flow analysis)
- **Subcomponents:**
  - S5.1 reaching definitions and def-use chains
  - S5.2 liveness
  - S5.3 anomalies (Fosdick and Osterweil 1976):
    - **UR:** used before defined
    - **DU:** defined, then never used
    - **DD:** defined twice without a use
  - S5.4 globals and parameters across functions (summaries)
  - S5.5 resource potentials (§4.3)
  - S5.6 SSA
- **Relations:**
  - uses S4
  - feeds S6, S7, S2 (R2, R9, R17, R22) and S14 (a value's journey)
- **Checks:** anomalies, unused values, inconsistent resource state.
- **Guardrails:**
  - an anomaly found only on a path that may be infeasible is labelled *possible*
  - pointer aliasing comes from S4.5, and each finding says which aliasing level was used
- **Mathematics:** M1 (the exact meet over all paths for these distributive problems), M2, M9, M11, M15.
- **Levels:** T3–T4. **Certainty:** E on graph paths; S on feasible paths.

### S6. Information flow (dependence analysis)
- **Subcomponents:**
  - S6.1 dependency relation per function (outputs × inputs), from Bergeretti and Carré (1985)
  - S6.2 implicit flows through control dependence
  - S6.3 composition across calls
  - S6.4 slicing (Weiser; HRB system dependence graphs)
- **Relations:** S5 and S4 → S14 (a value's journey), S12, S13 (impact of a change).
- **Mathematics:**
  - a statement's dependency is a Boolean matrix
  - sequential composition is a matrix product: D(s₁;s₂) = D(s₂)·D(s₁) over (∨, ∧)
  - loops use the closure (M3)
  - functions are summarised once (M9)
- **Checks:** an output depends on an unexpected input; a declared dependency is missing; inputs that are never used.
- **Levels:** T4. **Certainty:** S (conservative: it never misses a dependency).

### S7. Deep semantics (abstract interpretation)
- **Subcomponents:**
  - S7.1 domains: intervals, congruences, octagons, Karr's affine relations, pointer nullness, a reduced product
  - S7.2 memory model: object sizes, pointer offsets
  - S7.3 checks: null use, bounds, overflow and wrap, division by zero, shifts out of range, invariant conditions, uninitialised reads
  - S7.4 time and space budgets
- **Relations:** uses S4, S5 and S6; serves the undecidable rules of S2 (R1.3, R2.2, R9.1, R14.3, R18.x and others) and CWE.
- **Guardrails:**
  - when a budget runs out, the result is *can't tell* with a reason
  - two modes: **safe** (no misses in scope; used for certification) and **precise** (fewer alarms; labelled as not sound)
- **Mathematics:** M7, M8 (ℤ/2ⁿℤ, ℚ), M3 (min-plus closure for octagons), M5 (function summaries).
- **Levels:** T6. **Certainty:** S.

### S8. Cross-reference
- **Subcomponents:** symbols, uses, definitions, the include graph, the macro-use graph.
- **Relations:** clangd's index plus S1; serves S2 (R5, R8), S13 and the UI.
- **Levels:** T2–T5. **Certainty:** E.

### S9. Coverage (LDRAcover; Testbed dynamic analysis)
- **Subcomponents:**

| # | Part | What it does |
|---|---|---|
| S9.1 | Statement coverage | Node hits |
| S9.2 | Decision / branch coverage | Out-edges of branch nodes |
| S9.3 | Condition, unique-cause MC/DC and masking MC/DC | M8 Boolean derivative, M14 BDDs |
| S9.4 | LCSAJ coverage | Woodward, Hennell and Hedley: triples (start, end, jump target); TER₁ (statements), TER₂ (branches), TER₃ (LCSAJs) |
| S9.5 | Instrumenter | Source rewriting with clang Rewriter, with probe reduction (§4.4) |
| S9.6 | Probe data | Format, upload and merge across runs |
| S9.7 | Object-code coverage | DWARF mapping (§4.5) |

- **Relations:** uses S1, S4 and S3.8 → S10, S11, S13, S14 (coverage shown as light).
- **Checks:** goals not covered; MC/DC pairs that cannot be met (coupled conditions are reported, and masking MC/DC is offered).
- **Guardrails:**
  - C4 subdivision check on every instrumented function
  - conservation check on the counts
  - only dominator-based inference for bits
  - instrumentation never changes the program's results; proven by running the test suite both ways
- **Mathematics:**
  - MC/DC needs at least n+1 tests for n conditions, and about 2n are enough in the worst case without coupled conditions; the exact set comes from the BDD
  - probe reduction: E − N + 1 counters
- **Levels:** T7. **Certainty:** E.

### S10. Target run-time library (C)
- **Subcomponents:**
  - S10.1 probe storage: one bit per probe, or counters
  - S10.2 safe recording for interrupts and multiple cores (atomic or interrupt-masked writes)
  - S10.3 output: UART, semihosting, a debugger memory dump, file
  - S10.4 a porting layer of about 4 functions
- **Relations:** S9.
- **Guardrails:**
  - no dynamic memory
  - a fixed footprint, reported at build time
  - integrity of probe data: a header with a checksum and the build fingerprint, so data is never merged into the wrong build
- **Levels:** T7. **Certainty:** E.

### S11. Unit testing (TBrun; LDRAunit)
- **Subcomponents:**
  - S11.1 harness generator (drivers from function signatures)
  - S11.2 stubs and isolation of dependencies
  - S11.3 test-case format: inputs, expected outputs, expected calls
  - S11.4 runs on host and on target (with S10)
  - S11.5 test design: equivalence classes (category-partition), boundary values, pairwise (covering arrays, M8 GF(q))
  - S11.6 regression selection (§5.3)
- **Relations:** S4 (what to stub), S6 (which inputs matter), S9 (coverage achieved), S13.
- **Guardrails:** expected values come from the user or the requirements, never from current behaviour without confirmation. That would turn existing bugs into "expected" results.
- **Levels:** T7. **Certainty:** E for running and checking tests; B for test design.

### S12. Concurrency and interrupts (no single LDRA component; MISRA C:2023 concurrency, CERT CON)
- **Subcomponents:**
  - S12.1 entries: threads, interrupt handlers, priorities
  - S12.2 shared-object accesses
  - S12.3 locksets
  - S12.4 happens-before, from creation, joins and interrupt masking
  - S12.5 races
  - S12.6 deadlock: cycles in the lock-order graph
  - S12.7 stack depth per entry, as the longest call path (M3, max-plus), plus the interrupt stack
- **Relations:** S4, S5, S6 → S2 (Dir 5, R22.x), S14.
- **Mathematics:** M10, the lockset meet, M15 (group potentials for lock order), M3.
- **Levels:** T5–T6. **Certainty:** S. This extends our current race finding.

### S13. Traceability and compliance (TBmanager)
- **Subcomponents:**
  - S13.1 requirements import (ReqIF, CSV, DOORS exports)
  - S13.2 links: requirement ↔ code ↔ test ↔ result
  - S13.3 matrices and gaps (§5.3)
  - S13.4 objectives per standard (ISO 26262 Part 6 tables; DO-178C Annex A when available)
  - S13.5 change impact
- **Relations:** everything above → S15.
- **Mathematics:** relations as Boolean matrices; transitive tracing by matrix product; impact by closure (M3).
- **Levels:** T8. **Certainty:** E.

### S14. Visuals and reports (TBvision; Testbed reports)
- **Rule:** in our own visual language, with mock-ups first.
- **Subcomponents:**
  - **S14.1 findings on the flow:** a fine mark on the step; opening it shows the rule, our wording, the proof path, and the evidence cycle from §4.3
  - **S14.2 coverage shown as light:** covered steps are solid and never-run ones fade; MC/DC pairs appear as matched marks on conditions
  - **S14.3 a value's journey:** a slice (S6.4) lit along the flow; breaks appear as a severed thread at the failing edge
  - **S14.4 metric rings** on hover
  - **S14.5 compliance board:** rules × files, filling in as levels complete
  - **S14.6 trace view:** requirement → steps → tests
  - **S14.7 reports:** HTML/PDF, each stamped with the configuration fingerprint
  - **S14.8 flow-break view:** shows the fundamental cycle or unmatched path that breaks I1–I8
- **Relations:** consumes everything.
- **Guardrails:**
  - the picture always equals the data: the same scene description is used for canvas, WebGL and reports
  - nothing is shown as passing that wasn't proven
- **Levels:** the UI shows each level as it lands (trickling is visible). **Certainty:** that of the data shown.

### S15. Qualification kit (LDRA's tool qualification support)
- **Subcomponents:**
  - S15.1 ISO 26262-8 clause 11: classification by tool impact and detection, giving TCL; plan; validation report
  - S15.2 DO-330, when the user has it
  - S15.3 validation suite runnable by the customer
  - S15.4 tool manual with known limits
  - S15.5 process evidence: specifications, tests traced to them, reviews, CI and releases
- **Relations:** everything above.
- **Levels:** T8. **Certainty:** E for the evidence. Acceptance belongs to the project's assessor.

---

## 7. Standards dissected

### 7.1 MISRA C:2012 / 2023 by group
The group titles come from the public table of contents. Rule meanings come from the user's licensed copy, which is never quoted.
**Classification for each rule:** category (mandatory, required, advisory) · decidable or undecidable · scope (one translation unit or system).

| Group | Topic | Main levels | Components | Mathematics | Typical certainty |
|---|---|---|---|---|---|
| Dir 1 | The implementation | T1–T2 | S1 | — | E (document the compiler's behaviour) |
| Dir 2 | Compilation and build | T1 | S1 | — | E |
| Dir 3 | Requirements traceability | T8 | S13 | Trace matrices | E |
| Dir 4 | Code design | T2–T6 | S2, S7 | Varies | Mixed |
| Dir 5 (2023) | Concurrency | T5–T6 | S12 | M10, M15 | S |
| R1 | Standard C environment | T1–T2, T6 (undefined behaviour) | S1, S7 | M7 | E / S |
| R2 | Unused code | T3–T5 | S4, S5 | I1, H₀, M1 | E (unused declarations) / S (dead code) |
| R3 | Comments | T0 | S2 | — | E |
| R4 | Character sets and lexical conventions | T0 | S2 | — | E |
| R5 | Identifiers | T1, T5 | S2, S8 | M4 prefix classes | E |
| R6 | Types | T2 | S2 | — | E |
| R7 | Literals and constants | T0–T2 | S2 | — | E |
| R8 | Declarations and definitions | T2, T5 | S2, S8 | M4 unification across files | E |
| R9 | Initialization | T3, T6 | S5, S7 | M1, M7 | E / S |
| R10 | Essential type model | T2 | S2 | M5 fold over a type lattice | E |
| R11 | Pointer type conversions | T2 | S2 | — | E |
| R12 | Expressions | T2, T6 | S2, S7 | M8 ℤ/2ⁿℤ, intervals | E / S |
| R13 | Side effects | T2–T3 | S2 | M10 sequenced-before order, M4 | E / S |
| R14 | Control statement expressions | T2, T6 | S2, S7 | M14, M7 | E / S |
| R15 | Control flow | T3 | S4 | I5, I6, M12 | E |
| R16 | Switch statements | T1–T3 | S2, S4 | Grammar plus CFG | E |
| R17 | Functions | T2–T4 | S2, S4, S5 | SCC (M4), M9 | E / S |
| R18 | Pointers and arrays | T2, T6 | S7 | M7 octagons, congruences | E / S |
| R19 | Overlapping storage | T2, T6 | S7 | M7 | E / S |
| R20 | Preprocessing directives | T0 | S1.3, S2 | The macro graph | E |
| R21 | Standard libraries | T2 | S2 | Set membership | E |
| R22 | Resources (and 2023 concurrency rules) | T4–T6 | S5, S12 | M15 coboundary, M9 | S |
| R23 (2023) | Generic selections | T1–T2 | S2 | — | E |

**To confirm against the licensed copy:**
- the exact decidability of each rule
- the 2023 additions (Dir 5, the concurrency rules in R22, R23)

### 7.2 Other standards
- **MISRA C++:2023 and AUTOSAR C++14** (free): the same components. C++ adds:
  - virtual dispatch: class-hierarchy candidates (S4.5)
  - exceptions: extra edges in the CFG, with I2 counting a throw as an exit
  - templates: canonical forms, M6
  - lifetimes and RAII: M15 potentials with constructor and destructor pairs
- **CERT C/C++** (free): its sections (PRE, DCL, EXP, INT, FLP, ARR, STR, MEM, FIO, ENV, SIG, ERR, CON, MSC, POS) map onto S2, S7 and S12, and are shared with MISRA through S2.5.
- **CWE:** a mapping from each weakness to our checks; the Juliet suite (NIST SARD) is the known-answer set.
- **JSF AV C++** (free): mostly S2 and S3 (metric thresholds).

---

## 8. Relations between components

Each mark means the row uses the column's results.

|     | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 | S13 |
|-----|----|----|----|----|----|----|----|----|----|-----|-----|-----|-----|
| S2  | ● |   | ● | ● | ● |   | ● | ● |   |   |   | ● |   |
| S3  | ● |   |   | ● |   |   |   |   |   |   |   |   |   |
| S4  | ● |   |   |   |   |   |   | ● |   |   |   |   |   |
| S5  | ● |   |   | ● |   |   |   |   |   |   |   |   |   |
| S6  |   |   |   | ● | ● |   |   |   |   |   |   |   |   |
| S7  | ● |   |   | ● | ● | ● |   |   |   |   |   |   |   |
| S9  | ● |   | ● | ● |   |   |   |   |   | ● |   |   |   |
| S11 | ● |   |   | ● |   | ● |   |   | ● | ● |   |   |   |
| S12 | ● |   |   | ● | ● | ● | ● |   |   |   |   |   |   |
| S13 |   | ● | ● |   |   | ● |   | ● | ● |   | ● |   |   |
| S14 | ● | ● | ● | ● | ● | ● | ● | ● | ● |   | ● | ● | ● |
| S15 |   | ● | ● | ● | ● | ● | ● |   | ● | ● | ● | ● | ● |

The graph has no cycles (it is a DAG). Levels run in its topological order: S1 → S4 → S5 → S6 → S7 → S12 → S2 → S13 → S14.

---

## 9. Guardrails (all components)

1. **No silent passes** (§0).
2. **Determinism:** sorted output, no dependence on hash order, and identical results with 1 thread or N threads.
3. **Configuration fingerprint** in every result and report.
4. **Self-checks:**
   - V(G) computed two ways
   - Euler characteristic
   - conservation of counts
   - subdivision check for instrumentation
   - clang's CFG as a second opinion
   - a failure is an internal error, shown loudly
5. **Metamorphic tests:** results stay the same under renaming, reformatting and reordering independent declarations.
6. **Differential tests:** coverage against gcov and llvm-cov; overlapping rules against clang-tidy and cppcheck, where disagreements are reviewed, not trusted blindly.
7. **Fuzzing** the front end and instrumenter: no crash on any input; on unsupported code, *can't tell*.
8. **Budgets** on time and memory per function and per level, ending in *can't tell*.
9. **Fingerprints are always confirmed** by exact comparison before reuse (P→E).
10. **Separate process:** `skyflowx` runs apart from the editor; if it crashes, the editor keeps working with the current engine.

---

## 10. Validation and process (towards ISO 26262-8, methods 1b and 1c)

**Specifications:** every rule, metric and check has a specification in `skyflowx/spec/<id>.md`, containing:
- the definition in our own words
- decidability
- its level
- the mathematics used
- known limits

**Tests** live in `skyflowx/tests/<id>/` and trace back to the specification:
- compliant cases
- non-compliant cases
- edge cases
- metamorphic variants

**Corpora:**
- Juliet (NIST SARD)
- the MISRA example suite
- the samples (tinyhttp, engine, programs)
- ThreadX
- one large C++ project

**Process:**
- CI on every change
- recorded reviews
- versioned releases with validation results attached
- known limits per release

---

## 11. Open questions for the user
1. The MISRA edition to target first: C:2012 with amendments, or C:2023?
2. Which compilers and targets come first (gcc-arm, IAR, Keil, GHS)?
3. Should MC/DC be unique-cause, masking, or both?
4. Will ISO 26262-8 and DO-330 be available?
5. The first projects to validate on, beyond ThreadX.
