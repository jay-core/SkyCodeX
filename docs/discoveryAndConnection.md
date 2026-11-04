# Discovery and connection

A record of the concepts we explore and discover together for SkyFlowX and SkyCodeX. It is written to stay accurate: each entry says whether the idea is **known** (with its source), **adapted** by us, a **hypothesis** of ours, **proven** by us, or **rejected**. Nothing here is implemented until "Skyflow execute!" (analyser) or "SkyCodeX execute!" (editor).

Related: [SKYFLOWX-TASK.md](SKYFLOWX-TASK.md) (the specification) and [ROADMAP.md](ROADMAP.md).

## How entries are written

| Status | Meaning |
|---|---|
| **Known** | Published; the source is given. We only apply it. |
| **Adapted** | A known idea used in a new place or combination. We must check that its conditions still hold there. |
| **Hypothesis** | Our own idea, not yet proven or measured. Never used for a "pass" until promoted. |
| **Proven** | Our own idea, with a proof (conditions stated) or a measurement against known answers. |
| **Rejected** | Tried and failed; kept with the reason, so we don't retry it. |

Each entry gives:
- a plain statement
- a formal statement
- why it holds
- an example
- where we'd use it
- open questions
- connections to other entries

IDs: **F** for foundations (the toolkit), **D** for discovery threads. Sub-ideas are D1.a, D1.b and so on.

---

## Map of entries (kept current)

| ID | Title | Status | Uses | Feeds |
|---|---|---|---|---|
| F1 | Topology | Known/Adapted/Hypothesis per row | — | All |
| F2 | Fields | Known | — | S3, S7, S9, S11 |
| F3 | Functional analysis | Known/Adapted/Hypothesis per row | — | All |
| F4 | Matrices | Known/Adapted | — | All |
| F5 | Further mathematics | Candidates | — | D1, D2, D3, S-components |
| D1.0 | Directed topology core | Known | F1 | D1.* |
| D1.1 | Worked deadlock example | Known | D1.0 | — |
| D1.2 | What it gives | Known/ours | D1.0 | S12, S14 |
| D1.a / D1.a′ | Interrupts on one core | **Proven** (A1–A8) | D1.e, D2.6 | S12 |
| D1.b | Split by sharing | **Proven** (corollary of D1.h′) | D1.h′ | D1.i |
| D1.c | Progress-diagram view | Our design | D1.* | S14, SkyCodeX |
| D1.d | Branches and loops (cubical) | Known | D1.0 | D1.i |
| D1.e | Model ladder M0–M4 | Adapted (proof given) | — | D1.a, D1.i |
| D1.f | Data-race-free ⇒ sequential consistency | Known theorem | — | D1.k |
| D1.g | Kinds of forbidden region | Known/Adapted | D1.0 | D1.h″ |
| D1.h / D1.h′ | Projection lemma, cutoff | **Proven** (B1–B4) | D1.e | D1.b, D1.h″ |
| D1.h″ | Provider closure, counter abstraction, condition variables | **Proven** / Known / Hypothesis (lost wake-up) | D1.h′, D2.1, F5 | D1.i |
| D1.i | Finding threads and resources | Our design | S4.6, S12 | — |
| D1.j | Showing schedule classes | **Decided** | D1.0 | S14 |
| D1.k | Memory-model scope | **Decided** | D1.f | S12 |
| D2.0–D2.2 | Monoid labels, linear proof check | Adapted (proof given) | F1, F4 | D1, D2.* |
| D2.3 | Leak example | — | D2.2 | — |
| D2.4 | Lifting to a cover | **Hypothesis** | D2.2, S5, S7 | — |
| D2.5 | Across functions | Adapted | D2.2 | S12 |
| D2.6 | Must/may windows | Adapted (required for soundness) | D2.2 | D1.a′, D1.0 |
| D2.7 | Held band view | Our design | D2.* | S14 |
| D2.8 | Rules covered | — | D2.* | S2 |
| A.0–A.3 | Atomic method, public capability sources, 52 atoms, principles P1–P8 | Method / Known–Candidate per principle | A.1 sources | All batches |
| A.4–A.4h | Injection batches 1–8 (foundation, metrics, rules, flow, coverage, testing, requirements and compliance, visuals and reports) | Per atom: Known / Refinement / Candidate | A.3 | D3.7, D3.9 |
| D3.6 | AI-free repair engine (network LP for resources, reductions, ranking only by probability or fuzzy logic) | Candidate / Known | D2, A16 | D3.9 |
| D3.7 | Repair growth ledger (rows per batch) | Standing rule | A-batches | D3 |
| D3.8 | Confirmation, feedback and deduction without AI | Adapted | D3.7 | D3 |
| D3.9 | Deep re-read R-1…R-29 | Candidates / Known per item | Batches 1–5 | D3 |
| D3.10 | Deep re-read R-30…R-49, X-1…X-3 | Candidates / Known per item | Batches 6–8 | D3 |
| D3.11 | Fixes that affect each other: footprints, statuses after each accepted fix, joint fixes, O2′ correction (R-50…R-55) | Known, applied / Candidates | R-6, R-20, D3.8, X-3 | D3, SkyCodeX UI |
| D3 | Verified improvement suggestions (repair engine), incl. D3.6 AI-free engine, D3.7 growth ledger, D3.8 feedback and deduction, D3.9 deep re-read R-1…R-29 | Adapted / Candidates | D1, D2, A-batches | SkyCodeX UI |
| T | Uniform atomic treatment of D1–D4 (atoms, injection, dominance, repair), new results N-1…N-8 | Mixed per item | A.0 | D3.7 |
| D4 | Sheaf gluing for C/C++: partial-information fold (Helly), units over abelian groups, tractability by coefficient group, proof gluing over covers (correction), Mayer–Vietoris, lockset gluing | Candidate / Known per item | F1, D2.2, D3.6.3 | D3 repair, A10, R-1, R-21 |
| U | Unified SkyFlowX (U.11: the SkyFlowX tab): the 64 concepts where Frama-C is below LDRA, Frama-C's methods rebuilt clean-room, the common core on every OS, the Frama-C add-on on Linux and macOS, ARINC 653 checks, "more capable" measured per axis | Decided / Known / Candidates | A.2, F5, D1–D4 | D3.7, ROADMAP |

## Prior-art and novelty register (2026-10-31)
**Honest position:** so far this document is mostly a **careful synthesis of known mathematics**, applied to our design. No entry has been shown to be new to the literature. Novelty is claimed only after a prior-art search and a measured improvement over existing tools.

| Entry | Prior art found | Novelty position |
|---|---|---|
| D1.0–D1.2, D1.d, D1.g | Directed algebraic topology for concurrency, with deadlock and unsafe-region detection implemented in the **ALCOOL** static analyser (Goubault and Haucourt, CONCUR 2005; Fajstrup, Goubault, Haucourt, Mimram and Raussen, Springer 2016) | **Known.** Not ours. |
| D1.a′ (interrupts) | Lockset analysis using "disjoint blocks" for interrupt disable/enable (Chopra, Pai and D'Souza, ESOP 2019, applied to FreeRTOS); SDRacer (Wang et al., arXiv 2305.17869); Draco (Huo et al. 2011) | **Known in substance.** Our version adds the formal model ladder and memory-access granularity, which is at most a minor refinement. |
| D1.h′ (projection lemma) | Kahlon, Ivančić and Gupta, CAV 2005: threads that communicate only through locks; nested locks decidable; pairwise reachability depends on acquisition histories | **Very likely folklore.** The monotonicity argument is standard. |
| D1.h″ (provider closure) | Cone-of-influence reduction; counter abstraction (German and Sistla 1992); well-structured systems (Abdulla et al. 1996) | **Likely known in parts.** Unverified as a combination. |
| D1.e, D1.f | Abstraction soundness (elementary); data-race-free ⇒ sequential consistency (Adve and Hill 1990; Boehm and Adve 2008) | **Known.** |
| D2.0, D2.5 | Typestate (Strom and Yemini 1986); resource-leak analysis from acquire/release specifications (Torlak and Chandra, ICSE 2010); leak checking as accumulation analysis (Kellogg et al.); weighted pushdown systems / IDE for summaries | **Known.** |
| D2.1–D2.2 (bicyclic/polycyclic monoid labels; a spanning-tree check over any monoid) | No use of the bicyclic monoid for resource checking found in a first search. Closely related: semiring- and monoid-weighted dataflow. | **Candidate (unverified).** Possibly a new formulation, not a new capability. |
| D2.4 (lifting guided by the failing cycle) | CEGAR (Clarke et al. 2000), interpolation (McMillan), ESP path-sensitive typestate (Das et al. 2002) | **Candidate, weak:** probably the same idea with a different counterexample shape (a cycle pair rather than a path). |
| D3.11 (interacting fixes) | Bernstein conditions (1966); Newman's lemma (1942); graph-transformation critical pairs for refactorings (Mens, Taentzer and Runge 2007); patch theory and operational transformation | **Known**, applied. Candidates: certificate footprints, the status pass, O2′ |
| D4 (sheaves) | Čech cohomology of a semantic presheaf unifying type checking, bug finding and equivalence (Young, arXiv 2603.27015, 2026); sheaves for differential testing (arXiv 2003.00976) | **Known (recent).** D4 builds on it. Our candidates: D4.5 (tractability by coefficient group). **Revised by T4:** D4.3 is a Refinement (GCC `-Wlto-type-mismatch` exists); D4.4 is a Refinement (Osprey, ICSE 2006; Phriky Units 2017). D4.6 is Known, applied as a correction. |

| U (unified SkyFlowX) | Every method in U.3 is published (Frama-C papers and manuals, Cousot, Dijkstra, Weiser, Bardin et al.) | **Known**, rebuilt clean-room. Candidates: one contract used three ways in one product (Refinement at most); a C++ One Definition Rule violation read as a gluing failure |

**Rule from now on:** each new entry gets a "Prior art" line and one of these positions: Known · Refinement · Candidate (unverified) · Novel (verified by search and measurement).

## Plan (kept current)
1. D4 started and Young 2026 read (D4.11). **Decided 2026-10-31:** mechanise the core theorems in Lean 4 + Mathlib, offline (D4.11 list), when "Skyflow execute!" is given. Next: the user's choice of thread. Repair-engine re-reads are complete for batches 1–8 (D3.9, D3.10).
2. **Open proofs:** D2.4 (lifting: termination and soundness); the D1.h″ lost-wake-up check.
3. **Measurements once implementation starts ("Skyflow execute!"):**
   - the D2.2 pass rate on ThreadX and tinyhttp
   - D2.4 false-alarm reduction
   - D1 class counts on real RTOS code
4. **Fold the decided items back into SKYFLOWX-TASK.md:** §4.3 is already marked as superseded by D2.1–D2.2.

---

## F. Foundations (agreed vocabulary, 2026-10-30)

### F1. Topology: shape and connection, ignoring distance

| Concept | Plain meaning | In code | Status |
|---|---|---|---|
| Neighbourhood (reachability topology) | What is "near": what a point can reach | What a line can affect | Known (Alexandrov topology on a preorder) |
| Connectedness | Pieces that hang together | Islands nothing reaches = dead code or independent modules | Known |
| Homology (holes) | Independent loops | Complexity V(G) = first Betti number of the CFG with exit→entry added; McCabe paths are a basis | Known (McCabe 1976; standard graph homology) |
| Continuity | A change of shape that doesn't tear | Source → CFG → instrumented code loses or invents no flow (SKYFLOWX-TASK §1.3) | Adapted |
| Homotopy | Routes that slide into each other | Paths equivalent for a given question; check one per class | Known in principle; how we use it is open |
| Directed topology | Paths that only go forward in time | Concurrency: see **D1** | Known (see D1) |
| Cohomology | Labels that add up consistently around every loop | Lock/alloc balance; one linear pass; a failing cycle locates the break (SKYFLOWX-TASK §4.3) | Adapted |
| Covering spaces | Unrolling into layers | Call contexts as layers | Known (CFL reachability is the algorithmic form) |
| Sheaves | Local facts that must glue into one global picture | Cross-file consistency | Hypothesis (as a unifying framework) |
| Simplicial complexes | Relations among 3 or more things | 3+ threads sharing one object | Hypothesis (use) |
| Persistent homology | Structure that survives zooming out | Stable folding levels for large codebases | Hypothesis (use in the UI) |

### F2. Fields (arithmetic where + − × ÷ always work, exactly)

| Field | Use | Status |
|---|---|---|
| GF(2) | Cycle space; MC/DC via the Boolean derivative ∂f/∂xᵢ = f(xᵢ=0) ⊕ f(xᵢ=1); fingerprints | Known |
| GF(q) | Orthogonal arrays and covering arrays for pairwise tests (Bose) | Known |
| ℚ | Exact affine relations between variables (Karr 1976) | Known |
| ℤ/2ⁿℤ (a ring) | Machine integer wrap and overflow | Known |

### F3. Functional analysis (functions as objects)

| Concept | Use | Status |
|---|---|---|
| Operators | A statement, loop or function is an operator on states; a program is their composition | Known (denotational semantics) |
| Fixed points | Every analysis is a least fixed point; existence by Knaster–Tarski; reached by Kleene iteration | Known |
| Contractions | Bounds on the number of passes | Adapted (holds only for specific domains) |
| Adjoint / transpose | Backward analysis = forward on the transposed graph | Known |
| Kernel and image | Inputs that can't affect an output; outputs that can never occur | Adapted |
| Norms and distances | Ranking a change's impact | Hypothesis |
| Spectral methods | Clusters, central functions, layout of huge projects | Known (spectral clustering); use is open |
| Markov chains | Hot paths and expected cost from branch probabilities | Known |

### F4. Matrices (a table that stores a graph)

| Operation | Use | Status |
|---|---|---|
| Multiply / power | Paths of length k | Known |
| Closure A* | All reachability, callers, effects | Known (Kleene, Tarjan 1981) |
| Semirings | One solver for reachability (∨,∧), path counts (+,×), shortest (min,+), longest (max,+) | Known |
| Transpose | Backward analysis | Known |
| Rank and basis | Independent loops, the minimal test basis, a minimal set of rule features | Known / Adapted (features: SKYFLOWX-TASK §5.1) |
| Block (SCC) form | Solve each group once, in order | Known |
| Bit-packing | 64 Boolean facts per word | Known |

---

## D1. Directed topology for threads and interrupts (started 2026-10-30)

### D1.0 The known core
**Status: Known.** Sources:
- Dijkstra 1968, progress graphs
- Carson and Reynolds 1987, *The geometry of semaphore programs*
- Pratt 1991, *Modeling concurrency with geometry*
- Fajstrup, Goubault and Raussen 1998, *Detecting deadlocks in concurrent systems*
- Fajstrup, Goubault, Haucourt, Mimram and Raussen 2016, *Directed Algebraic Topology and Concurrency*
- Grandis 2009, *Directed Algebraic Topology*

**Plain statement:**
- Give each thread an axis showing how far it has run.
- With two threads, every moment of the program is a point on a square. With n threads it's a point in an n-dimensional cube.
- Time only moves forward, so a run is a path that never goes left or down. This is a **directed path**.
- While two threads would both hold the same lock, the program can't be in that state. That region is a **forbidden block**.

**Formal statement (straight-line threads):**
- **State space:** thread i is a sequence of lock (P) and unlock (V) operations along [0, 1]. The state space is X = [0,1]ⁿ.
- **Forbidden region:** for a lock `a` held by thread i on (pᵢ, vᵢ) and by thread j on (pⱼ, vⱼ), the box Fₐ = (pᵢ, vᵢ) × (pⱼ, vⱼ) in coordinates (i, j), all other coordinates free, is forbidden. The allowed space is X \ ⋃ F.
- **Executions** are directed paths (non-decreasing in every coordinate) from 0 to 1 in the allowed space.
- **Two executions are equivalent (dihomotopic)** when one deforms into the other through directed paths without crossing a forbidden block.

**Key facts:**
- Equivalent executions give the same order of every lock handover, so they agree on everything locks protect.
- **One check per class** replaces checking every interleaving.
- **Deadlock:** a reachable allowed point, other than the end, from which no move goes forward.
- **Unsafe region:** the allowed points from which *every* directed path ends in a deadlock. It is the "point of no return".
- **Unreachable region:** the allowed points no directed path from the start reaches.

**Relation to other known work:**
- Mazurkiewicz traces (1977) and partial-order reduction (Godefroid 1996; Peled; Valmari) also merge interleavings that differ only in the order of independent steps. They are the combinatorial counterpart.
- The geometric view adds two things:
  - **Shape:** where deadlocks and unsafe regions *are*.
  - **Counting:** how many essentially different schedules exist.

### D1.1 Worked example: the classic deadlock
- **T1:** `lock(a) lock(b) … unlock(b) unlock(a)`, with ticks Pa=1, Pb=2, Vb=3, Va=4 on the x-axis.
- **T2:** `lock(b) lock(a) … unlock(a) unlock(b)`, with ticks Pb=1, Pa=2, Va=3, Vb=4 on the y-axis.

Forbidden blocks:
- **Lock a:** T1 holds it on x∈(1,4) and T2 on y∈(2,3), so Fₐ = (1,4)×(2,3).
- **Lock b:** T1 holds it on x∈(2,3) and T2 on y∈(1,4), so F_b = (2,3)×(1,4).

```
 T2 progress
   4 ┤ ·  ·  ·  ·  ·
   3 ┤ ·  ·  ▓  ·  ·        ▓ forbidden (both would hold a lock)
   2 ┤ ·  ▓  ▓  ▓  ·        ✕ unsafe: T1 holds a, T2 holds b
   1 ┤ ·  ✕  ▓  ·  ·          its top-right corner (2,2) is the deadlock
   0 ┤ ·  ·  ·  ·  ·
     └─┬──┬──┬──┬──┬─→ T1 progress
       0  1  2  3  4
```

The two blocks cross like a plus sign, and the inner corner at (2,2) is the trap:
- **The deadlock:** T1 holds a and wants b, while T2 holds b and wants a.
- **The unsafe square** (1,2)×(1,2): once both first locks are taken, every future leads to the deadlock.
- **Safe classes:** exactly two, "T1 takes both first" (passing below and right of the cross) and "T2 takes both first" (passing above and left). The cross leaves no gap between them.

**The fix, explained by shape:**
- If T2 also locks in the order a then b, the blocks *nest* (F_b ⊂ Fₐ's shadow) instead of crossing.
- Nested blocks have no inner corner, so no deadlock is possible.
- This is the geometric reason behind the lock-ordering rule.

### D1.2 What it gives us

| Gain | How | Status |
|---|---|---|
| Deadlocks found at their exact position | Inner corners of unions of forbidden blocks | Known (FGR 1998) |
| An early warning before the deadlock | The unsafe region: "after both first locks are taken, it's inevitable" | Known (concept); its use as a UI warning is ours |
| Races checked per class, not per interleaving | Conflicting accesses in different orders in different classes = a race | Adapted |
| A count of essentially different schedules | The number of classes (components of the trace space) | Known |
| A visual | The progress diagram itself, in our visual language | Our idea (see D1.c) |

### D1.a Hypothesis: interrupts are axis-parallel jumps (preemption geometry)
**Status: Proven 2026-10-31 under assumptions A1–A8, with corrections; see D1.a′.** This is the M2 case of D1.e: valid only when that model is proven to apply.

**Plain statement:**
- An interrupt handler doesn't interleave freely with the thread: it **runs to completion** once it starts, unless a higher-priority interrupt preempts it.
- On the thread × ISR square, every run therefore moves along the thread axis, jumps the whole ISR axis in one straight vertical move, and continues.
- Masking interrupts (disable/enable) forbids the *start* of that jump over a stretch of the thread axis.

**Consequence:** the 2-D problem collapses to **1-D intervals on the thread's axis**:
- **M**, the windows where the ISR is masked
- **L**, the windows where a lock shared with the ISR is held
- **A**, the windows where the thread is inside an access to data the ISR also touches

**The claim:**
- There is a thread/ISR race exactly when some access window in A contains a point not covered by M ∪ L, and the ISR touches the same data with at least one write between the two accesses.
- Checking this is sorting and sweeping intervals, O(n log n).

**Nested priorities:** the claim would extend as a tower, with each higher priority level jumping over the levels below it.

**To prove or reject:**
1. Formalise "runs to completion" as a restriction on directed paths: only segments parallel to the axes, with each ISR segment going the full length 0→1.
2. Show that the equivalence classes of these restricted paths match the intervals above.
3. Check edge cases:
   - an ISR that blocks (it shouldn't)
   - an interrupt arriving again while its handler runs
   - multi-core, where an ISR truly runs in parallel and the free 2-D geometry returns
   - DMA

**Connects to:** S12 in the specification, MISRA Dir 5 / R22 (2023), CERT CON, and our current race finding.

### D1.b Adapted: split the space by who shares what
**Status: Adapted.** The independence principle is known from partial-order reduction; we apply it to the geometry.

**Plain statement:** threads that share no lock and no data never constrain each other, so their part of the state space is a plain product and can be analysed separately.

**Formal statement:**
- Build the sharing hypergraph: one vertex per thread, and one hyperedge per lock or object, connecting the threads that use it.
- Its connected components split X into independent factors, and each component is analysed on its own.
- With most RTOS systems, this turns one 20-dimensional problem into several 2–3-dimensional ones.

**Proven 2026-10-31** as a corollary of the projection lemma (D1.h′). Earlier note: It does, because a deadlock needs a cycle of waiting and waiting only happens on shared locks, but this needs a written proof.

### D1.c Design idea: the progress diagram as a SkyCodeX view
**Status: our design idea, to mock up first.**
- **The picture:** two chosen threads, or a thread and an ISR, as axes; locks as soft blocks; the current run as a line.
- **Playing it:** play moves a point along the line.
- **Warnings:** the unsafe region shows as a faint shade, and a deadlock corner glows.
- **Linked to the flow view:** clicking a block jumps to that `lock()` in the flow view, and changing the order of locks in the code redraws the blocks.

### D1.d Known: threads with branches and loops
**Status: Known.**
- Real threads branch and loop, so each axis is the thread's CFG rather than a line.
- The state space is then a **product of graphs**, a cubical complex (precubical sets and higher-dimensional automata: Pratt 1991; Goubault).
- Forbidden cells come from pairs of lock-holding segments.
- Loops make the trace space infinite. It is handled with the component category (Fajstrup, Goubault, Haucourt and Raussen), which gives a finite set of regions.

**Open:**
- the cost on real RTOS code, ThreadX first
- whether D1.a removes most of it for single-core targets

### D1.e Execution models as restrictions on paths (any target)
**Status: Adapted.** The soundness argument is elementary; applying it as a ladder of models for one engine is our design.

**Decision (2026-10-30): the target can be anything.** Single core or multi-core, bare metal, an RTOS, POSIX, C++ `std::thread`, signals, coroutines, DMA. So the engine must not assume one execution model.

**Plain statement:**
- Start from the most permissive model, where everything can run at the same time.
- Every real platform only **removes** runs from that model: run-to-completion interrupts, priorities, a single core, cooperative yields.
- So:
  - **An analysis in a looser model never misses a problem of a stricter one.** It may only raise extra alarms.
  - Moving to a stricter model removes alarms, but it is valid **only if that model is proven to apply**.

**Formal statement:**
- Let Exec(M) be the directed paths allowed under model M. If M′ is a restriction of M, then Exec(M′) ⊆ Exec(M).
- For any "exists a bad run" property B (deadlock, race, broken order): B holds in M′ ⇒ B holds in M.
- **Proof:** a bad run of M′ is a run of M. ∎
- The models form a ladder, ordered by inclusion of their path sets:

| Model | Allowed runs (restriction of M0) | Typical platforms |
|---|---|---|
| **M0 Free** | All directed paths in the product space | Multi-core, SMP RTOS, POSIX threads on multi-core |
| **M1 Preemptive, one core, priorities** | One thread moves at a time; a lower priority can't move while a higher one is ready | ThreadX/FreeRTOS on one core |
| **M2 Run-to-completion handlers** | A handler's segment is a full jump 0→1 on its axis (D1.a) | ISRs on one core, POSIX signal handlers relative to the interrupted thread |
| **M3 Cooperative** | Switches happen only at yield points | Coroutines, event loops, cooperative schedulers |
| **M4 Hardware agents** | An extra axis whose activity is the interval between start and completion | DMA, peripherals writing memory |

**Use:**
- SkyFlowX picks the strictest model it can **prove** from the evidence:
  - the build target (core count, e.g. `-mcpu`)
  - the RTOS configuration (SMP options)
  - the APIs used (`pthread_create`, `std::thread`, `signal`, OpenMP)
  - a project declaration
- Without proof, it uses **M0**.
- Every finding states the model it was found under, like the configuration fingerprint.

**Connects to:** D1.a, which becomes the M2 case; S12; SKYFLOWX-TASK guardrail 3.

### D1.f The bridge to real hardware: data-race-free implies sequential consistency
**Status: Known theorem; adapted use.** Sources: Adve and Hill 1990; Boehm and Adve 2008; the C11 and C++11 memory models.

**Plain statement:**
- Directed-topology pictures assume one shared timeline (sequential consistency). Real multi-core chips (ARM, POWER, even x86 in places) reorder memory operations.
- The theorem says that **if a program has no data races, it behaves as if there were one timeline, on any conforming hardware and compiler.**
- So:
  1. Prove there are no races using the simple one-timeline geometry.
  2. If that holds, every other geometric result (deadlocks, order, classes) is **valid on any target**.
  3. If there are races, report them. In C and C++ a data race on non-atomic data is undefined behaviour, so it must be reported anyway.

**Formal statement:** if every sequentially consistent execution of P is free of data races, then every execution of P under the C11/C++11 model is sequentially consistent.

**Gap:** relaxed and acquire/release atomics fall outside this bridge. Code using them needs an axiomatic memory-model check (happens-before relations as in Alglave, Maranget and Tautschnig 2014, *Herding cats*) on the small patterns where they are used. Those findings are labelled separately.

### D1.g More kinds of forbidden region
**Status:**
- **Known:** counting semaphores (Carson and Reynolds 1987).
- **Adapted:** barriers, messages and once-initialisation.

| Construct | Forbidden region | Shape |
|---|---|---|
| Mutex | Two threads inside at once | A box on a pair of axes |
| Counting semaphore (k) | k+1 threads inside at once | A (k+1)-way box: a relation among k+1 threads, a simplex (F1) |
| Barrier | One thread past the barrier while another hasn't reached it | Two "staircase" regions on either side of the barrier point |
| Message (send → receive, queue, pipe, socket) | The receiver past its receive while the sender is still before its send | A half-strip: an ordering constraint, not mutual exclusion |
| Interrupt masking (M2) | The start of a handler jump inside a masked window | A strip on the thread axis |
| Once / initialisation guard | Any use before the initialiser finishes | A half-strip |

**Consequence:** one engine handles locks, semaphores, barriers, message passing between processes (our programs view) and interrupt masking. Deadlocks with messages appear as inner corners too: each process waits for a message the other will only send later.

### D1.h Symmetry and a cutoff for identical threads
**Status: Proven 2026-10-31 under assumptions B1–B4; see D1.h′.** Parameterised verification with cutoffs is known (e.g. Emerson and Kahlon 2000); its fit with our geometry is unchecked.

**Plain statement:**
- Code often starts N copies of the same thread, and N may be unknown (a pool, or created in a loop).
- Swapping identical threads changes nothing, so the space can be folded by that symmetry: the orbits of the symmetric group Sₙ.
- For pairwise properties (two-thread races, two-lock deadlocks) in a model with **only locks**, we suspect **two copies plus an abstract "rest"** are enough.

**To prove or reject:**
- Can extra copies make a state reachable that two copies can't? Through shared data that changes branches, they might.
- Find the exact conditions (no data-dependent branching on shared state, or treating it as unknown) under which the cutoff holds.
- Counting semaphores need k+1 copies, which is consistent with D1.g.

### D1.i How the threads and their resources are found
**Status: our design.**
1. **Entry points (S4.6):**
   - `main`, thread creation calls (we already detect `tx_thread_create`, `xTaskCreate`, `pthread_create`, `std::thread` and others)
   - interrupt handlers (by name and vector table)
   - signal handlers
   - callbacks registered with an RTOS
2. **Per entry:** its CFG with lock/unlock, semaphore, barrier, send/receive, mask/unmask and shared-access events placed on it (S12).
3. **Unknowns:**
   - a lock taken through a pointer: the candidate set of locks (S4.5)
   - a thread whose count is unknown: D1.h
   - both are labelled in the findings
4. **Split by sharing:** D1.b.
5. **Pick the model:** D1.e.
6. **Build the geometry and analyse:**
   - first, race freedom (D1.f)
   - then, deadlocks, unsafe regions, order and classes

### D1.a′ Proof: interrupts on one core (2026-10-31)
**Status: Proven under A1–A8.** It corrects D1.a in three places.

**Corrections to D1.a:**
1. **Locks (L) don't protect against handlers.** A handler can't wait for a mutex, so only **masking** protects (global disable, or priority masking such as BASEPRI). L is removed.
2. **The thread axis has to be at memory-access granularity, not C statements.** `x++` is a read *then* a write, with a gap between them. An object wider than the target's native atomic width (e.g. 64-bit on a 32-bit MCU) and a bit-field write are several steps each.
3. **Masked windows come from D2:** disable = acquire and enable = release (save/restore uses the polycyclic monoid). Protection uses the **must-hold** window (D2.6).

**Assumptions:**
- **A1:** one core.
- **A2:** the handler never blocks and runs to completion.
- **A3:** the handler isn't re-entrant: its own level is masked while it runs.
- **A4:** priorities are fixed.
- **A5:** an interrupt can arrive at any moment.
- **A6:** every masking function is also a **compiler barrier**, so the compiler can't move accesses across it (CMSIS `__disable_irq` is; a plain volatile store is not).
- **A7:** the architecture's guarantee about when a mask takes effect is respected (checked per architecture).
- **A8:** non-maskable interrupts are treated as never masked.

**Definitions:**
- A **gap** is a point between two consecutive thread steps, i.e. an edge of the thread's access-level flow.
- A gap is **enabled** unless it lies in the must-hold mask window.
- An **access window** W for an object o is a set of consecutive thread steps on o that must appear indivisible:
  - every multi-step access (rule 2)
  - every read-modify-write path (a read of o followed by a write of o with no masking in between)
  - every check-then-act pair the user or a rule declares
- **Interference:** a handler activation between two steps of W that writes o, or that reads o while W writes it.

**Lemma 1 (shape of runs):** under A1–A3, every run is the thread's own path with **whole** handler activations inserted at enabled gaps.
- **Proof:**
  - By A1 only one of the thread and the handler moves at a time.
  - By A2 and A3, once a handler starts, it moves alone until it finishes.
  - It can start only where interrupts are enabled. ∎

**Theorem 1:** interference on W is possible ⟺ some gap strictly inside W is enabled, **and** the handler's may-access set on o conflicts with W (at least one side writes).
- **Proof:**
  - (⇐) By A5 an activation can arrive at that enabled gap; by Lemma 1 the resulting run is allowed, and its conflicting access lies between two steps of W.
  - (⇒) By Lemma 1 a handler step between two steps of W belongs to a whole activation inserted at a gap inside W, and that gap must be enabled. ∎

**Cost:** mark the must-masked edges (D2, linear), then test each window's inner edges. That is **linear** in the size of the flow, simpler than the interval sweep first proposed.

**Nested priorities (Theorem 2, by induction on level):**
- For a handler at level i, everything at lower levels together (the thread plus handlers below i) plays the role of "the thread", and a mask blocks the levels at or below its threshold.
- Handlers at the **same** level never preempt each other, so they're indivisible relative to each other.
- The induction step is Theorem 1 with "thread" replaced by "levels below i".

**Outside these assumptions:**

| Situation | Model to use instead |
|---|---|
| Multi-core | M0 (D1.e) |
| A handler that re-enables interrupts inside itself | Its unmasked stretch becomes preemptible, like a thread |
| DMA | M4 |
| Masking through an unknown function | Treated as **not** masked (sound) |
| Deferred handlers that run as threads | Ordinary threads |

### D1.h′ Proof: the projection lemma and the cutoff (2026-10-31)
**Status: Proven under B1–B4.** It also proves D1.b.

**Assumptions:**
- **B1:** synchronisation uses only mutexes, counting semaphores and interrupt masks. No barriers, condition variables or messages; see "outside" below.
- **B2:** branches that test shared data are treated as free choices (an over-approximation, so it's sound).
- **B3:** data private to a thread is truly private, proven by escape analysis.
- **B4:** properties are safety properties about the local states of a chosen set S of threads, e.g. "copies i and j are at conflicting accesses with no common must-held lock", or "i and j each wait on a lock the other holds".

**Projection lemma:** under B1–B3, a set S of threads can reach a combination of local states in the full system ⟺ S can reach it running **alone**.
- **Proof:**
  - (⇐) Let every other thread stay at its start, holding nothing. The S-only run is still a valid run. Safety needs no fairness.
  - (⇒) Delete every step of every thread outside S. Only locks and semaphores link threads (B1), and their data effects were already free choices (B2), so the deletion can affect S only by **freeing** locks or semaphore units. Freeing never disables an acquire, so every step of S stays enabled, in the same order. ∎

**Corollaries:**
- **Cutoff = the number of threads the property mentions.**
  - A pairwise race or a two-lock deadlock needs **2 copies**.
  - A k-cycle deadlock needs k.
  - Exceeding a semaphore's count k needs k+1.
  - Pools of unknown size are handled exactly by these small instances.
- **D1.b is proven:** threads that share nothing never change what S can reach.
- **Partial deadlocks** (some threads stuck forever) are preserved both ways.

**Why B2 matters:**
```c
if (++count == 3) access(x);   // only the third thread to arrive takes this branch
```
- With exact data, two copies never reach `access(x)`, so a 2-copy check would miss a race that needs 3 threads.
- Under B2 the branch is a free choice, two copies do reach it, and the race is reported.
- It's sound, possibly with an extra alarm, which D2.4-style lifting can later remove.

**Outside B1:**
- Barriers, condition variables and messages make S **wait for** other threads, so deleting them can block S and the lemma fails.
- For these the cutoff must include the threads that S waits on: the signaller, the sender, all parties of a barrier.
- **Solved in D1.h″.**

### D1.h″ Waiting on other threads: messages, events, barriers, condition variables (2026-10-31)
**Status:**
- **Proven:** the provider-closure theorem, under B2, B3 and token semantics.
- **Known:** the counter abstraction (German and Sistla 1992; well-structured systems: Abdulla et al. 1996).
- **Hypothesis:** the lost-wakeup check.

**Plain statement:**
- If a thread in S waits for something another thread supplies (a message, an event bit, a semaphore "give", a barrier arrival, a thread finishing), that supplier must be kept.
- Threads that only *take* can still be removed, because removing a taker leaves more for everyone else.
- So keep S plus **everyone who can supply what S (or another kept thread) waits for**, repeated until nothing new is added.

**Token model** (the Petri-net view, F5): every synchronisation object is one or more **places** holding tokens.

| Object | Places: initial tokens | Who consumes / who supplies |
|---|---|---|
| Mutex | 1 | Lock consumes, unlock supplies, always after its own consume |
| Counting semaphore (k) | k | Take consumes, give supplies |
| Queue (capacity c) | items: 0, slots: c | Receive consumes an item and supplies a slot; send consumes a slot and supplies an item |
| Event flag (persistent bit) | 0/1 | Wait consumes (or only tests), set supplies |
| Task notification (FreeRTOS) | A counting semaphore per task | As above |
| Join / thread creation | The target's "finished" / "started" place | The target supplies "finished"; the **creator** supplies "started" |
| Barrier (N parties) | arrived → pass | Every party supplies "arrived"; the last arrival turns N "arrived" into N "pass"; each party consumes one "pass" |

**Net supplier:**
- For each thread t and place x, D2's bicyclic potential (q = supply, p = consume) gives qᵐpⁿ along each path.
- **t is a net supplier of x if m > 0 on some path**: at some point it has supplied more than it consumed.
- A mutex holder always has m = 0, because it unlocks only what it locked. That is why mutexes needed no suppliers in D1.h′.
- **D2's machinery finds suppliers automatically.**

**Provider closure:** S* is the least set containing S such that, if a member of S* consumes from x and t is a net supplier of x, then t ∈ S*. Interrupt handlers count as threads here (under M2, their arrival is free by A5).

**Theorem (provider closure):** under B2 (data, including message contents, treated as free choices) and B3, a combination of local states of S is reachable in the full system ⟺ it is reachable by S* running alone, from the same initial tokens.
- **Proof:**
  - (⇐) Threads outside S* stay at their start. They hold no tokens and don't need to move, since safety needs no fairness.
  - (⇒) Delete every step of every thread outside S*.
    - On every place x that S* consumes from, no deleted thread is a net supplier.
    - So at every moment each deleted thread's cumulative effect on x is ≤ 0, and removing it leaves **at least as many tokens** on x as in the original run.
    - Every consume by S* therefore stays enabled, in the same order.
    - Places that S* doesn't consume from don't affect S*.
    - Message contents may differ, because FIFO order shifts when a removed taker is gone, but by B2 they're free choices anyway. ∎

**Cutoff:**
- The number of instances needed is |S*|. If S* is finite (e.g. one producer, one consumer, plus the interrupt that gives the semaphore), the small instance is **exact** relative to B2.
- **If S* contains an unbounded number of identical copies** (a ring of N workers passing a token; a barrier over a pool of size N), there's no finite cutoff. Then use the **counter abstraction**:
  - count how many copies sit in each local state;
  - the system becomes a vector addition system (a Petri net);
  - safety becomes **coverability**, which is decidable (Karp–Miller; backward search on well-structured systems).
  - It's exact relative to B2 for any N.

**Condition variables:**
- POSIX and C11 allow **spurious wake-ups**, so a correct model of `wait` is: release the mutex, then later, at any time, re-take it.
- That needs no supplier, so condition variables fit D1.h′ directly. This is sound: it includes every behaviour the standard allows.
- **Lost wake-up** (waiting forever because the signal came before the wait) is invisible under that model. It needs a separate, stricter check:
  - **Assume:** no spurious wake-ups; a signal with no waiter is lost.
  - **Check:** every wait has a supplier of its condition that can still signal after the wait begins.
  - **Hypothesis:** this is to be formalised with the liveness tools of F5 (Büchi automata).

**Interrupt and RTOS fit:**
- An interrupt handler that gives a semaphore or sends to a queue is a supplier, so it's pulled into S*, with its arrival free (A5).
- A thread created only after an event pulls in its creator ("started" place).
- ThreadX and FreeRTOS objects map to the table above (queues, semaphores, event flags, mutexes, task notifications).

**Result:** with D1.h′, every synchronisation construct is now covered:
- **only takers:** by projection;
- **suppliers:** by provider closure;
- **unbounded copies:** by the counter abstraction;
- **lost wake-ups:** by the separate liveness check, still a hypothesis.

### D1 open questions
1. ~~Are our targets mostly single-core?~~ **Answered 2026-10-30: any target.** Hence D1.e–D1.i.
2. ~~Counting classes or listing them?~~ **Decided 2026-10-30, D1.j.**
3. ~~How much of the C11 model to cover first?~~ **Decided 2026-10-30, D1.k.**
4. ~~D1.a and D1.h still need proofs.~~ **Proven 2026-10-31 (D1.a′, D1.h′),** under stated assumptions.

### D1.j Decision: how schedule classes are shown
**Status: Decided (2026-10-30).**
1. **The count** of essentially different schedules is always shown beside the threads in the flow view.
2. **Grouped again by outcome:** schedule classes that end with the same effects (shared values, messages, output) are merged. This is a second quotient, giving *outcome classes*.
3. **Only outcome classes are listed,** worst first: deadlock › race › differing result › identical. Each has one representative run that can be played and stepped in the sequence view, with the point of no return shown where it exists.
4. **About 20 listed, with search;** "all equivalent" when only one class exists.

### D1.k Decision: memory-model scope of the first release
**Status: Decided (2026-10-30).**
- **Full support:** `seq_cst`, acquire/release and their fences, through release → acquire synchronisation in happens-before.
- **Relaxed:** gives no ordering at all. That is sound for races: it can only add alarms.
- **Results that depend on relaxed or consume ordering** (which value a read sees): *can't tell, needs the memory-model check*. `consume` is treated as acquire.
- **`volatile` used as synchronisation:** flagged, per MISRA and CERT. On one core with masking, model M2 applies.
- **Later:** an axiomatic memory-model check (*Herding cats*–style), limited to the regions that use relaxed atomics.

---

## D2. Every pair must close: resource consistency as algebra on the flow (started 2026-10-30)

Covers locks, memory, files and handles, interrupt masking, critical sections, and C++ RAII. One engine serves every "acquire ⇒ release" rule, and D1 uses it to know where each lock is held.

### D2.0 Plain statement
- Give every edge of a function's flow a label: *acquires m*, *releases m*, or nothing.
- Walking a path multiplies its labels together. The result is **what the path is holding** at each point.
- The code is safe when:
  1. **nothing is released that isn't held**, on any path (no double free or double unlock);
  2. **everything is released at exit** (no leak or forgotten unlock), unless ownership was handed on;
  3. a use happens only while the object is held (no use after free or after close).
- **Fast case:** if every path into a point carries the *same* holding, a single linear pass proves all three. When two paths disagree, those **two paths are the evidence**.

### D2.1 The algebra: which labels, which multiplication
**Status:**
- **Known algebra:** the bicyclic and polycyclic monoids (Nivat and Perrot 1970).
- **Adapted:** their use for resources; typestate checking (Strom and Yemini 1986) is the known analysis family.

| Discipline | Algebra | Element means | Error appears as |
|---|---|---|---|
| One resource, counted (recursive mutex, nesting counter such as FreeRTOS `taskENTER_CRITICAL`) | **Bicyclic monoid** B = ⟨p, q ∣ pq = 1⟩, with p = acquire, q = release | qᵐpⁿ: m unmatched releases, n held | m > 0 (release of something not held); n ≠ 0 at exit (leak); n > 1 for a non-recursive mutex (self-deadlock) |
| Several independent resources (order irrelevant) | Direct product B × B × … | One counter pair per resource | As above, per resource |
| Nested, last-in-first-out (RAII, saved interrupt masks, nested critical sections) | **Polycyclic monoid** Pᵣ = ⟨p₁…pᵣ, q₁…qᵣ ∣ qᵢpᵢ = 1, qᵢpⱼ = 0 for i ≠ j⟩. Element = a stack of held resources, or 0 | A stack of held resources | **0** = released out of order |
| Use requirements (use after free or close) | Not a label: a **condition** at use nodes | — | A use where the resource's held count n = 0 |

**Why monoids and not groups:** in a group, "release then acquire" would cancel to nothing and hide a release-before-acquire bug. In the bicyclic monoid, qp ≠ 1, so the underflow stays recorded. This corrects F1/§4.3 of SKYFLOWX-TASK, which used ℤʳ and free groups (those would miss this bug class).

**Conditional acquisition:**
- **Rule:** an API that may fail acquires only on its **success edge**: after `p != NULL` for `malloc`, after `== 0` for `pthread_mutex_trylock`, after `!= NULL` for `fopen`.
- **API table:** S12 / S5 hold one entry per API: what it acquires, on which outcome, and what releases it.

**Ownership transfer:**
- Storing the handle in a global or a structure, returning it, or passing it to a function that takes ownership is a **transfer** edge: locally a release, plus an obligation recorded in the function summary ("returns ownership of m").
- A leak is reported only where no transfer happened.

### D2.2 The fast exact check: potentials on a spanning tree
**Status: Adapted, our formulation; proof below.**

**Theorem:** let G be a flow graph where every node is reachable from entry, w a labelling of the edges by a monoid M, and T a spanning tree rooted at entry. Define φ(entry) = 1, and φ(v) = φ(u)·w(u,v) along the edges of T. Then **these are equivalent:**
- (a) every path entry → v has the same product, for every v;
- (b) φ(u)·w(u,v) = φ(v) for **every** edge (u,v), the tree edges by construction and the non-tree edges by check.

**Proof:**
- (b) ⇒ (a): for any path entry = v₀ → v₁ → … → vₖ, induction on i using (b) gives w₁⋯wᵢ = φ(vᵢ).
- (a) ⇒ (b): φ(u)·w(u,v) is the product of a path to v, so it equals φ(v).
- No inverses are used, so this holds for any monoid. ∎

**Cost:** one pass to build T, one check per non-tree edge, so O(E) monoid operations. Bicyclic elements are two integers and polycyclic elements are short stacks, so each operation is effectively O(1).

**When (b) holds,** safety reduces to local checks:
- no φ(v) contains an unmatched release, and none is 0;
- φ(exit) = 1, apart from recorded transfers;
- every use node has its resource held.

That is a **proof of correctness** for this function, in linear time.

**When (b) fails at a non-tree edge (u,v):** the tree path to v and the tree path to u followed by (u,v) are **two paths with different holdings**, the exact evidence. The fault is localised to the fundamental cycle of that edge.

### D2.3 Worked example: freed on one branch only
```c
int f(int n) {
  char *p = malloc(n);      // acquires p, on the success edge of the check below
  if (!p) return -1;        // nothing held on this path
  if (bad(p)) return -2;    // still holding p
  use(p);
  free(p);                  // releases p
  return 0;
}
```
- **The three returns:**
  - `return -1` holds 1, which is fine.
  - `return -2` holds **p**, a leak.
  - `return 0` holds p·q = 1, which is fine.
- **The check:** at the shared exit, (b) fails on the `return -2` edge.
- **The evidence:** the `return -2` path versus the `return 0` path. φ(exit) ≠ 1 on that path, so it's a **proven** leak on that branch.
- **In the flow view:** a thin "held" band beside the steps from `malloc`. It continues to `free` on one route and is **cut off at `return -2`** on the other (D2.7).

### D2.4 Branches that agree with each other: lifting to a cover
**Status: Hypothesis (ours, in this form).** Known relatives: path-sensitive typestate (ESP: Das, Lerner and Seigle 2002), predicate abstraction, and counterexample-guided refinement (CEGAR: Clarke et al. 2000).

**The false-alarm pattern every tool meets:**
```c
if (flag) lock(m);
work();
if (flag) unlock(m);
```
- After the first `if`, the two paths disagree (holding m or not), so (b) fails, yet the code is correct.
- The two branches are *correlated*: they test the same `flag`.

**Topological view:**
- **Holonomy:** walking around the loop formed by the two diamonds gives a non-trivial result, so the labelling has holonomy on the base graph.
- **The lift:** build a **lift** Ĝ whose nodes are (v, σ), where σ is the value of the predicates involved (here, `flag`). Edges are kept only when σ allows them.
- **Result:** on each sheet (flag = 1, flag = 0) the potential exists. The holonomy **disappears in the lift**, and the code is proven correct.

**The claim:**
1. **Picking predicates:** take them only from the branch conditions on the **failing fundamental cycle**. The obstruction tells us exactly which predicates matter.
2. **Repeat:**
   - lift, then re-check with D2.2
   - add predicates while a failing cycle remains
   - stop when it passes (**proven**), when a failing cycle is feasible on every lift (**proven bug**), or when the budget runs out (**possible**, with the two paths)
3. **Soundness:** lifting only removes infeasible paths, and it relies on S5/S7 facts (e.g. `work()` doesn't write `flag`, `flag` isn't shared with another thread). If those facts can't be proven, no lift happens and the finding stays *possible*.

**To prove or measure:**
- (i) termination and soundness of the refinement loop;
- (ii) on ThreadX and tinyhttp, the share of functions passing D2.2 with no lift (we expect most), and with one predicate;
- (iii) the false-alarm rate compared with a plain path-insensitive check.

### D2.5 Across functions
**Status: Adapted** (summary-based interprocedural analysis is known: IFDS/IDE; the summary-as-monoid-element form is ours).

**Summaries:**
- If a function passes D2.2, its effect is **one element**, φ(exit). For example, `lock_wrapper()` = p_m, and `get_buffer()` = "returns ownership".
- A call edge is labelled with the callee's element, so composition is just multiplication.
- **Otherwise,** the summary is a small **set** of elements, one per lifted sheet or return-path class. Callers check every element, or lift on the callee's return value when the sheets depend on it (e.g. "acquired iff it returns 0").

**Recursion:** an SCC of the call graph needs a fixpoint over these sets. If a counter grows on every round, the recursion acquires without bound, and that is reported.

**Extra exit edges, from clang's CFG:**
- **C++ exceptions:** every call that may throw gets an edge to its landing pad or to exit.
- **RAII:** destructors on normal and unwinding edges are release labels, so a lock guard is proven balanced on *every* exit, including throws.
- **`longjmp`:** an edge to the matching `setjmp`. Anything held across it is reported, per MISRA's ban and CERT.
- **`noreturn` functions** (abort, a reset handler): the path ends with no exit requirement.

### D2.6 What it gives D1, and a correction to D1
**Status: Adapted. The must/may split is required for soundness.**
- **Held windows:** D1 needs, for each thread, *where each lock is held*: the nodes where the holding contains m.
- **Two windows per lock, for opposite reasons:**
  - **Must-hold** (m held on *every* path into the node) feeds the **race** check. Over-stating protection would hide races, so races use the smallest windows.
  - **May-hold** (m held on *some* path into the node) feeds the **deadlock** check. Corners need possible holding, so deadlocks use the largest windows.
- **Agreement:** when D2.2 passes, must = may, and both are exact.
- **Correction:** D1.0's "forbidden block" is drawn from must-hold windows for races and from may-hold windows for deadlocks.

### D2.7 Visual idea: the held band
**Status: our design idea; mock up first.**
- **The band:** in the sequence and boxes views, each held resource is a thin lane beside the steps. It starts at the acquire and ends at the release.
- **Breaks:**
  - **Leak:** the lane runs off the end of the function at the leaking return, and that tip glows.
  - **Double release:** two release ticks on one lane.
  - **Out of order:** the lanes cross at the 0.
- **The evidence pair:** the two disagreeing paths can be played one after the other.
- **The cover (D2.4):** shown as two faint sheets ("when flag is set" and "when flag is clear"), so the proof itself is visible.

### D2.8 Rules covered
Rule numbers only; the wording is ours.

| Problem | MISRA C | CERT C | CWE |
|---|---|---|---|
| Leak / not released | R22.1 | MEM31-C, FIO42-C | 401, 772, 775 |
| Release of something not held, double free | R22.2 (freeing memory not from the standard allocator) | MEM34-C | 415, 765 |
| Use after release or close | R22.6 (FILE after close) | MEM30-C, FIO46-C | 416 |
| Unbalanced locking | the R22 concurrency rules of C:2023 (numbers to confirm from the licensed copy) | CON-series | 667, 764, 765 |
| Lock order (with D1) | Dir 5 (C:2023) | CON35-C | 833 |

### D2 open questions
1. The API table (D2.1): standard C and POSIX first, then ThreadX, FreeRTOS, CMSIS and Zephyr? User-declared APIs through a small annotation file?
2. ~~Structure-field transfers?~~ **Decided 2026-10-31:** reported as "escapes" first; "owned by the structure" tracking (field-sensitive) comes later.
3. D2.4 needs its proof and a measurement before any "proven" result relies on a lift.


---

## F5. Further mathematics that applies (candidates, 2026-10-31)
Each is a known field. "Use" is where it would serve us; whether we adopt it is decided per discovery thread.

| Area | Concept | What it would give | Where | Status |
|---|---|---|---|---|
| Linear algebra | **Petri-net invariants:** the kernel of the incidence matrix (yᵀC = 0) | Conservation laws found automatically, e.g. "buffer items + free slots = N"; T-invariants = repeatable cycles; siphons and traps give deadlock certificates | D1, D2, S12 | Known (Lautenbach; Murata 1989) |
| Linear algebra | **Farkas' lemma / linear programming** | Generates linear loop invariants; proves bounds | S7 | Known (Colón, Sankaranarayanan and Sipma 2003) |
| Convex geometry | **Ranking functions** found by LP | Proofs that loops terminate (or the reason they don't); bounds for timing analysis | S7, S3 | Known (Podelski and Rybalchenko 2004) |
| Graph theory | **Treewidth**: structured C programs have treewidth ≤ 6 | Many problems that are hard in general become **linear** on tree decompositions, including faster path algebra | S4–S7 speed | Known (Thorup 1998; Chatterjee et al. 2015) |
| Matroids | The **graphic matroid**: greedy gives optimal bases | The best basis paths (most likely or cheapest) and optimal probe placement come out exactly by greedy choice | S3, S9 | Known (Ball and Larus use a maximum spanning tree) |
| Automata | **Büchi automata, LTL/CTL** | Liveness: "every lock is eventually released", "a task isn't starved" | D1, S12 | Known (model checking) |
| Automata | **Visibly pushdown automata** | Call/return matching with closure properties, for D2 across functions | D2.5 | Known (Alur and Madhusudan 2004) |
| Logic | **SAT/SMT and Craig interpolation** | Checks whether a path is feasible; discovers invariants and predicates for D2.4 lifts | D2.4, S7, S11 | Known (McMillan 2003) |
| Algebra | **Kleene algebra with tests** | Proves two code versions equivalent; "what a change does" | Later analyses | Known (Kozen 1997) |
| Groups | **Burnside's lemma, orbits** | Counts essentially different schedules under thread symmetry | D1.h, D1.j | Known |
| Combinatorics | **Möbius inversion, inclusion–exclusion** | Counting paths and classes without listing them | D1.j, S3 | Known |
| Real-time theory | **Response-time analysis** (a fixed point: R = C + Σ⌈R/Tⱼ⌉Cⱼ) and rate-monotonic bounds | Whether every task meets its deadline, which ties D1's priorities to timing | S12 | Known (Liu and Layland 1973; Joseph and Pandya 1986) |
| Max-plus algebra | Longest paths, tropical matrices | Worst-case stack depth; worst-case path length | S12, S3 | Known |
| Spectral graph theory | **Laplacian, Fiedler vector, heat kernel** | Clusters and layout for huge projects; ranking impact by "heat spread" from a change | SkyCodeX views; impact analysis | Known; use is ours |
| Probability | **Bayesian ranking of findings** | Most-likely-real findings first, learned from user confirmations | S14 UX | Known (Kremenek and Engler 2003) |
| Numerical analysis | **Affine arithmetic, zonotopes** | Bounds on floating-point rounding error | S7, MISRA float rules | Known (Fluctuat) |
| Coding theory | **CRC over GF(2)** | Integrity of probe data from targets | S10 | Known |
| Process algebra | **Bisimulation** | Minimises state spaces; checks two versions behave the same | D1, later analyses | Known (Milner; Park) |
| Order theory | **Denning's security lattice, noninterference** | Secret or safety-critical data must not influence lower-level outputs | S6 | Known (Denning 1976) |
| Topology | **Discrete Morse theory** | Shrinks complexes while keeping their loop structure, so D1's state spaces get smaller | D1.d | Hypothesis (use) |
| Topology | **Sheaves** | Cross-file consistency as gluing | D3 (next) | Hypothesis (use) |
| Topology | **Persistent homology** | Stable zoom levels | SkyCodeX folding | Hypothesis (use) |


---

## D3. Verified improvement suggestions: a repair engine (started 2026-10-31)

**Goal:** for every finding, suggest a concrete change that is **proven** to fix it, proven not to create anything new, and proven to change behaviour only where intended. Otherwise the suggestion is clearly labelled as not proven.

### D3.0 Principle: propose freely, verify strictly
**Status:** Adapted. Static-analysis-verified repair is known: FootPatch (van Tonder and Le Goues, ICSE 2018) repairs leaks and null errors and checks the result with the analyser. Learned fix patterns are known too: Getafix (Facebook), and clang fix-its.
- A suggestion can come from anywhere: a rule's template, a synthesis algorithm (D3.2), the project's own idiom, or an AI model.
- **Offline (decided 2026-10-31):** every generator and verifier runs locally. An AI generator is optional, off by default, and allowed only as a local model.
- **Reliability comes only from verification,** never from the source of the suggestion. The verifier is the same SkyFlowX engine, with certificates (P1).

### D3.1 Proof obligations for every suggestion

| # | Obligation | How it is discharged |
|---|---|---|
| O1 | **Fixes the target:** the finding is gone | Re-analysis of the patched code yields a pass certificate for that rule at that place (P1) |
| O2 | **Nothing new:** Findings(after) ⊆ Findings(before) \ {target}. **Corrected by O2′ (D3.11, R-55):** findings in code proven unreachable before the fix are *uncovered*, listed, not blocking | Incremental re-analysis of the affected region, equal to a full run by P5 |
| O3a | **Refactoring: behaviour preserved** | Structural preconditions (D3.2.4), or translation validation of the region by SMT (Necula 2000; Pnueli, Siegel and Singerman 1998) |
| O3b | **Bug fix: change confined** to the defective paths | The confinement theorem (D3.3) |
| O4 | **Tests and coverage:** existing tests pass and coverage isn't reduced | Run the S11 tests and S9 coverage |
| O5 | **Fits the project's style** | Ranking only: the project's most frequent idiom for this fix (`goto cleanup`, RAII, early `free`). Never a proof |

**Labels shown to the user:**
- **Verified fix:** O1, O2 and O3 proven.
- **Candidate fix:** some obligation open, and which one is shown.
- **Needs your intent:** the right fix depends on meaning the code doesn't state (e.g. what initial value a variable should have). Options are offered, never auto-chosen.

**Nothing is applied automatically.** SkyCodeX shows the diff and plays the flow before and after.

### D3.2 Synthesis from the mathematics we already have
Each fix is computed from the finding's own evidence, not pattern-matched.

**D3.2.1 Leaks and unbalanced pairs (from D2):**
- **The gap:** the evidence pair shows which paths end holding pⁿ.
- **Placement:** put the release on those paths at the **latest point where the resource is still live and the earliest point after its last use**. This is computed by liveness, in the manner of lazy code motion (Knoop, Rüthing and Steffen 1992), which is provably optimal in placement.
- **Verification:** after insertion, D2.2's potential exists. That *is* the O1 certificate.
- **Variant:** if several exits leak, suggest consolidating them into one cleanup point (`goto` cleanup in C, RAII in C++), whichever the project uses (O5).

**D3.2.2 Deadlocks from lock order (from D1):**
- **The fix:** a global order of locks, derived from the lock-order graph by removing a **minimum feedback arc set**. That's NP-hard in general, but lock graphs are small, so it's solved exactly.
- **Theorem:** if every thread acquires locks consistent with one total order, there's no wait-for cycle, so there's no deadlock. In D1's picture, the blocks nest.
- **The suggestion:** reorder the acquisitions that violate the order, at the fewest sites.

**D3.2.3 Interrupt races (from D1.a′ / A22):**
- **The minimal critical section:** mask from the first to the last access of W, and no more. By Theorem 1 that's exactly what removes every enabled gap inside W, and anything smaller leaves one.
- **Alternatives:**
  - a single access wider than the bus → make it atomic;
  - flag synchronisation → insert the missing compiler barrier or fence (A9).
- **Cost shown:** the length of the masked window (interrupt latency), so you can choose.

**D3.2.4 Complexity: extract a region, with the result predicted exactly (from batch 2):**
- **The candidates:** each canonical single-entry/single-exit region of the program structure tree.
- **Theorem (exact prediction):** collapsing a region R into a call gives V(G′) = V(G) − (V(R) − 1).
  - **Proof:**
    - R has N_R nodes and E_R internal edges; collapsing it gives N′ = N − N_R + 1 and E′ = E − E_R.
    - So V′ = E′ − N′ + 2 = V − (E_R − N_R + 1) = V − (V(R) − 1), where V(R) = E_R − N_R + 2. ∎
  - **Use:** the suggestion states the **exact** new complexity of both functions before you accept it.
- **Behaviour preservation (O3a):** the new function's parameters and returns come from information flow.
  - **Parameters:** the uses inside R that come from definitions before it.
  - **Returns:** the definitions in R that are live after it.
  - **Preconditions** (Opdyke-style): no address of a local escapes R; no `goto`/`return` leaves R (guaranteed by single entry and exit); `setjmp` excluded.
- **Choice:** pick the set of regions that brings the function under the threshold with the fewest extractions.

**D3.2.5 Essential type and conversion rules (from A09):**
- **The fix:** the cast or type change the essential type fold makes necessary, computed deterministically.
- **Verification:** O1 by re-check.
- **Value safety:** where the cast could change a value (narrowing), O3 needs a value proof (S7). Without it, the fix is a **candidate**.

**D3.2.6 Unused code:** removal is suggested only for **proven** unused code, the lower end of the P8 interval.

**D3.2.7 Data-flow anomalies:**
- **Dead stores:** removal, verified by liveness and by the absence of side effects in the removed expression.
- **Use before set:** always **needs your intent**. We show where an initialisation could go, never guess a value, because guessing would hide the bug.

### D3.3 Confinement theorem (bug fixes, O3b)
**Status: Candidate (ours, as a stated obligation).**
- **Statement:** let the edit insert or change only nodes in a set Δ. If every node in Δ lies **only** on paths that exhibit the finding (the witness paths), and on **no** path that doesn't, then every non-defective execution is unchanged.
- **Proof:** an execution that doesn't exhibit the finding follows a non-defective path, which contains no node of Δ, so it executes the same statements in the same order as before. ∎
- **Check:** reachability. Δ ∩ (nodes on any non-defective entry→exit path) = ∅. Computed by forward reachability from entry and backward reachability to exit, restricted to non-defective paths. Where path-defectiveness depends on predicates, the D2.4 lifts are used.
- **When it fails:** e.g. the fix has to sit on a shared path. The suggestion is then labelled "changes shared behaviour", with the shared paths listed.

### D3.4 What the user sees (to mock up first)
- **Beside each finding:** "Fix ✓ verified", "Fix ◐ candidate (O3 open)" or "Needs your intent".
- **A preview** with the diff, the **flow before and after** (the held band now closed, the deadlock corner gone, the complexity figure changing from 23 to 9), and the list of discharged obligations.
- **On accept:** the edit is applied in the editor, then re-analysed. The finding should disappear, which confirms O1 live.

### D3.5 Position
- **The concept** (verified repair) is **Known**.
- **Candidates:**
  - the confinement obligation;
  - the exact complexity prediction for region extraction;
  - optimal release placement by lazy-code-motion-style analysis on D2 potentials;
  - minimum-change lock ordering through a minimum feedback arc set;
  - the "propose freely, verify strictly" contract, which makes AI-generated suggestions safe to offer.
- **To verify:** prior art for each (FootPatch, Getafix and automated program repair surveys).


### D3.6 An AI-free repair engine: research and design (2026-10-31)
**Question:** without any AI, can repair be robust and reliable, using deviations (edit permutations), probability or fuzzy logic, with search reduced through homomorphisms? **Answer: yes.** It is strongest for the property violations SkyFlowX finds, and reliable relative to the tests for functional bugs.

#### D3.6.1 Prior art found (all non-neural, all offline-capable)

| Work | Idea | Relevance |
|---|---|---|
| MemFix (Lee, Hong and Oh, FSE 2018) — [paper](https://prl.korea.ac.kr/papers/fse18.pdf) | Leak, double-free and use-after-free repair reduced to **exact cover**, solved by SAT; sound, so patches fix the error without adding new ones; fixed all such Juliet cases. Limits: function pointers, recursion, path explosion ([AddressWatcher](https://arxiv.org/html/2408.04764v1)) | Closest prior art for D2 repairs |
| SAVER (Hong, Lee, Lee and Oh, ICSE 2020) — [paper](https://prl.korea.ac.kr/papers/icse20.pdf) | Object flow graph; repair as **graph labelling**; conditional deallocations; ~75% of Infer-reported memory errors fixed | Conditional fixes, like our guarded fixes from lifts |
| Test-equivalence analysis (Mechtaev, Gao, Tan and Roychoudhury, TOSEM 2018) — [arXiv](https://arxiv.org/pdf/1707.03139), [f1x](https://www.github.com/mechtaev/f1x) | Partition candidate patches into **equivalence classes** by runtime values or dependencies; test one per class; at least 10× faster | The "homomorphic reduction" idea, applied dynamically |
| SemFix (ICSE 2013) and Angelix (ICSE 2016) — [SemFix](https://www.comp.nus.edu.sg/~abhik/pdf/ICSE13-SEMFIX.pdf), [Angelix](https://www.comp.nus.edu.sg/~abhik/pdf/ICSE16-angelix.pdf) | Symbolic execution gives repair constraints ("angelic values"); SMT-based synthesis | Functional bugs without AI |
| Prophet (Long and Rinard, POPL 2016) — [paper](https://people.csail.mit.edu/rinard/paper/popl16.pdf) | A log-linear **probabilistic** model ranks candidates; SPR's staged search ([SPR](https://groups.csail.mit.edu/pac/patchgen/papers/spr-fse15.pdf)) | Probability used for ranking only |
| Fuzzy-AutoRepair (Ghanati, Parsa and Izadkhah, 2025) — [article](https://jdscm.atu.ac.ir/article_21574.html) | **Fuzzy** learning-to-rank of repair-pattern families (C/C++). Its journal dates look inconsistent, so check before citing | Fuzzy ranking exists; ours needs no learning |
| Repair survey — [arXiv 2211.12787](https://arxiv.org/pdf/2211.12787) | Overview of search-, semantics- and learning-based repair | Background |

#### D3.6.2 The design: five layers, no AI anywhere
1. **R1, localisation:**
   - **SkyFlowX findings:** the witness itself (the failing cycle, the evidence pair, the window W).
   - **Failing tests:** spectrum-based ranking (Ochiai, Tarantula). This is counting, not learning; Known.
2. **R2, deviation space:** a finite, typed grammar of edits:
   - insert, delete or move a release;
   - reorder acquisitions;
   - widen or narrow a mask window;
   - add a guard;
   - add a cast or barrier;
   - an off-by-one on a bound;
   - swap arguments;
   - extract a region.
   Compositions of these are the "deviation permutations".
3. **R3, solve instead of search where the algebra allows it (D3.6.3).** Otherwise, search with the reductions of D3.6.4.
4. **R4, verify:** O1–O5 (D3.1). Only verified patches go on.
5. **R5, rank:** probabilistic or fuzzy ordering *of verified patches only* (D3.6.5).

#### D3.6.3 Theorem: leak, double-release and use-after-release repair is an exactly solvable network problem
**Status: Candidate (ours).** It uses D2's potentials. MemFix uses exact cover with SAT (NP-complete); SAVER uses graph labelling.

**Setting:**
- one resource handle, one event per CFG edge;
- w_e ∈ {+1 acquire, −1 release, 0} is the existing label (ownership transfers are already counted as releases, D2.1);
- the unknowns are
  - **n_e ≥ 0**, releases to **insert** on edge e;
  - **d_e ∈ [0, r_e]**, existing releases to **delete** on e (r_e is how many are there);
  - **φ_v**, the potential.

**Constraints:**
- φ_v − φ_u + n_e − d_e = w_e for every edge e = (u, v)
- φ_entry = 0 and φ_exit = 0 (nothing held at the end)
- φ_v ≥ 0 everywhere (no release of something not held)
- φ_v ≥ 1 at every **use** node (no use after release)

**Objective:** minimise Σ c_e n_e + Σ c′_e d_e. The costs encode the preferences: later placement, fewer sites, the project's idiom.

**Theorem:**
- **(a)** The constraint matrix is [Bᵀ | I | −I] with bounds, where B is the CFG's incidence matrix, and it is **totally unimodular**.
- **(b)** So the linear-programming relaxation has an **integral optimum**, found in polynomial time (it is the dual of a minimum-cost flow, solvable with network simplex) with no SAT search.
- **(c)** Every feasible solution is a patch that **provably** removes all leaks, double releases and uses after release of that resource, because the potential exists and D2.2 then proves all three (O1 by construction).
- **(d)** If it is infeasible, no insert/delete-release patch with path-independent holding exists. The engine then lifts (D2.4) and solves the same system on the sheets.

**Proof:**
- (a) Bᵀ (one +1 and one −1 per row) is totally unimodular. Appending unit columns (±I) and simple bounds preserves total unimodularity.
- (b) By Hoffman–Kruskal, a totally unimodular system with integer right-hand sides has integral vertices. Network LPs are polynomial.
- (c) φ satisfies D2.2(b) on the patched labels, and the local conditions are the constraints.
- (d) is the contrapositive of (c)'s construction. ∎

**Guarded fixes from the lift (a projection homomorphism):** a solution on the lifted graph inserts on (e, σ) but not on (e, σ′). Projecting the lift back to the code turns that into **`if (σ) release(…)` at e**: SAVER-style conditional deallocation, derived rather than searched. Correctness holds because σ is, by construction of the lift, the value of program predicates available at e.

**Limits:**
- one handle per resource (aliases choose *which* name to free, which is a textual choice afterwards, not a placement);
- function pointers and recursion are handled by D2.5 summaries; where a summary is a set of elements, one system per element.

#### D3.6.4 Reductions for search-based classes (deviation permutations)
1. **Analysis-equivalence (a homomorphism, Δ1):**
   - Map each patch p to its effect on the property: the **labelled graph** it produces, up to isomorphism fixing entry, exit and use nodes. The verdict of O1/O2 is a function of that image alone, so only one patch per class is verified.
   - **Proof:** factorisation (P4). ∎
   - **Example:** `free(p)` and `free(q)` with p ≡ q produce the same labels, so one check covers both.
   - **Position:** the static counterpart of test-equivalence. **Candidate.**
2. **Commutation quotient:** edits on disjoint text commute, so patches are **sets**, not sequences: k independent edits give 1 candidate instead of k! orderings. Overlapping edits use the trace monoid (Mazurkiewicz) with Foata normal form, one canonical representative per class. **Known** mathematics, applied.
3. **Monotone pruning (version-space style):**
   - adding releases only lowers potentials, so if set S still leaks, every subset of S leaks;
   - if S causes a double release, every superset does too.
   - Downward and upward closed regions are pruned. Proven by monotonicity of the counter under inserted q.
   - **Position:** Refinement (version spaces, Mitchell 1982).
4. **Test-equivalence for functional bugs:** as Mechtaev et al. **Known.**

#### D3.6.5 Probability and fuzzy logic: ordering only, never admitting
- **Theorem (ranking can't break safety):** ranking is a permutation of the **already verified** set, so every patch shown keeps all its proven obligations. Probability or fuzziness affects only **which comes first**. ∎
- **Probabilistic prior, without AI:** counts of the project's own fix idioms (how often each pattern appears in its history and code: the "naturalness" of code, Hindle et al. 2012, as simple frequencies), combined in a Bayesian posterior with the number of obligations proven.
- **Fuzzy grading:** each criterion is a membership in [0, 1]: minimal edit, locality, added interrupt latency, readability, idiom match. They are aggregated by the **minimum t-norm** (Gödel), which is non-compensatory and monotone, exactly like the A13 quality model, so the same proofs apply. The explanation is the criterion that achieves the minimum.
- **Position:** **Refinement** (Prophet uses learned probabilities; Fuzzy-AutoRepair uses learned fuzzy ranking; ours is explicit and needs no training).

#### D3.6.6 Functional bugs (failing tests or requirements)
- **The method:** semantic repair (angelic values plus SMT synthesis, CEGIS) with test-equivalence. No AI, offline, with z3 bundled.
- **The known weakness is overfitting:** patches that pass the tests but are wrong. Ours adds two filters:
  - **O2:** no new static findings;
  - **O3b:** confinement to the failing paths.
- These filters reject a class of overfitting patches that test-only tools accept.
- **Label:** "test-verified, statically checked", never "proof-verified", unless a specification exists.
- **Position:** **Candidate** (as a combination).

#### D3.6.7 Result

| Class | Reliability without AI |
|---|---|
| Leaks, double releases, use after release (D2) | **Proven fix, optimal placement, polynomial time** (D3.6.3) |
| Lock order, interrupt windows, barriers, casts, complexity (D3.2) | **Proven fix**: computed, then verified |
| Correlated-branch cases | **Proven guarded fix** via the lift projection |
| Functional bugs | **Test-verified plus statically checked**; overfitting reduced, never claimed as proof |
| Anything else | Searched with the D3.6.4 reductions; shown only if verified |


### D3.7 Repair-engine growth ledger (standing rule since 2026-10-31)
**Rule:** every atom's improvement is also read for what it gives the repair engine:
- new **fix classes**;
- new **confirmation** (obligations or evidence);
- new **reductions** (less search or less re-checking);
- new **feedback or deduction** hooks.

Every batch ends with its own "Repair contributions" list, and this ledger collects them.

| Atom | Fix classes added | Confirmation added | Reduction added |
|---|---|---|---|
| A01 build variants | — | **O2v:** a fix is re-verified in every build-variant class it touches | Only one check per variant class (quotient) |
| A02 target model | Target-dependent fixes (casts, widths) | Verified under the probed target model; the suggestion states that it depends on the target | — |
| A03 macro root cause | **Fix in the macro body once**, repairing N expansions | All expansions re-verified | N findings become 1 fix |
| A04 parse isolation | — | **Guard:** no fix is offered inside a *can't tell* function | — |
| A05 round trip | — | **O0:** the patch applies to the exact tokens and maps back to the same locations | — |
| A14 CFG | — | Dual-builder check on the patched function; fixes relying on "can't throw" record that dependency and are invalidated if it changes | — |
| A12 metrics | **Restructuring** (goto elimination: Erosa and Hendren 1994), region extraction | **Exact prediction** of V, ev and knots after the fix (D3.2.4) | — |
| A13 quality | — | **Predicted grade change** ("C → B"), exact because the metrics are | Pareto order of which functions to fix first |
| A06 rule containment | **One fix closes several rules** | **Theorem:** if A ⊆ B (CQ containment), fixing a B-instance at a node also removes every A-instance there, because any remaining A-match would be a B-match | Rules whose fixes conflict are flagged before suggesting |
| A09 essential types | Cast and type fixes from the exhaustively verified table | Correct for every category combination | — |
| A10 sandwich | "Verified fix" only for **proven** violations; "fix if real" for possible ones | O1 must use the **sound** side (the over-approximation), so "fixed" is never claimed from the under-approximation | — |
| A11 deviation fingerprints | — | A rejected fix with a recorded deviation is **not re-suggested** for that fingerprint | Fewer repeated suggestions |
| A15 call graph | Fix in the caller or the callee (choice via summaries) | A fix must hold for **every** candidate target (P8 interval) | — |
| A16/A21 monoid engine | Resource fixes as an exact network LP (D3.6.3, for counter monoids); finite transition monoids as a small finite constraint problem | The pass certificate of the same engine | One synthesiser for all regular path properties |
| A18 information flow | Parameters and returns for extraction | Confinement via dependence cuts | — |
| A19 coupling | **Test suggestions** for couplings not yet exercised | — | — |
| A20 verified blame | **Guard or assertion** fixes at the blamed merge; the guard predicate comes from the split | Value proof (S7) | Blame narrows where to edit |
| A22 flag sync | Barrier/fence insertion, minimal mask window | Theorem 1′ re-checked | — |
| A27 MC/DC | **Test suggestions with concrete inputs** (feasibility proven by SMT) | Each suggested vector completes its pair | — |
| A31 object code | Compiler-option suggestions (e.g. disabling jump tables) | Verified by recompiling: the untraceable set must shrink | — |
| A32 carry-over | — | O4 reruns only the tests that ran changed code | Fast O4 |

**Rows from later batches:** batch 6 is in the A.4f "repair contributions" table; batch 7 is in the A.4g table; batch 8 is in the A.4h table; the deep re-read of batches 1–5 is D3.9; fixes that affect each other are D3.11.

### D3.8 Confirmation, feedback and deduction, without AI
**Confirmation (every applied fix):** the patched code is re-analysed live. O1 must show the finding gone, and the result goes into an **evidence trail** (finding, patch, discharged obligations, certificates, date, who accepted it). That trail is the change record certification needs.

**Feedback (counts only; affects ranking, never admission, by D3.6.5):**
- **Outcomes recorded:**
  - accepted;
  - edited then accepted (the final diff is stored);
  - rejected, with a reason chosen from a short list: wrong place, style, changes behaviour, intended as is, other.
- **Bayesian (Beta–Bernoulli) counts** per (fix class, idiom) update the ranking prior.
- **Accepted fixes become project templates:** the verified final forms are generalised by **anti-unification** (Plotkin 1970, least general generalisation), which is deterministic. Prior art: Getafix uses hierarchical anti-unification. **Known**, used without learning.

**Deduction (feedback becomes logic):**
- **"Intended as is"** is turned into an **annotation**, e.g. "this resource is owned by a global cache", stored in the annotation file (D2 open question 1). Analysis and future fixes then respect it, and it is visible and reviewable.
- **Project constraint store:** decisions implied by accepted fixes are recorded as constraints:
  - a lock order chosen in one fix (a < b);
  - a mask discipline;
  - an ownership convention.
  - Every later suggestion must be **consistent** with the store (checked like O2). A contradiction is flagged rather than silently overridden.
  - **Theorem:** if every accepted fix is consistent with the store and the store is consistent, the store remains consistent. Each fix is checked against the store before it's accepted. ∎
- **"Changes behaviour" rejections** become a stated invariant or test that later fixes must satisfy (it's added to O3/O4).

**Why this reduces future work:**
- fewer repeated suggestions (fingerprints);
- fewer candidates (templates and constraints prune the space);
- fewer re-checks (the variant quotient and carry-over);
- one fix closing several rules (containment).

Each new atom only adds rows to D3.7.


### D3.9 Deep re-read of batches 1–5 for the repair engine (2026-10-31)
D3.7 listed one row per atom. This goes deeper: new **synthesis methods**, **theorems**, **reductions**, and what different atoms give **together**. Labels: **R-n** = repair result n. Positions follow the register.

#### Batch 1, the foundation

**R-1 Build variants as sheets: guarded fixes across configurations (A01 + D2.4).**
- Build-variant classes form a **cover** of the code, just as D2.4's predicate lifts do. Each variant class is a sheet.
- A finding present on some sheets only gets a fix that is:
  - **unconditional**, if it verifies on **all** sheets (preferred);
  - otherwise **guarded by the presence condition** (`#if …`) of the sheets where it's needed, using only macros the file references.
- **Theorem:** a guarded fix is correct on every variant. On sheets inside the condition it's the verified fix; on the others the code is unchanged.
  - **Proof:** preprocessing removes the guarded text outside the condition, so those token streams are byte-identical to before (A01 quotient). ∎
- **Localisation by configuration delta debugging:** when a finding appears only in some variants, the minimal set of macro differences that triggers it is found with ddmin (Zeller and Hildebrandt 2002), which pinpoints the variant-specific code to fix.
- **Position:** **Candidate** (the unified cover view); ddmin is **Known**.

**R-2 Target-dependent rewrites with proof (A02).**
- **Portability fixes:** a finding that exists only under some target models (e.g. overflow where `int` is 16 bits) gets an exact-width type fix (`int32_t`), re-verified under **every** target model the project declares.
- **Replacing implementation-defined behaviour:** for code relying on, say, the right shift of a negative number, an alternative is synthesised and proven **equal under the probed facts** of each target by SMT. The facts are the probe constants, so the proof is about the real compiler.
  - Unequal on some target → "needs your intent", with the differing targets shown.
- **Position:** **Candidate.**

**R-3 Macro fixes: once in the body, or a macro turned into a function (A03).**
- **Fix in the body:** verified at every expansion. Expansions with identical canonical surrounding context share one check (P4).
- **New fix class: function-like macro → `static inline` function** (as MISRA Dir 4.9 advises). It preserves behaviour **only** if, for every use:
  - each argument is evaluated exactly once in the macro body, or every argument is free of side effects;
  - argument types are consistent across uses, or the function is generic through `_Generic`;
  - the macro isn't used in `#if`, as an lvalue, or with token pasting or stringising.
  - **Proof:** under these conditions, a call evaluates each argument once, just like the expansion, and computes the same expression. ∎ Otherwise it's a **candidate**, with the failing condition named.
- **Location rule:** patches touch only **spelled** tokens. A finding inside an expansion is fixed in the macro body or in the argument's spelling, never in generated text (O0).
- **Position:** **Refinement.**

**R-4 Configuration repairs (A04 + A01 + A02).**
- Parse failures caused by setup (a missing include path, a missing define, an unsupported extension) get **configuration fixes**: candidates come from the project (directories with that header, `#define` sites, dialect flags).
- Verified by: the file now parses with no diagnostics, and no other file's token stream changes unexpectedly.
- **Position:** **Refinement.**

**R-5 Patch locality and minimal diffs (A05).** Edits are replacements of token ranges, mapped back by the round trip. Formatting is applied only to changed lines with the project's own style file, so diffs stay minimal and reviewable.

**R-6 Early cutoff: re-verification bounded by summary changes (A14 + D2.5 + P5).**
- After a patch, only the patched function is re-analysed. If its **summary** is unchanged (the D2 element, the effects, the may-throw flag, the information-flow matrix), **no caller is re-analysed**. Otherwise the change propagates up the call graph only while summaries keep changing.
- **Theorem:** the result equals a full re-analysis.
  - **Proof:** a caller's analysis depends on a callee only through the callee's summary (the summaries are the interface), so an unchanged summary means identical caller inputs and an identical caller result (P5). ∎
- **Effect:** O2 costs roughly the patched function plus the cone of changed summaries, usually one function.
- **Position:** **Known** in build systems ("early cutoff"); applied to repair verification it's a **Refinement**.

**R-7 Exceptions and `noexcept` (A14).**
- **O2:** a fix that adds a call in C++ must add that call's exception edges if it may throw, and O2 checks the new paths.
- **New fix class:** add `noexcept` to functions **proven** never to throw (the least fixpoint). It preserves behaviour because they can't throw, so `std::terminate` is unreachable. It also removes edges for every caller, so fewer false alarms elsewhere.

#### Batch 2, metrics and quality

**R-8 Every suggestion shows its exact metric and test cost (A12).**
- ΔV for **any** patch, by Lemma 2: ΔV = Σ over changed decision nodes of Δ(out-degree − 1). A guard adds +1; an extraction subtracts V(R) − 1.
- The change in the exact path count (incremental dynamic programming) and in **T_branch** (minimum flow recomputed locally) are shown too.
- **Ranking:** prefer fixes that don't raise complexity or test cost.
- **Position:** **Candidate** (exact impact shown per suggestion).

**R-9 Structuring fixes aimed exactly (A12.2).**
- The program structure tree identifies exactly the canonical regions that **can't be collapsed**, which are the unstructured parts.
- Goto elimination (Erosa and Hendren 1994) is applied **only there**.
- The new ev is predicted exactly from the program structure tree.
- **Equivalence (O3a):** translation validation, a bisimulation between the old CFG and the new CFG with its flag variables, checked by SMT on the region.
- **Single exit (MISRA R15.5):** multiple returns become a result variable plus one exit. It preserves behaviour when there's no code with side effects between each return and the end (otherwise those statements are moved under guards). V and ev are predicted.

**R-10 The minimum flow gives the test skeletons (A12.6).**
- Decomposing the minimum flow into T_branch entry→exit walks gives the **smallest set of path skeletons** that covers every branch.
- These are the goals passed to A39. SMT turns each into inputs, or proves it infeasible.
- **Position:** **Known** (Ntafos and Hakimi path covers); used here as the bridge from metrics to tests.

**R-11 Precision repairs: code changes that make analysis exact (A12.7 P8 + A10).**
- **The fix class:** changes that **narrow intervals** or turn **possible** into **proven**. Examples:
  - `const`-qualify a function-pointer table that is never written (MISRA R8.13 favours `const`). It preserves behaviour when a sound write analysis finds no write to the table, and it makes the call graph exact.
  - replace a pointer dispatch with a `switch` when the table's contents are constant;
  - add an `assert` or annotation at the merge blamed in A20, so the analysis can split there.
- **Ranking:** by the rise in **proof coverage** (A10). These fixes improve the analysis as well as the code.
- **Position:** **Candidate.**

**R-12 The bottleneck theorem: where to search for quality fixes (A13).**
- **Theorem:** grade G = minᵢ gᵢ rises **only** if every metric at the minimum improves.
- **Proof:** if any minimising gⱼ stays the same, G stays the same. ∎
- **Reduction:** grade-raising suggestions are searched **only** among the functions and metrics at the bottleneck. Everything else is skipped, with that reason shown.

#### Batch 3, rules

**R-13 Templates checked before any site (A06).**
- **Pre-screening:** for a fix template with "after" pattern P and any rule C, if C's query has a homomorphism into P's canonical database, **every** application creates a C violation, so the template is rejected once, globally.
  - **Proof:** any instance contains P, and homomorphisms compose. ∎
- **Verify once for local rules:** call a rule **local** when every match lies inside a subtree of bounded depth around its anchor. If the template replaces that whole subtree and its after-pattern has **no** match of rule A, then no A violation remains at that anchor after **any** application.
  - **Proof:** a new match at the anchor would have to lie inside the replaced subtree, which is the after-pattern, and that has none. ∎
  - Per site, only O2 remains, which is cheap through R-14.
- **Position:** **Candidate.**

**R-14 Incremental re-checking of rules (A07, A08).**
- Lexical rules re-scan only the patched token range plus the automaton's look-behind.
- Syntactic rules re-run the bottom-up tree automaton only on the **ancestors** of the patched subtree: O(depth).
- **Proof:** a bottom-up state depends only on its subtree. ∎
- **Position:** **Known** (incremental attribute evaluation).

**R-15 The fewest casts for essential-type rules (A09).**
- **Synthesis:** choose cast positions in the expression tree so that every R10 constraint holds, with the fewest casts, by **dynamic programming over the tree** (the fold): state = the essential type at the node.
- **Theorem:** the dynamic programming result is optimal.
  - **Proof:** each constraint relates a node to its children only, so the problem has optimal substructure on a tree. ∎
- **Cost:** O(nodes × categories).
- **Value safety:** a narrowing cast costs **∞** unless S7 proves the value fits, so a fix that could change a value is never proposed as verified.
- **Position:** **Candidate.**

**R-16 Unsequenced side effects: verified only when the order doesn't matter (A09/R13).**
- A fix must choose an order.
- If **all** permitted orders give the same result (SMT, or the operations commute), any order is a **verified fix**.
- Otherwise it **needs your intent**, with each order's outcome shown, because the original code was undefined behaviour and the intent can't be deduced.

**R-17 Identifier collisions: the minimum renames (A10 + A17).**
- Colliding identifiers form **equivalence classes** (same significant prefix), so the collision graph is a union of cliques.
- **Theorem:** the minimum number of renames is Σ(k − 1) over the classes of size k.
  - **Proof:** within a clique, all but one must change, and changing k − 1 is enough. ∎
- New names are checked against the prefix hash set, so no new collision.
- Renaming uses USRs (A17), so every reference is updated.
- Names built by token pasting (`##`) make a rename a **candidate**.

**R-18 Deviations as an outcome, and their retirement (A11).**
- **Pre-filled deviations:** when a fix needs intent or is too costly, the engine offers a **deviation record** pre-filled with the evidence (witness, proof coverage, why no fix verified).
- **Stale deviations:** when code changes so that a deviated finding disappears, it suggests **retiring** the deviation (by fingerprint).

**R-19 Cross-file declaration fixes (A10 buckets).**
- Incompatible declarations of one name (a union-find class) get "make the minority match the definition".
- If there's no definition, or the declarations split evenly, it **needs your intent**.
- Verified by re-unifying only that bucket.

#### Batch 4, flow

**R-20 Certificate-incremental verification (A20 + D2.2 + P1): the biggest reduction.**
- **Rule:** after a patch, first **re-validate the old certificate locally**. Re-analyse only if that fails.
- **D2 potentials:** check condition (b) only on edges whose labels changed, plus the tree edges if the spanning tree must change.
- **Invariants:** re-check inductiveness only for the statements edited and the loop heads they reach.
- **Theorem:** if the old certificate is still valid for the patched code, the old verdict holds.
  - **Proof:** a certificate's validity is a conjunction of local conditions. Unedited conditions have unchanged inputs and still hold, and the edited ones were re-checked. ∎
- **Effect:** most O1/O2 checks become O(size of the edit).
- **Position:** **Candidate.**

**R-21 Information-flow repairs at a minimum cut (A18): freedom from interference.**
- **The problem:** when a requirement says output o must **not** depend on input i (e.g. ISO 26262 freedom from interference between partitions, or a safety-critical output shielded from a QM input) and dependence paths exist, where should the code change?
- **Theorem (Menger):** the minimum number of statements to change so that no dependence path from i to o remains equals the maximum number of node-disjoint paths. A **minimum vertex cut** achieves it, computable by max-flow.
  - Any fix must touch at least one node on every path, which gives the lower bound; the cut meets it. ∎
- **The suggestion:** the exact cut locations, which **need your intent** for *how* to change each one, but the locations are proven necessary and sufficient.
- **Position:** **Candidate (strong** for automotive partitioning).

**R-22 API-level fixes deduced from many callers (A15 + D2.5).**
- If at least k callers misuse an API the same way (e.g. ignore that it returns ownership), the engine suggests an **API change** (take ownership, return by value, RAII wrapper) instead of k caller fixes.
- It **needs your intent**, with the k witnesses as evidence.
- Every candidate target of an indirect call must satisfy the fix (P8).

**R-23 Data-flow anomaly fixes (A16).**
- **DU (dead store):** removed when the right-hand side has no side effects.
- **DD:** the first definition is removed under the same condition.
- **UR on all paths (a certain bug):** the initialisation **placement** is computed (the nearest common dominator of the uses that comes before any definition), but the **value needs your intent**.
- **Finite transition monoids:** the general monoid-repair problem is a small finite constraint problem (states per node, edits per edge) solved exactly. The polynomial-time LP of D3.6.3 holds for the counter (bicyclic) family.

**R-24 Error-handling idiom deduced from the project (A20 + D3.8).**
- Guards and bound checks need an **error action** (return a code, clamp, assert, log). The engine shows the action the project already uses in the most similar situations: same callee family, same return type. It's counted from the codebase, not learned.
- **Ranking only;** the guard itself is verified by S7 re-analysis and confinement.

**R-25 Concurrency fixes checked against each other (A22 + D1 + D3.8).**
- **Adding a lock to fix a race:** the smallest region covering the conflicting window; then O2 **includes the D1 deadlock check** and consistency with the **lock order** in the constraint store.
- **Lost wake-up:** wrap the wait in a `while` (predicate) loop. Verified under the spurious-wake-up model (D1.h″) plus the signal-supplier check.
- **Interrupt races:** the minimal mask window versus alternatives (atomic type, double buffering), with the added latency shown.

#### Batch 5, coverage

**R-26 Proven-infeasible code becomes a removal suggestion, with the variant check (A39 + A01).**
- Code proven infeasible by SMT (an unsat core) is unreachable or dead (MISRA R2.1/R2.2).
- **Removal** is suggested only if it's infeasible in **every** build variant and target model. Otherwise it's a guarded removal (R-1) or no suggestion.

**R-27 An MC/DC gap reveals a redundant condition: simplification with proof (A27).**
- If, over all **feasible** inputs reaching the decision, ∂f/∂xᵢ = 0 (SMT validity), condition i **never affects the outcome**.
- **Fix:** remove condition xᵢ (Boolean simplification).
- **Theorem:** the outputs are unchanged on every feasible input.
  - **Proof:** f doesn't depend on xᵢ there. ∎
  - **Side effects:** if xᵢ has side effects, removal changes behaviour, so it's not offered.
- The MC/DC denominator drops by one condition, and decision complexity drops.
- **Position:** **Candidate.**

**R-28 Coverage survives fixes (A23 + A32).**
- After a fix, probes are re-placed only in patched functions.
- Coverage of unchanged functions carries over exactly for tests that never executed changed code.
- O4 reruns only the rest.

**R-29 Code shapes behind untraceable object code (A31).**
- When object-code verification lists compiler-generated branches (e.g. a jump table for a `switch`), the engine suggests:
  - **a compiler option**, verified by recompiling: the untraceable set must shrink;
  - **or a code shape**, which needs your intent.

#### Cross-cutting: the verification pipeline, ordered to cost least
- **Obligations are a conjunction,** so their order doesn't change the verdict, only the cost.
- **Order:** checks are run in increasing **cᵢ / pᵢ**, where cᵢ is the expected cost and pᵢ is the probability of rejection (estimated from the D3.8 feedback counts).
- **Theorem:** this order minimises the expected total cost of a series of pass/fail checks that stops at the first failure (the classic result for testing series systems: Mitten 1960). ∎
- **Typical order:**
  1. O0 location
  2. template pre-screen (R-13)
  3. certificate re-validation (R-20)
  4. incremental rule re-check (R-14)
  5. O1 and O2 with early cutoff (R-6)
  6. O3 (SMT)
  7. O4 (tests)
- **Position:** **Known** result, applied; safe because a conjunction commutes.

#### Summary of the re-read

| | Count | Strongest |
|---|---|---|
| New fix classes | 14 (R-1 to R-4, R-7, R-9, R-11, R-17 to R-19, R-21, R-22, R-26, R-27) | **R-21** minimum-cut interference repair; **R-27** redundant condition; **R-11** precision repairs |
| New synthesis methods with optimality proofs | 5 (R-10, R-15, R-17, R-21, D3.6.3) | **R-15** fewest casts; **R-21** |
| New reductions | 7 (R-6, R-12, R-13, R-14, R-20, R-28, pipeline order) | **R-20** certificate-incremental verification; **R-6** early cutoff |
| New confirmations | R-1, R-2, R-3, R-8, R-16, R-25, R-26 | Exact impact per suggestion (R-8) |


### D3.10 Deep re-read of batches 6–8 for the repair engine (2026-10-31)
This continues D3.9: R-30 to R-49, plus three cross-cutting results (X-1 to X-3).

#### Batch 6, testing

**R-30 A differential check that tests the analyser itself (A37 + D3.3).**
- **Theorem:** if a fix satisfies confinement (O3b), every existing test that **doesn't** follow a witness path gives **identical outputs and traces** before and after the fix.
- **Proof:** such a test follows a non-defective path, which contains no edited node (D3.3). ∎
- **Use:** all tests run on both versions. Any difference on a non-witness test **refutes** the confinement claim, which means an analyser bug. It's reported as an internal error and the fix is withdrawn.
- **Position:** **Candidate.** Every fix doubles as an experiment on the tool.

**R-31 Behaviour equivalence proven by path domains (A33 + A41 + O3a).**
- For **loop-free** regions (or loops bounded by a proven constant), the old and new code have finitely many **path domains**.
- For each pair of domains, SMT checks that the path conditions overlap only where the outputs are equal. If all pairs pass, that is a **complete proof** of equivalence over the complete interface (A33).
- Otherwise, differential testing on domain representatives (A41) and ON/OFF points (A40) gives **evidence, labelled as such**.
- **Prior art:** differential symbolic execution (Person et al. 2008). **Known**, combined with the complete interface.

**R-32 Stubs must conform to summaries (A35 + D2.5).**
- A unit-level fix is only meaningful if the stubs behave like the real callees.
- **Check:** each stub's behaviour ⊆ the callee's summary (its D2 element, effects and outputs). If every stub conforms, unit-level verification composes with whole-program verification (assume–guarantee reasoning, **Known**).
- **New fix class, test infrastructure repair:** non-conforming stubs are reported with the summary they violate.

**R-33 Flaky tests: first divergence (A37 + A33).**
- Comparing the two runs' event traces gives the **first divergence**. It must originate in an uncontrolled environment input (A33's list) or a concurrency choice (D1).
- **Suggestion:** stub or control that input, or apply the D1 fix.
- **Proof:** before the first divergence both runs are identical, so the divergence is caused by the first input or scheduling difference. ∎
- **Position:** **Refinement.**

**R-34 Tests that encode the bug (A36 + A42).**
- After a verified fix, tests that expected the **old** output on witness paths fail.
- **Never auto-updated (guardrail).** If a requirement predicate (A42) supports the new output, the update is suggested with that link. Otherwise it **needs your intent**.

**R-35 Fix synthesis against requirements, not tests (A42 + D3.6.6).**
- When the behaviour is specified by an EARS predicate, synthesis targets that **specification**: a candidate is accepted only if SMT proves it satisfies the predicate on **all** inputs in the domain.
- Label: "**proven relative to the requirement**", stronger than test-verified, and immune to overfitting the tests.
- **Position:** **Candidate.**

**R-36 Fuzzing as a refuter (A43).**
- After a fix, directed fuzzing targets the former finding's location and the patched region.
- **Re-triggering refutes** the fix (rejected).
- Not re-triggering is **evidence, not proof** (labelled), and only affects ranking.

**R-37 False findings turned into precision repairs (A39 + R-11).**
- If a finding's witness path is proven **infeasible** (an unsat core), the finding is false, so no fix is offered.
- The engine suggests an **assertion or annotation** built from the unsat core's predicates, so the analysis proves it automatically next time.
- This reduces future work.

**R-38 Off-by-one fixes have exact discriminating tests (A40).**
- For a candidate border change (`<` → `<=`, a ±1 bound), the **ON/OFF pair** for that border is the exact test pair that tells the two versions apart (domain testing).
- With the requirement's border known (A42), this pair fails before and passes after. That pair is the regression test.

#### Batch 7, requirements and compliance

**R-39 The criticality lattice of obligations (A44).**
- Levels (QM < ASIL A < … < D; DAL E < … < A) map **monotonically** to obligation sets.
- **High levels add:**
  - O3 must be *proven*;
  - **O6, independent acceptance:** the person accepting the fix ≠ its author, as DO-178C's independence requires at the higher levels;
  - mutation adequacy of the region's tests.
- The pipeline order (D3.9) is computed **within** the level's obligation set.

**R-40 Exact compliance what-if after a fix (A47 + A46).**
- **Theorem:** status after a fix = the least Datalog model over (stored evidence **minus** the evidence invalidated by changed fingerprints) ∪ the fix's new evidence.
- **Proof:** evidence validity is defined by fingerprints (A46), and Datalog is monotone in its facts. ∎
- The suggestion shows which objectives become **met**, which become **stale** (needing re-verification), and the work to restore them.

**R-41 Least-impact fixes first (A46).**
- The impact set is **monotone** in the set of edited functions: editing more means a superset impact.
- Among verified fixes for the same finding, prefer the one with the smallest impact (fewer requirements stale, fewer tests rerun). That's usually the fix in a leaf function, not in a widely called one.

**R-42 Refactorings keep traceability (A45 + D3.2.4).**
- Trace links are attached at **statement** granularity and move with the statements. An extracted function inherits the links of the requirements its statements served.
- **Theorem:** trace completeness (the A45 schema) is preserved.
- **Proof:** every moved statement keeps its links, and the new function's statements are exactly the moved ones. ∎

**R-43 Regressions found by bisecting accepted fixes (A52).**
- Every accepted fix is a baseline delta. If a later regression appears, binary search over the deltas finds the responsible fix in O(log n) runs, and a revert is suggested (exact rollback).
- **Known** (bisection).

**R-44 Requirement conflicts (A42 + A47).**
- Contradictory requirements are shown as a **minimal unsatisfiable subset**.
- The code's current behaviour is shown against each member, so you can see which requirement the code follows.
- Relaxing one **needs your intent**.

#### Batch 8, visuals and reports

**R-45 Explanations as a certificate difference (A50 + A48).**
- A fix is explained by the **shortest witness** it breaks plus the **certificate before and after**: the held band that now closes, the invariant range that now excludes the error, the MC/DC pair now completed.

**R-46 Unfold only the fix's path (A48 folding + locality).** A fix inside folded regions unfolds only its chain of enclosing regions. By the locality theorem, the rest of the picture stays put.

**R-47 "Needs your intent" as a comparison (A50 + R-8 + R-41).** When the fix needs a decision, each option is shown with its **predicted** metrics (R-8), impact set (R-41), test changes and compliance what-if (R-40), so you choose with exact consequences in front of you.

**R-48 A universal verifier for outside fixes (A50 SARIF + D3.0).**
- Fixes **imported** as SARIF `fixes` from other tools or people are run through the same obligations. The engine verifies anyone's suggestions, not only its own.
- **Position:** **Candidate** (an integration).

**R-49 Feedback in place (A49 + D3.8).**
- Accept / edit / reject is recorded where you act.
- Edits made in the preview are re-verified live before acceptance, and only the verified final form becomes a template (D3.8).

#### Cross-cutting results

**X-1 The closed loop, and its invariants.**
1. finding
2. synthesised fix (D3.2, D3.6)
3. proven obligations (graded by the criticality lattice)
4. regression test from the witness (A.4f)
5. fix-protecting mutation check
6. differential check (R-30)
7. requirement status and compliance update (R-40)
8. change-impact record and report (A50)
9. new baseline (A52)

Only step 3's acceptance is human.

- **Invariants preserved by every accepted fix:**
  - **(i)** the evidence store is consistent with the current fingerprints;
  - **(ii)** the project constraint store is consistent (D3.8);
  - **(iii)** every certificate is valid for the current baseline (re-validated by R-20, or the item is marked stale);
  - **(iv)** the trace schema is satisfied, or every gap is listed (R-42, A45).
- **Proof:** each step checks the invariant it touches before the baseline is written. Nothing is committed if a check fails (atomic baseline write). ∎

**X-2 Cost bound per fix.**
- When the old certificates re-validate (R-20), verification costs O(edit size), plus the tests whose executions touch changed code (A32), plus the early-cutoff cone (R-6).
- The expensive paths (SMT for O3, full re-analysis) run only when a cheaper check fails, by the pipeline order of D3.9.

**X-3 Every prediction is checked against observation.**
- **Predicted at suggestion time:** metric deltas (R-8), impact sets (R-41), confinement (R-30), coverage carry-over (A32), stable layout (A48).
- **Compared after acceptance** with what was actually observed.
- **A mismatch is an internal error** of the tool, with the case kept as a regression test for SkyFlowX itself (fed into delta qualification, A51).
- **Proof that this catches the bug class:** each prediction is a theorem under the tool's correctness, so a refuted prediction refutes correctness somewhere on that path. ∎

#### Summary

| | Items | Strongest |
|---|---|---|
| New fix classes | R-32 stub repair, R-33 flaky fix, R-37 precision from unsat cores, R-38 off-by-one with exact tests | R-37 |
| New proofs or confirmations | R-30, R-31, R-35, R-39, R-40, R-42 | **R-30** (fix as an experiment on the tool), **R-35** (proven relative to the requirement) |
| Reductions | R-41, R-43, R-46, X-2 | X-2 |
| Integrity of the whole engine | X-1, X-3 | **X-3** (self-checking by prediction) |

### D3.11 Fixes that affect each other: how an accepted fix trickles into the other suggestions (2026-11-01)
**Question (user):** once some lines are repaired, can the other suggested changes change too, because the earlier change trickles into them? **Answer: yes.** Every suggestion was verified against the code *as it was when it was made*. After a fix is accepted, that code no longer exists, so each pending suggestion's verification is about a different program. Until this entry, nothing in D3 re-checked pending suggestions against fixes accepted before them. R-25 checks a concurrency fix against the **current** code and constraint store only. D3.11 closes that gap and **corrects O2** (D3.11.4).

#### D3.11.1 Prior art
| Work | Idea | Relevance |
|---|---|---|
| Bernstein (1966), *Analysis of programs for parallel processing* | Two operations can run in either order (or in parallel) when neither writes what the other reads or writes | The independence test (R-50) |
| Newman (1942), *On theories with a combinatorial definition of "equivalence"* | A terminating system that is locally confluent is confluent: the end result doesn't depend on the order | When the order of accepting fixes doesn't matter (R-53) |
| Graph transformation: parallel independence and the local Church–Rosser theorem (Ehrig et al., *Fundamentals of Algebraic Graph Transformation*, 2006); critical-pair analysis of refactorings (Mens, Taentzer and Runge, *Analysing refactoring dependencies using graph transformation*, SoSyM 2007) | Decides when two rewrites conflict or one enables the other | The closest prior art, for refactorings |
| Patch theory (Darcs; Jacobson 2009) and operational transformation (Ellis and Gibbs 1989) | Commuting edits on disjoint text, with positions shifted | Text-level rebasing |
| Multi-location repair, e.g. Hercules (Saha et al., ICSE 2019) | Repairs that need several coordinated edits | Joint fixes |

**Position:** the mathematics is **Known**. Our **Candidates:** footprints taken from the certificates themselves (exact and cheap via R-20), the six statuses with a preview before accepting, the uncovered-versus-created correction to O2, and the termination bound.

#### D3.11.2 Plain statement and examples
A fix f turns code C into C′ = f(C). A pending suggestion g was proven on C. On C′, g can be:

1. **Unaffected:** f touched nothing g relies on. Only g's line positions shift.
2. **Still verified:** f touched something g relies on, but g's proof still holds on C′.
3. **No longer needed:** f already fixed g's finding.
4. **Updated:** g must be recomputed on C′; the new diff is verified again.
5. **Withdrawn:** no verified fix exists any more, e.g. g now contradicts a lock order that f fixed.
6. **New:** C′ has suggestions that C didn't. f uncovered a finding, or made another fix possible.

**Example 1, double release: each fix verified alone, wrong together.**
```c
char *buf = malloc(n);
if (!buf) return -1;
if (parse(buf) < 0) return -2;   /* leak */
free(buf); return 0;
```
- MISRA C Rule 22.1 and CERT MEM31-C both report the leak.
- Each rule's template suggests `free(buf)` before `return -2`, and each one alone is verified.
- Accepting both gives a double free.
- After the first is accepted, the second must become **no longer needed**.

**Example 2, a better fix changes shape.**
- Two leaks have three suggestions:
  - A: `free` before the first early return;
  - B: `free` before the second;
  - C: one `goto cleanup` that fixes both.
- After A is accepted, C is **updated**: it now covers only the second exit, and is a smaller diff.
- After C is accepted, A and B become **no longer needed**.

**Example 3, a lock fix withdraws another.**
- g₁ fixes a race on `x` by taking `a` inside `b` in thread 1; g₂ fixes a race on `y` by taking `b` inside `a` in thread 2.
- Each alone is deadlock-free.
- Accepting g₁ records the order b < a in the constraint store (D3.8). g₂ then contradicts it, so g₂ is **updated** (re-synthesised under b < a) or else **withdrawn** and becomes "needs your intent" (N-3's gate lock is offered).

**Example 4, a positive trickle: one removal enables the next.**
```c
t = a * 2;
u = t + 1;   /* dead store */
u = 0; use(u);
```
- Removing the dead store `u = t + 1` makes `t = a * 2` dead too, so a **new** suggestion appears.
- This is the dead-code-elimination fixpoint, reached one accepted step at a time.

**Example 5, a fix uncovers a finding.**
- In `if (n < 0 && n > 10) report(tbl[n]);` the condition can never be true (R-27), so `report` is proven unreachable and its bad index is never reported.
- The fix to `||` makes it reachable, and the index is out of bounds for `n > 10`.
- That finding was **uncovered** by the fix, not created by it (D3.11.4).

#### D3.11.3 Formal setting: footprints
- **Facts:** everything a verification reads, labelled by its trickle level (SKYFLOWX-TASK §2, T0–T8):
  - token ranges (T0/T1);
  - expression types (T2);
  - CFG edge labels, potentials and invariants of a function (T3);
  - function summaries (T4);
  - cross-file buckets, lock order and other constraint-store entries (T5/D3.8);
  - test executions (T7) and trace links (T8).
- **Read footprint R(g):** the facts that g's certificates and obligations O0–O6 read.
  - It is read off the certificates, because a certificate is a conjunction of local conditions (R-20) and each condition names its inputs.
  - So R(g) is computed, not guessed.
- **Write footprint W(f):** the facts that accepting f changes:
  - its token ranges;
  - the facts of every level above them that change, found by propagating only while facts keep changing (R-6 early cutoff);
  - the store entries it adds.
- **Over-approximation is safe:** a footprint that is too large causes an extra re-check, never a missed interaction.
- **Interference graph I:** pending suggestions as nodes, with an edge g—h when R(g) ∩ W(h), W(g) ∩ R(h) or W(g) ∩ W(h) is non-empty. Its connected components are the **groups**.

#### D3.11.4 Results
**R-50 Independence: footprint-disjoint fixes keep their proofs, in either order.**
- **Statement:** if W(f) ∩ R(g) = ∅, R(f) ∩ W(g) = ∅ and W(f) ∩ W(g) = ∅, then:
  - (i) g's certificates are valid on f(C);
  - (ii) the texts commute: g ∘ f = f ∘ g, after shifting positions;
  - (iii) both stay verified, whichever is accepted first.
- **Proof:**
  - (i) g's certificate is a conjunction of local conditions that read only R(g), and f changed none of it (R-20's argument).
  - (ii) The token ranges are disjoint (they are in W), and replacements of disjoint ranges commute, as in patch theory.
  - (iii) Apply (i) symmetrically. O2 for g reads g's R-6 cone, which lies inside R(g), so its result is unchanged. ∎
- **Position:** Bernstein's conditions, applied with certificate footprints. **Known**, applied; the footprint source is a **Candidate**.

**R-51 Individual verification is not enough for a batch; checking in sequence is.**
- **Statement:** verifying f₁ … f_k one by one on C does not imply the batch is correct (Example 1).
- **The batch is verified** when it is applied in order and each f_{i+1} is re-checked against the **actual** write footprint of f₁ … f_i (or the composed patch is verified once against O0–O6).
- **Pairwise independence is only a fast pre-screen.**
  - The combined write set is found by propagating the actual change.
  - The union of the separate cones can miss a caller whose summary changes only under both edits.
- **Proof:** obligations O0–O6 are properties of the final program, and step-wise re-checking establishes them for each prefix by induction, using R-50 for the unaffected ones and re-verification for the rest. ∎

**R-52 After each accepted fix, one status pass over its neighbours.**
1. For each pending g adjacent to f in I, run the checks cheapest first, in Mitten's order (D3.9):
   1. disjoint footprints → **unaffected** (shift positions);
   2. target finding absent in f(C) → **no longer needed**;
   3. R-20 re-validation of g's certificate on f(C) succeeds → **still verified**;
   4. re-synthesise on f(C), warm-started (e.g. the D3.6.3 network LP from its previous basis) and verified → **updated**;
   5. otherwise → **withdrawn**, offered as "needs your intent" or as a deviation (R-18).
2. Then analyse f(C)'s changed cone for **new** findings and suggestions.
- **Cost:** O(edit), plus the neighbours of f in I, plus the R-6 cone (X-2). Suggestions outside f's group aren't touched.
- **Never automatic:** nothing is applied without the user (D3.1), so one acceptance causes exactly one pass and never sets off a chain on its own.

**R-53 When the order doesn't matter, and when it must not decide silently.**
- **Independent fixes:** they satisfy the diamond property (R-50), so by Newman's lemma any order of accepting them gives the same program.
- **Interfering fixes** (one group of I) can end differently depending on order (Example 2: A then C versus C alone).
- **Rule:** the engine never lets the order decide silently. A group with more than one finding is shown as one decision:
  - **its joint fix** (R-54);
  - **the alternatives**, each with its predicted end state.
- **Position:** Newman (1942); graph-transformation critical pairs (Mens et al.). **Known**, applied.

**R-54 Joint fixes, and when one at a time is as good.**
- **Statement:** accepting individually optimal fixes in turn can cost more than the joint optimum (Example 2: two separate `free`s versus one cleanup).
- **Equality condition:** if the joint problem's constraints and costs split by group (a block-diagonal system with separable costs), then the sum of the groups' optima equals the joint optimum.
- **Proof:** separable problems decompose. ∎ (**Known**)
- **Consequences:**
  - D3.6.3 already solves all findings of one resource jointly, in one LP.
  - Across resources (N-6), costs couple when one cleanup block serves several of them, so those are solved as one LP over the product.
  - Lock order (minimum feedback arc set) is solved over the whole group.
  - Casts (R-15) are joint within one expression tree.

**R-55 Correction to O2: findings uncovered versus created.**
- **The problem:** O2 required Findings(after) ⊆ Findings(before) \ {target}. That wrongly rejects a correct fix that makes previously unreachable code reachable (Example 5).
- **O2′:** split the findings after the fix by location, using the round-trip map of A05:
  - **Created:** at an edited node, or at a node reachable before the fix. These must satisfy the old O2, so they **block**.
  - **Uncovered:** at a node that was **proven unreachable** before the fix, i.e. the lower end of P8, never merely "can't tell". These are **listed with the fix** ("this fix makes `report` reachable; 1 finding there"). They don't block, and they become **new** findings.
- **Soundness:** an uncovered finding lies in code that had no executions before, so the fix didn't make any previous execution worse.
- **Proof:** the node set of every execution of C is reachable in C, and created findings on those nodes are still forbidden. ∎
- **Termination of the trickle:**
  - With no uncovered findings, every accepted fix strictly shrinks the finding set (O2), so at most |F₀| fixes are accepted before no finding remains.
  - Uncovered findings can raise the count only with new findings in code that couldn't run before, each labelled with the fix that uncovered it, so a rise is always explained.
  - **Cycle guard:** a program fingerprint that recurs (A52 baselines) is flagged.

#### D3.11.5 What the user sees (mock up first)
- **Trickle preview before accepting:** "Accepting this: 2 suggestions no longer needed, 1 updated, 1 uncovered finding in `report`."
  - It is computed by running R-52 on f(C) virtually.
  - It is a **prediction** under X-3: after acceptance it is compared with what actually happened, and a mismatch is a tool error.
- **After accepting:** each affected suggestion carries a small badge in our visual language:
  - updated;
  - no longer needed (greyed out, then removed);
  - withdrawn, with the reason;
  - new, "uncovered by your fix to …".
- **Groups:** suggestions in one group of I are shown together, with "Fix together" (the joint fix, R-54) beside the separate ones.
- **The flow view:** plays the before and after of the whole group, not only of one fix.

#### D3.11.6 Repair contributions (D3.7)
| Item | Fix classes | Confirmation | Reduction |
|---|---|---|---|
| R-50 | — | Proofs carried over to the new code only where footprints prove it | No re-check for unaffected suggestions |
| R-51 | Batch acceptance | Sequential re-check of a batch | Pairwise pre-screen |
| R-52 | Updated, no longer needed, withdrawn, new | Status of every pending suggestion after each fix | Only f's neighbours in I; warm-started LP |
| R-53 | Group decisions | Order never decides silently | Independent fixes need no ordering |
| R-54 | **Joint fixes** for a group | Joint optimum where separable | One solve per group |
| R-55 | — | **O2′**: uncovered vs created findings; termination bound | — |

#### D3.11.7 Open questions
1. Measure, once implementation starts ("Skyflow execute!"), how large the groups of I are on ThreadX and tinyhttp. Expectation: small, since most findings are local.
2. Is the cycle guard ever triggered in practice, given that O2′ forbids created findings?


---

## D4. Gluing local facts into one consistent program: sheaves for C/C++ (started 2026-10-31)

### D4.0 Prior art (read first)

| Work | What it does | Our relation |
|---|---|---|
| Young 2026, *Sheaf-Cohomological Program Analysis* — [arXiv 2603.27015](https://arxiv.org/abs/2603.27015) | Čech cohomology of a semantic presheaf over a program's site category: **H⁰** = globally consistent typings, **H¹** = gluing obstructions localised to a pair of disagreeing sites. Unifies type checking, bug finding and equivalence. Claims: the rank of H¹ over GF(2) counts the minimum number of independent fixes; Mayer–Vietoris gives compositional, incremental counting. Implemented in *Deppy* (Python). Reported recall 100%, precision 69% | **We build on it.** Our scope is C/C++ across files, with embedded concerns. **Resolved (D4.11):** the full paper states a Lean 4 / Mathlib formalisation (1,259 lines, 7 modules); the source isn't on the page |
| Ambrose, Huntsman, Robinson and Yutin 2020, *Topological Differential Testing* — [arXiv 2003.00976](https://arxiv.org/abs/2003.00976) | A simplicial complex (with sheaves and persistence implicit) to find the consensus behaviour of several programs and the inputs that break it | Background |
| Abramsky and Brandenburger 2011 | A sheaf-theoretic account of contextuality, with Čech-cohomology obstructions | Mathematical background |
| Contract-based design (Benveniste et al. 2018) | Assume–guarantee contracts composed over shared interfaces | D4.8 |

### D4.1 Plain statement
- Each file (translation unit) and each header sees **part** of the program: its own declarations, types, macro values, locking habits, units of measure.
- The program is consistent when these local views **glue** into one global view: they agree wherever they overlap.
- Sheaf theory says exactly **what must be checked**, **how much** of it, and **where** a failure is. The answer depends on what kind of information is being glued. That is what this thread works out.

### D4.2 Setting
- **The cover:** a cover {U_i}, one open set per translation unit, with overlaps U_i ∩ U_j = the declarations and headers they share. They're linked through the symbols they share.
- **The presheaf:** F(U) is the information visible in U; restriction **forgets** what isn't visible in the smaller set.
- **Gluing:** sections s_i ∈ F(U_i) that agree on every overlap glue to a global section. A failure is an **obstruction**, located on an overlap.
- **The key point:** the right check depends on the **algebra of the values**:
  - **equality** (an equivalence) — D4.3 note;
  - **partial information ordered by refinement** (C type compatibility) — D4.3;
  - **an abelian group** (units, scales) — D4.4;
  - **sets meeting by intersection** (locksets) — D4.8.

### D4.3 C types across files: partial information, the Helly property, and a trap
**Status: Candidate** (the precise formulation; the facts about C are from the standard).

- **The C rule:** all declarations that refer to the same object or function must have **compatible** types (C11 §6.2.7). Compatible types also have a **composite type** (§6.2.7p3).
- **The trap:**
  - Compatibility is **not transitive**: `int[]` is compatible with `int[3]` and with `int[5]`, but `int[3]` and `int[5]` aren't compatible.
  - So checking pairs **along a spanning tree** (as union-find or D2.2 would do for equality) **misses** conflicts such as `int[3]` — `int[]` — `int[5]`, where `int[]` sits in the middle.
  - Checking **all pairs** is correct but costs O(k²) per symbol.
- **Model:** a declared type is a **partial function** from type paths (e.g. "return type → pointee → member 2") to constructors and sizes. An incomplete part (`int[]`, a prototype-less parameter list in the simple cases) is simply **undefined** there. Two types are compatible iff they **agree wherever both are defined**, and the composite is their **union** (the join in the information order).
- **Theorem (Helly property, linear check):** for partial functions s₁, …, s_k:
  - **(a)** pairwise compatible ⟺ the fold c₁ = s₁, c_{i+1} = c_i ⊔ s_{i+1} succeeds;
  - **(b)** if it fails at step i+1, the **conflicting pair** is s_{i+1} and the earlier s_j that **first defined** the disagreeing path. That is recorded as provenance per path, so the pair is exact.
  - **Proof:**
    - (⇒) Pairwise agreement makes the union single-valued at every path, so every partial union exists.
    - (⇐) If the fold succeeds, the final union is single-valued, so any two members agree on their common domain.
    - (b) The fold fails exactly when s_{i+1} disagrees at some path p already defined in c_i, and provenance names which s_j defined p. ∎
  - **Cost:** O(total size of the declarations), instead of O(k²) comparisons.
- **Exceptions:** old-style (K&R) function declarations, whose compatibility involves default argument promotions, aren't plain agreement. They're checked by the standard's rule directly and flagged (MISRA forbids them anyway).
- **Embedded payoff:** the partial function includes **layout**: sizes, offsets and alignment from the probed target model (A02), plus `#pragma pack` and macro-dependent array sizes. So the same fold catches:
  - one struct compiled with different `#pragma pack` in two files;
  - a struct whose array size comes from a macro with **different values** in different files of one binary (the A01 per-file token streams show it);
  - C++ one-definition-rule violations, the same way, on canonical definitions (M6).
  These are real, hard-to-find embedded bugs that usually surface as memory corruption.
- **When the values are plain equality** (identical canonical definitions), equality *is* transitive, so a spanning tree (union-find) suffices, which is the A10 bucket method. **D4.3 says when that shortcut is and isn't valid.**

### D4.4 Units and scales across files: group-valued gluing
**Status:** dimension types are **Known** (Kennedy 1994; F# units of measure). Our extension, scales plus the potential method across files, is a **Candidate**.

- **The bug class:** milliseconds passed where microseconds are expected; ticks vs seconds; Q15 vs Q31 fixed point; mV vs V. It's common in embedded code and invisible to type checkers.
- **The value group:** G = ℤ⁷ (exponents of the SI base units) × ℤ (power-of-10 scale) × ℤ (power-of-2 scale, for fixed-point Q formats). It is **abelian**.
- **Sources of unit facts:** an annotation file (D2 open question 1: units on API parameters, globals, register fields). Name patterns such as `_ms` are **suggestions only**, confirmed by a person.
- **Edges and hyperedges:**
  - `x = y`, argument passing and return give u(x) = u(y): a **graph edge** with label 0;
  - `x = y*z` gives u(x) = u(y) + u(z), and `x = y / 1000` gives a scale shift: **linear equations** over G.
- **Theorem (consistency and certificate):**
  - **(a) Pure graph part:** a consistent unit assignment exists iff the potential exists, which is the D2.2 spanning-tree check on G. A failure gives the **fundamental cycle** carrying the mismatch.
  - **(b) With products:** this is a linear system over ℤ. It's solvable or not in polynomial time (Hermite/Smith normal form). Infeasibility has a **checkable certificate**: an integer combination of the equations giving 0 = c ≠ 0 (an integer Farkas-type certificate). A minimal infeasible subsystem names the smallest set of conflicting statements.
  - **Proof:** (a) is D2.2 with M = G. (b) is standard integer linear algebra. ∎
- **Across files:** the equations span all translation units through the call graph and globals. The obstruction cycle **crosses files exactly where the mismatch is**.

### D4.5 Theorem: whether minimal repair is tractable depends on the coefficient group
**Status: Candidate** (it sharpens how many fixes an obstruction needs; compare Young's GF(2) rank claim, to be read in full).

- **The question:** given an obstruction (a labelling w that isn't a coboundary), what's the **fewest edges** to change so that it becomes one?
- **Over ℤ (or ℤᵈ) with linear costs:** this is an LP with constraint matrix [Bᵀ | I | −I], which is **totally unimodular**. It's solvable exactly in polynomial time (it's D3.6.3). For units, the decision variables are **conversion factors to insert**, and the objective Σ|n_e| splits into two non-negative parts, which keeps total unimodularity. **So "insert the fewest unit conversions" is polynomial.**
- **Over GF(2)** (parity-type facts: "even/odd number of inversions", signed-graph balance): the fewest edges to flip to make it consistent is the **frustration index** of a signed graph. Computing it is **NP-hard** (it contains max-cut).
- **Consequence:** the **rank** of the obstruction space alone doesn't give the number of edits. One edit on a shared edge can kill several independent obstructions, and minimum-support representatives are hard over GF(2). Our engine therefore:
  - solves exactly for ordered groups (ℤ, ℤᵈ);
  - for GF(2)-type facts, uses exact search only on small instances and **labels** larger ones (P7).
- **Proof:** total unimodularity as in D3.6.3. For GF(2), it's the standard reduction from max-cut to the frustration index. ∎

### D4.6 Proof gluing over covers: when per-sheet proofs suffice (a correction)
**Status: Candidate.** It makes our own R-1 and D2.4 safe for information-flow properties.

- **Plain statement:** we split the program's runs into sheets (build variants, R-1; predicate lifts, D2.4; variant × lift). Proving a property on each sheet proves it overall **only for properties about one run at a time**.
- **Theorem:**
  - **(a)** For a **trace property** (∀ runs: the run satisfies P), if every run lies in some sheet and P holds on each sheet, P holds globally.
  - **(b)** For a **2-safety hyperproperty** (∀ pairs of runs: the pair satisfies R; e.g. non-interference, A18/R-21), per-sheet proofs **don't** suffice: a pair can have its two runs in **different** sheets. It holds globally iff R holds on every **product sheet** Sᵢ × Sⱼ (self-composition).
  - **Proof:**
    - (a) Every run is in some sheet.
    - (b) Every pair (r, r′) lies in some Sᵢ × Sⱼ. Conversely, a counterexample pair across two sheets is invisible to each sheet alone. ∎
  - **Prior art:** hyperproperties (Clarkson and Schneider 2010); self-composition (Barthe, D'Argenio and Rezk 2004). **Known**, but **applying it to our covers is a required correction.**
- **Correction applied:**
  - R-1 (guarded fixes over variants) and D2.4 lifts, when used for **information flow** (A18, R-21) or **equivalence** (O3a), must check the **product** cover.
  - Trace properties (leaks, races per run, rule checks) keep per-sheet checks.

### D4.7 Incremental checking: Mayer–Vietoris as the justification
**Status: Known** (Mayer–Vietoris), as the reason R-6 and R-19 are exact.

- For U ∪ V, the exact sequence 0 → H⁰(U∪V) → H⁰(U) ⊕ H⁰(V) → H⁰(U∩V) → H¹(U∪V) → … says that new global obstructions can only come from **disagreement on the overlap U ∩ V**.
- **Practically:** when one translation unit changes, only its overlaps (the symbols it shares) need re-gluing. That's the name-bucket method of A10/R-19 and the fold of D4.3, restricted to the buckets the changed file touches.
- This holds for abelian values (D4.4). For partial-information values (D4.3), the same locality follows directly from the fold being per symbol.

### D4.8 Locking discipline across files
**Status: Adapted** (Eraser's lockset intersection, given a sheaf and blame view).

- **Sections:** for each shared global g, each translation unit's section is the set of locks (or masks) held at **every** access to g in that unit (must-hold, D2.6).
- **Gluing:** a consistent discipline exists iff the **intersection** over all units is non-empty.
- **Blame:** when the intersection is empty, the smallest set of units whose sections already have an empty intersection is reported.
  - With sets of locks, at most |locks| + 1 sections are needed: a Helly-type bound for finite sets.
  - It's found by a greedy fold with provenance, then minimised.
- **Interfaces:** contracts on shared interfaces (assume–guarantee) glue the same way. A requirement predicate is a section on its component, and interface agreement is checked on overlaps (Known: contract-based design).

### D4.11 Young 2026 read in full: comparison and what we take (2026-10-31)
**Source:** [arXiv 2603.27015 (HTML v1)](https://arxiv.org/html/2603.27015v1). What follows is a careful summary; quotes are kept short.

**What the paper does:**
- **Site:** objects are (kind, identifier) for five kinds of site: argument boundary, branch guard, call result, output boundary, error site. Morphisms are data-flow edges carrying projections, and covers satisfy separation and gluing. Sites are built from AST constructs, control flow, data flow and SSA.
- **Presheaf:** to complete lattices of local sections (a carrier type plus a refinement predicate). Restriction projects the predicate.
- **Čech complex:** H⁰ = ker δ⁰ (global typings); H¹ = ker δ¹ / im δ⁰.
  - **Our reading:** the coefficient structure isn't clearly a group. δ¹ uses a lattice "subtraction (complement of meet)" that isn't defined as a group operation, and GF(2) vector spaces appear only in the rank proposition and the Mayer–Vietoris sketch.
- **Rank claim:** over GF(2), rank H¹ = the minimum number of independent code changes. The link from "site adjustment" to "code change" is asserted, not formalised. The evaluation finds the rank predicts the minimum fix set in **102/133 (77%)** programs, which the paper attributes to spurious obstructions.
- **Equivalence:** H¹(U, Iso) = 0 iff the two programs are equivalent, **relative to a shared cover and the refinement domain**. Some verdicts also use runtime sampling.
- **Mayer–Vietoris:** stated for branch decompositions under the assumption H² = 0. The incremental update is claimed exact; the one measurement is a 1.3× speed-up on a 3-function module.
- **Mechanised:** **Lean 4 + Mathlib, 1,259 lines, 7 modules.** The conclusion lists soundness, the sheaf condition, the H⁰ characterisation, descent, Mayer–Vietoris localisation, incremental soundness and convergence. The rank proposition and some theorems have informal proofs. The Lean source isn't on the page.
- **Complexity:** minimum-fix computation in O(m²n) by Gaussian elimination; the whole pipeline's cost isn't stated.
- **Scope:** **single-threaded Python** (the Deppy tool). C isn't mentioned. Evaluation: 375 benchmarks, recall 100%, precision 69%, equivalence 133/134, specifications 106/108. Baselines are mypy and pyright only.

**Comparison with our work:**

| Point | Young 2026 | Ours | Assessment |
|---|---|---|---|
| Values that are partial information (types, refinements) | Lattice-valued Čech complex with an undefined "subtraction" | D4.3: gluing in the **information order** with the Helly fold; no group structure assumed | Ours avoids an ill-defined H¹ for lattice values; gluing is exactly H⁰-style and linear |
| Minimum number of fixes | rank H¹ over GF(2); right in 77% of programs | D4.5: the minimum depends on the **coefficient group**: polynomial (TU LP) for ℤ-like values, **NP-hard** (frustration index) for GF(2) edge flips; rank alone doesn't give it | **Consistent with their 77%.** If "fix" means changing values on overlaps, an O(m²n) Gaussian elimination can't give the exact minimum over GF(2) in general (unless P = NP). It computes a rank, which isn't the minimum |
| Equivalence | Relative to the cover; partly sampled | O3a: translation validation or path-domain SMT, on the **product** cover (D4.6) | Ours is stricter for hyperproperties |
| Incremental | Mayer–Vietoris with H² = 0 | D4.7 plus per-symbol locality (R-6, R-19) | Same idea; ours is stated without the H² assumption for partial-information values |
| Scope | Single-threaded Python | C/C++, concurrency, embedded, certification | Complementary; no conflict |
| **Mechanised proofs** | **Lean 4** | Paper proofs only | **We should adopt this (below)** |

**What we take:**
1. **Mechanise our core theorems in Lean 4 + Mathlib, offline.** **Decided 2026-10-31:**
   - D2.2 (monoid potential);
   - D3.6.3 (total unimodularity, so integral repair);
   - D4.3 (Helly fold);
   - D1.a′ Theorems 1 and 1′;
   - D1.h′ (projection lemma);
   - D3.3 (confinement);
   - the checker's validity conditions (P1).

   This turns the **checker's** correctness into a machine-checked artefact, which is strong evidence for tool qualification (A51) and closes part of the gap P1 leaves.
2. **Their site kinds** (argument boundary, branch guard, call result, output boundary, error site) match our interface points (A33) and witness points. We could use them as a **standard per-function cover** for D4 and D2.4 lifts. To evaluate.
3. **Honest reporting:** like theirs (recall, precision), plus our proof coverage (A10) and an independent baseline. We'd compare with real C analysers, not only tools that report nothing.

**Register updates:**
- D4.5 stays **Candidate**, now with evidence from Young's own 77% figure.
- D4.3's formulation remains a Refinement (T4).
- **New proposal: mechanised proofs** (Known practice; Young 2026 and others).

### D4.9 Repair contributions (D3.7)

| Result | Fix classes | Confirmation | Reduction |
|---|---|---|---|
| D4.3 type/layout fold | **Make the minority declaration match the composite**; unify a macro value across files; make `#pragma pack` consistent; mark a struct's layout explicitly | The **composite type** is the certificate: the fold succeeds | Linear check; exact conflicting pair |
| D4.4 units | **Insert the fewest conversions** (exact, polynomial by D4.5), or fix the annotation | The potential exists (the D2.2 certificate) | Localised cycle |
| D4.5 tractability | — | GF(2)-type repairs labelled exact or approximate by size | Exact where polynomial |
| D4.6 gluing rule | — | **Integrity:** information-flow and equivalence fixes are verified on the **product** cover | — |
| D4.7 Mayer–Vietoris | — | — | Re-check only the changed file's overlaps |
| D4.8 lockset | **Add the lock** in the blamed unit (checked with D1 and the lock-order store) | Non-empty intersection | Minimal blame set |

### D4.10 Open questions
1. ~~Read Young 2026 in full~~ **Done (D4.11).**
2. The unit annotation format, together with the API annotation file (D2 open question 1).
3. Should D4.3's layout fold also use the object code (DWARF type information) as a second witness for layout (A31-style continuity)?


---

## T. Uniform treatment of D1–D4: atoms, injection, dominance, repair (2026-10-31)
**Why:** D1–D3 were written as discovery threads **before** the atomic method (A.0) existed, and D4 only partly followed it. This section gives them the same treatment. For each atom:
- the identifiable concept;
- its sub-concepts;
- the industry concept;
- our injection (with a reference);
- the dominance type (Δ1–Δ4 of A.0);
- the position;
- its repair contribution.

New results found by doing this are listed as **N-n** at the end, with proofs.

### T1. D1, concurrency

| Atom | Concept (contract) | Sub-concepts | Industry concept | Injection | Δ | Position | Repair contribution |
|---|---|---|---|---|---|---|---|
| D1-1 | Execution model: code + target → the set of allowed runs | Cores, preemption, handlers, cooperative, hardware agents | User-declared or assumed single model (task and interrupt configuration in commercial tools) | Model ladder M0–M4, strictest **proven** (D1.e) | Δ2 | Adapted | Fixes verified under the proven model, else M0. **"Declare the model"** as a precision repair (N-1) |
| D1-2 | Entry discovery: program → threads, handlers, callbacks | Creation APIs, vector tables, signals, registrations | User-declared entry points | Automatic, with unknowns listed (D1.i) | Δ4 | Refinement | "Register this callback" annotation suggestion |
| D1-3 | Held windows: thread → where each lock/mask is held | Must-hold, may-hold | Lockset (Eraser) | Must for races, may for deadlocks (D2.6) | Δ2 (soundness) | Adapted | Minimal critical sections are computed from these |
| D1-4 | Races: program → conflicting unordered accesses | Locksets, happens-before, memory model | Lockset / happens-before | Geometric classes + the data-race-free ⇒ SC bridge (D1.f) | Soundness on any hardware | Known / Adapted | Lock or atomic fixes; **O1 for concurrency = outcome classes (N-2)** |
| D1-5 | Interrupt interference: thread + handler → interference | Gaps, masks, windows, guards | Disjoint blocks (Chopra et al. 2019), lockset | Memory-access granularity, Theorem 1′ with guards | Δ2 on a documented gap | Candidate | Minimal mask windows, barriers (R-25) |
| D1-6 | Deadlocks: program → wait cycles and the point of no return | Lock-order graph, unsafe region, messages | Lock-order cycles (e.g. RacerX: Engler and Ashcraft 2003) | Corners plus the **unsafe region**; messages and barriers as forbidden regions (D1.g) | Earlier warning; more constructs | Known (ALCOOL) / Adapted | Lock order by minimum feedback arc set; **gate lock** alternative (N-3) |
| D1-7 | Schedule and outcome classes: program → distinct behaviours | Dihomotopy classes, outcome quotient | One counterexample (model checkers) | Count plus outcome classes, worst first (D1.j) | UX / Δ3 | Known / ours | **Verification target for concurrency fixes (N-2)** |
| D1-8 | Unbounded threads: pools → small exact instances | Projection, provider closure, counter abstraction | Bounded instance counts declared by the user | D1.h′, D1.h″ | Δ4 | Proven / Known | **Fixes for pools verified at the cutoff size (N-4)** |
| D1-9 | Memory-model scope | seq_cst, acquire/release, relaxed, consume | Varies; often SC only | D1.k | Soundness | Decided | "Relaxed with no ordering" flagged; fence suggestions |
| D1-10 | Progress-diagram view | Axes, blocks, run, unsafe shade | None in commercial tools | D1.c | UX | Ours | Fix preview: the corner disappears |

### T2. D2, resources

| Atom | Concept | Sub-concepts | Industry concept | Injection | Δ | Position | Repair contribution |
|---|---|---|---|---|---|---|---|
| D2-1 | Resource model: API → acquire/release semantics | Success edges, transfers, annotations | Specifications required (Torlak and Chandra 2010) | Built-in tables + suggested pairs (deviant behaviour) + confirmed annotations | Δ4 | Refinement | API-level fixes (R-22) |
| D2-2 | Label algebra | Bicyclic, polycyclic, products | Typestate automata | Monoids (D2.1) | Δ3 | Candidate | The algebra the LP repair solves over |
| D2-3 | Linear proof check | Spanning-tree potentials, evidence pair | Data-flow over a powerset | D2.2 | Δ1 + evidence | Candidate | Certificate = φ; R-20 re-validation |
| D2-4 | Correlated branches | Predicate lifts, holonomy | Path-sensitive typestate (ESP), CEGAR | D2.4 | Δ2 | Candidate (weak) | Guarded fixes by projection (D3.6.3) |
| D2-5 | Across functions | Summaries, exceptions, RAII, `longjmp` | IFDS / IDE, weighted pushdown | D2.5 | — | Adapted | Caller-or-callee choice; early cutoff (R-6) |
| D2-6 | Ownership | Transfer, escape | Ownership types, accumulation analysis | Escapes first (decided) | — | Known | Transfer suggestions **need your intent** |
| D2-7 | Held band view | Lanes, cut ends | None | D2.7 | UX | Ours | Before/after band in the fix preview |

### T3. D3, the repair engine itself

| Atom | Concept | Industry concept | Injection | Position |
|---|---|---|---|---|
| D3-1 | Localisation | Spectrum-based fault localisation (Ochiai) | The witness itself for static findings | Known / ours |
| D3-2 | Deviation grammar | Mutation operators, fix templates (clang fix-its, TBar) | One typed grammar shared with mutation testing | Candidate (integration) |
| D3-3 | Exact synthesis | MemFix exact cover via SAT, SAVER graph labelling, FootPatch | TU LP (D3.6.3), tree DP for casts (R-15), minimum cut (R-21), minimum feedback arc set, Σ(k−1) renames, fewest conversions (D4.5) | Candidates |
| D3-4 | Search reduction | Test-equivalence (Mechtaev et al.) | Analysis-equivalence, commutation, monotone pruning, template pre-screening (R-13) | Candidate / Known |
| D3-5 | Obligations | Test-based validation | O0–O6, scaled by criticality (R-39), product cover for hyperproperties (D4.6) | Candidate |
| D3-6 | Pipeline order | — | Increasing c/p (Mitten) | Known |
| D3-7 | Ranking | Prophet (log-linear), Fuzzy-AutoRepair | Counts and min t-norm, ordering only (D3.6.5) | Refinement |
| D3-8 | Feedback and deduction | Getafix (anti-unification) | Constraint store, annotations, templates (D3.8) | Known / Adapted |
| D3-9 | Evidence and baselines | Change records kept by hand | Automatic change-impact record, Merkle baselines (X-1) | Refinement |
| D3-10 | Self-check by prediction | — | X-3, R-30 | Candidate |

### T4. D4, sheaves, with prior art added by this treatment

| Atom | Concept | Industry / prior art | Injection | Position (revised) |
|---|---|---|---|---|
| D4-1 | Declarations across files → one consistent type | **GCC link-time optimisation's `-Wlto-type-mismatch`** warns about mismatched declarations across files; cppcheck's cross-file checks | Helly fold with the spanning-tree trap, exact conflicting pair, layout including `#pragma pack` and macro-dependent sizes | **Refinement** (the formulation and exact pair are ours; the warning class exists) |
| D4-2 | Units across files | **Osprey** (Jiang and Su, ICSE 2006): unit checking for C; **Phriky Units** (Ore, Elbaum and Detweiler 2017): physical-unit inconsistencies in ROS C++; Kennedy 1994; F# | Abelian group with decimal and binary scales, D2.2 potentials, integer certificates | **Refinement** (scales and Q formats with potentials; prior art to check in depth) |
| D4-3 | Tractability by coefficient group | Frustration index (NP-hard), network LPs | D4.5 | Candidate |
| D4-4 | Proof gluing over covers | Hyperproperties, self-composition | D4.6 (a correction) | Known, applied |
| D4-5 | Incremental re-gluing | Mayer–Vietoris | D4.7 | Known |
| D4-6 | Lockset gluing with blame | Eraser | D4.8 | Adapted |

### T5. New results found by this treatment

**N-1 Model declaration as a precision repair (D1-1 + R-11).**
- When the strictest model can't be proven (e.g. the core count is unknown), the engine suggests **declaring** it (a project setting such as "single-core Cortex-M4"), checked against the evidence (`-mcpu`, RTOS configuration).
- **Result:** many M0 alarms disappear by D1.e, proven, because the declared model is a restriction.
- **Guard:** a declaration that contradicts the evidence is refused.

**N-2 O1 for concurrency fixes = one outcome class (D1-7).**
- **Statement:** a race or atomicity fix is **verified** when, after the fix, every schedule class lies in **one outcome class**, or in exactly the outcome classes the requirement allows.
- **Proof:** a race means two schedules produce different outcomes on the shared data. A single outcome class means no schedule distinguishes them. ∎
- **Effect:** this gives concurrency fixes an exact success criterion, rather than "the race warning disappeared".

**N-3 The gate-lock alternative for deadlocks (D1-6).**
- **Fix:** instead of reordering acquisitions, take one extra **gate lock** around the conflicting acquisitions in every involved thread.
- **Theorem:** with a common gate lock held across both inner acquisitions, the inner blocks lie inside the gate's forbidden region, so the inner crossing can't be reached. No deadlock.
- **Cost shown:** reduced parallelism, i.e. the gate region's length.
- Offered alongside the reordering fix. The choice **needs your intent**.

**N-4 Pool fixes verified at the cutoff size (D1-8).**
- Under B1–B4 (or with the provider closure), a concurrency fix verified on the **cutoff instance** (e.g. 2 threads) is verified for **every** pool size.
- **Proof:** the projection lemma applies equally to the fixed program. ∎
- **Effect:** big savings in verification.

**N-5 One lift serves every property (D2-4 + A16).**
- A lift depends only on the **predicates**, not on the property's labels.
- **So:** a function's lift is computed once and reused by every monoid property (resources, data-flow anomalies, handler guards, units).
- **Proof:** the lift's construction never reads the labels. ∎ (**Δ1**)

**N-6 All resources in one pass (D2-2/D2-3).**
- The potential for r resources lives in the direct product of their monoids, so **one** spanning-tree pass checks all of them.
- **Proof:** product operations are componentwise, so (b) holds for the product iff it holds for each component. ∎
- **Effect:** one traversal instead of r.

**N-7 Grammar completeness check (D3-2).**
- Every synthesis method's output (D3.2, D3.6, R-list, D4.9) must be expressible in the deviation grammar. Otherwise mutation testing and analysis-equivalence don't cover it.
- **Check:** each fix class maps to a grammar production. This is an internal consistency obligation, run in CI.

**N-8 Prior-art corrections:** D4-1 and D4-2 are downgraded to **Refinement** (GCC `-Wlto-type-mismatch`; Osprey; Phriky Units). This was found only because the treatment requires an industry concept for every atom, which shows the value of applying it uniformly.

### T6. Repair ledger rows added (D3.7)
N-1 (model declaration), N-2 (concurrency O1), N-3 (gate lock), N-4 (pool verification), N-5 and N-6 (shared lift, product pass), N-7 (grammar completeness).

---

## A. Atomic decomposition of a commercial static/dynamic analyser, and improvement injection (started 2026-10-31)

### A.0 Method
1. **Coverage:** list every capability in LDRA's **public** material and split each into **atoms**, the smallest unit with one clear contract (input → output). LDRA's internals aren't public, so "100% coverage" means 100% of the publicly documented capability list (sources in A.1), plus the atoms our own design needs.
2. **For each atom, record:**
   - the **identifiable concept** (its contract)
   - its **internal sub-concepts**
   - the **industry concept** (what tools do today)
   - our **injected concept**
   - an **improvement claim with a proof**
   - its **prior-art position** (see the register)
   - **where it lands** in SkyFlowX
3. **An improvement counts only if it is logically verifiable,** as one of these dominance types:

| Type | Claim | What must be proven |
|---|---|---|
| **Δ1 Same results, less work** | Output identical to the industry method; cost ≤ and sometimes < | Equality of outputs; a cost bound |
| **Δ2 Fewer false alarms, no lost findings** | Alarms(new) ⊆ Alarms(industry), and every true finding is kept | Inclusion, plus preservation of true findings |
| **Δ3 More checkable** | Each verdict carries a certificate that a small independent checker validates | Checker acceptance ⇒ verdict true |
| **Δ4 More code analysed, no less sound** | Analysed set ⊇ industry's, each verdict still sound | Inclusion, plus soundness of the added parts |

5. **Repair contributions (standing rule):** every batch ends with what it adds to the repair engine, collected in D3.7.
4. **Novelty is a separate question** from improvement. Every injection is labelled Known · Refinement · Candidate (unverified) · Novel (verified), as in the register.

### A.1 Public capability sources
- [LDRA tool suite](https://ldra.com/products/ldra-tool-suite/)
- [LDRA Testbed and TBvision](https://ldra.com/products/ldra-testbed-tbvision/): static and dynamic analysis engine, coding standards, defects, quality, testability; TBvision shows results beside the source
- [TBrun](https://ldra.com/products/tbrun/): unit and integration tests; interfaces from control and data flow; coverage (procedure call, statement, branch/decision, MC/DC, LCSAJ); traceability with TBmanager
- [Code coverage capability](https://ldra.com/capabilities/code-coverage-analysis/)
- [Unit, integration and system test](https://ldra.com/capabilities/unit-system-integration-testing/)
- [Wikipedia: LDRA](https://en.wikipedia.org/wiki/LDRA): the module list, TBextreme / TBextremePLUS (test vectors, boundary values, equivalence classes, requirements-based tests, fuzzing), LDRArules, LDRAcover, LDRAunit; languages C, C++, Java, Ada and assemblers
- LDRA also markets data coupling and control coupling analysis and object-code verification (from LDRA's material; the exact scope is to be confirmed)

**Out of SkyFlowX 1.x scope:** Java, Ada and assembler (deferred to 1.5).
**Not found in LDRA's public material (SkyFlowX additions):** concurrency (D1), worst-case stack depth, and timing / response time.

### A.2 The atoms (complete map)

| ID | Atom: identifiable concept (contract) | Internal sub-concepts | Public LDRA home | SkyFlowX |
|---|---|---|---|---|
| A01 | Build capture: project → per-file compile configurations | Interception or compile database; per-file flags; build variants; excluded files | Testbed | S1.1 |
| A02 | Dialect and target model: configuration → exact compiler view | Type sizes, signedness of `char`, alignment, endianness, predefined macros, extensions, implementation-defined behaviour | Testbed | S1.2 |
| A03 | Preprocessing record: file → token stream with provenance | Includes, conditionals, macro definitions and expansions, `#line`, pragmas | Testbed | S1.3 |
| A04 | Parsing: tokens → typed AST | Grammar, semantic analysis, error recovery | Testbed | S1.4 |
| A05 | Location mapping: AST/CFG ↔ source | Spelling vs expansion location; line tables | Testbed / TBvision | S1.5 |
| A06 | Standard catalogue: chosen standards → active rule set | Standard models (MISRA, CERT, …); user-defined standards; per-rule options | LDRArules / Testbed | S2.1 |
| A07 | Lexical rule check: tokens → findings | Character sets, comments, literals, identifiers | LDRArules | S2.3 (T0) |
| A08 | Syntactic rule check: AST shape → findings | Statement forms, switch structure, declarations | LDRArules | S2.3 (T1) |
| A09 | Semantic rule check: typed AST → findings | Essential types, conversions, casts, expression rules | LDRArules | S2.3 (T2) |
| A10 | Flow and system rule check: graphs and summaries → findings | Unused code, recursion, side effects across calls, cross-file declarations | LDRArules / Testbed | S2.3 (T3–T5) |
| A11 | Deviations: finding + justification → accepted finding | Records, scopes, approvals, reporting | Testbed / TBmanager | S2.4 |
| A12 | Metrics: function/file → numbers | Cyclomatic, essential, knots, Halstead, nesting, size, comments, fan-in/out | Testbed | S3 |
| A13 | Quality model: metrics → grades | Thresholds, weighting, testability | Testbed | S3.10 |
| A14 | Control-flow graph: function → CFG | Basic blocks, short-circuit edges, exception edges, `noreturn` | Testbed | S4.1 |
| A15 | Call graph: program → caller/callee relation | Direct calls, function pointers, virtual calls, entry points | Testbed / TBvision | S4.4–S4.6 |
| A16 | Data-flow anomalies: CFG → UR/DU/DD findings | Reaching definitions, liveness, def-use chains | Testbed | S5 |
| A17 | Cross-reference: program → symbol use relation | Globals, parameters, types, macros | Testbed | S8 |
| A18 | Information flow: function → output/input dependence | Explicit flows, implicit flows | Testbed | S6 |
| A19 | Data and control coupling: components → coupling set, and its coverage | Interface variables, calls between components, coupling coverage | Testbed (DO-178C material) | S6 + S9 |
| A20 | Defect detection: program → run-time error findings | Null, bounds, overflow, division, uninitialised, invariant conditions | Testbed | S7 |
| A21 | Resource checks: program → leak, double-release and use-after-release findings | Acquire/release model, ownership | (inside defect detection) | D2, S5.5 |
| A22 | Concurrency: program → races, deadlocks, order findings | Threads, interrupts, locks, messages | not public | D1, S12 |
| A23 | Instrumentation: source → probed source | Probe placement, rewriting, build integration | Testbed / LDRAcover | S9.5 |
| A24 | Target integration: probed build → execution data | Run-time library, upload, merge | Testbed / TBrun | S10 |
| A25 | Statement coverage: data → covered statements | Node hits | LDRAcover | S9.1 |
| A26 | Branch/decision coverage | Edge hits | LDRAcover | S9.2 |
| A27 | MC/DC | Condition vectors, independence pairs, masking vs unique-cause | LDRAcover | S9.3 |
| A28 | LCSAJ coverage and test-effectiveness ratios | LCSAJ triples, TER₁₋₃ | LDRAcover / TBrun | S9.4 |
| A29 | Procedure-call coverage | Call-edge hits | TBrun | S9 |
| A30 | Dynamic data-flow coverage | Def-use pairs exercised | Testbed (scope to confirm) | S9 + S5 |
| A31 | Object-code verification: source coverage ↔ object coverage | Line tables, branches the compiler added or removed | Testbed (material) | S9.7 |
| A32 | Coverage aggregation: many runs → one result | Merge, per-build identity, coverage across test types | LDRAcover | S9.6 |
| A33 | Unit interface extraction: function → its inputs and outputs | Parameters, globals, returns, called functions | TBrun | S11.1 |
| A34 | Harness generation: interface → drivers | Drivers, set-up and tear-down | TBrun / LDRAunit | S11.1 |
| A35 | Isolation: dependencies → stubs | Stubs, fakes, call expectations | TBrun | S11.2 |
| A36 | Test cases: inputs → expected results | Values, expected outputs and calls, tolerances | TBrun | S11.3 |
| A37 | Execution: tests → verdicts, on host and target | Build, run, collect | TBrun | S11.4 |
| A38 | Regression: change → tests to rerun, and re-verdicts | Baselines, impact selection | TBrun | S11.6 |
| A39 | Test-vector generation for coverage | Search, symbolic or constraint solving | TBextreme | S11 / S7 |
| A40 | Boundary-value tests | Domain edges | TBextremePLUS | S11.5 |
| A41 | Equivalence-class tests | Input partitions | TBextremePLUS | S11.5 |
| A42 | Requirements-based test generation | Requirement → test skeletons | TBextremePLUS | S11 + S13 |
| A43 | Fuzz testing | Mutation, crash and assertion detection | TBextremePLUS | S11 |
| A44 | Requirements model: documents → requirement objects | Import (ReqIF/CSV/tools), hierarchy, versions | TBmanager | S13.1 |
| A45 | Trace links: requirement ↔ code ↔ test ↔ result | Bidirectional links, link integrity | TBmanager | S13.2 |
| A46 | Trace gaps and impact | Unlinked items, change impact | TBmanager | S13.3, S13.5 |
| A47 | Compliance objectives: standard → objective status | Objective tables, evidence, progress | TBmanager | S13.4 |
| A48 | Graph visualisation | Flow graphs, call graphs | TBvision | S14 |
| A49 | Annotated source | Findings and coverage beside the code | TBvision | S14 |
| A50 | Reports | Quality, code review, data flow, cross-reference, coverage, test | Testbed / TBvision | S14.7 |
| A51 | Tool qualification support | Plans, validation suites, reports | (qualification packs) | S15 |
| A52 | Configuration and baselines: results ↔ versions | Baselines, comparisons, reproducibility | Testbed / TBmanager | S1 fingerprints, S15.5 |

### A.3 Principles of improvement used across atoms (each proven once, reused everywhere)

**P1 Certificates (Δ3).** Every *pass* carries a certificate (a potential φ from D2.2, an invariant, a ranking function, a covering test set), and every *violation* carries a witness (a path, checked by replay or by SMT). A small checker, separate from the analyser, validates them.
- **Proof:** if the checker accepts certificate c for property P, and the checker is correct, then P holds. The analyser's correctness is irrelevant to that verdict. ∎
- **Consequence:** tool qualification (ISO 26262-8, DO-330) can rest on the **small checker**, not the whole analyser. That's a large reduction in what must be trusted.
- **Correction (2026-10-31, batch 7):** the certificates are stated over the AST and CFG that the **front end** (clang) builds, so the front end stays in what must be trusted unless it is checked separately. P1 shrinks the *analyser* part of the trust; the front end is covered by the A14 dual-builder check, the C1–C3 continuity checks and clang's own validation history (A51).
- **Prior art:** certifying algorithms (McConnell, Mehlhorn, Näher and Schweitzer 2011); proof-carrying code (Necula 1997); abstraction-carrying code (Besson, Jensen and Pichardie 2006).
- **Position:** Known concept; using it to shrink qualification of a MISRA/coverage tool is a **Candidate** (unverified).

**P2 Intersection of sound over-approximations (Δ2).**
- **Claim:** if A₁ … Aₖ each contain every real behaviour (call targets, aliases, values), so does ⋂Aᵢ, and ⋂Aᵢ ⊆ each Aᵢ.
- **Proof:** a real behaviour lies in every Aᵢ, so it lies in the intersection. ∎
- **Prior art:** reduced product (Cousot and Cousot 1979). **Known.**

**P3 Refinement only removes infeasible behaviour (Δ2).** Splitting by predicates (D2.4 lifts, path sensitivity) removes only paths whose predicate values are contradictory.
- **Proof:** a feasible path has one consistent valuation along it, so it survives in the sheet for that valuation. Every true finding on it is kept, and alarms can only decrease. ∎
- **Prior art:** CEGAR, path-sensitive analysis. **Known.**

**P4 Quotient reuse (Δ1).** If a result is a function of an invariant I (it's the same whenever I is the same), compute it once per class of I.
- **Proof:** the factorisation theorem. ∎
- **Exactness:** fingerprints are confirmed by exact comparison (P→E).
- **Prior art:** memoisation, hash-consing. **Known.**

**P5 Incremental = from scratch (Δ1).** Each result is a deterministic function of its declared inputs. Reusing it when the inputs are byte-identical gives the from-scratch result.
- **Proof:** determinism plus exact comparison of inputs. ∎
- **Requirement:** every input must be declared, which is a design obligation checked by "rebuild from scratch and compare" in CI.
- **Position:** Known (build systems, e.g. Bazel); the requirement is ours to enforce.

**P6 Strictest proven model (Δ2):** D1.e.

**P7 Never silent (Δ4/soundness):** any gap is reported as *can't tell* with a reason, never as a pass.

### A.4 Injection, batch 1: the foundation (A01–A05, A14)
The foundation decides the integrity of everything above it, so it comes first. Honest note: the foundation admits **engineering refinements** with proofs. The mathematically rich opportunities are in later batches (metrics, rules, flow, coverage).

#### A01 Build capture
- **Industry:** compile databases or build interception, with one configuration per file. Product variants are analysed as separate projects, or only one is analysed.
- **Injection 1, completeness check (P7, Δ4):**
  - Every source file in the tree is either built (it has an entry), declared excluded, or reported "not analysed: no build entry".
  - **Proof:** the three sets partition the source files, so nothing is silently skipped. ∎
- **Injection 2, variant quotient (P4, Δ1):**
  - Analyse once per distinct **preprocessed token stream**, not once per build variant.
  - **Theorem:** two variants giving byte-identical token streams for a file, with the same target model (A02), get identical results for that file.
  - **Proof:** every later stage is a deterministic function of (token stream, target model) (P5). ∎
  - **Cheaper test:** a variant can be skipped before preprocessing if it differs from an analysed one only in `-D` macros whose names appear nowhere in the file's include closure, taken over **all** conditional branches (a superset). An unreferenced macro can't affect the token stream (by induction over preprocessing steps).
- **Prior art:** variability-aware analysis (TypeChef: Kästner et al. 2011; SuperC: Gazzillo and Grimm 2012). **Refinement.**

#### A02 Dialect and target model
- **Industry:** a hand-written or preset target configuration (type sizes, `char` signedness, built-ins). An error in it silently corrupts every result.
- **Injection, a probe-verified target model (Δ3):**
  1. Compile a **probe file** with the user's real compiler. It computes every needed fact as compile-time constants (`sizeof`, `_Alignof`, `CHAR_MIN < 0`, `(-1) >> 1`, `-7 / 2`, bit-field signedness, endianness macros, predefined macros through `-dM -E`).
  2. Generate a second file of `static_assert`s and compile it with **clang under our emulation flags**.
- **Theorem:** if every assertion passes, clang's view equals the real compiler's on every probed fact.
- **Proof:** each assertion states equality of one fact, and both sides were computed by the respective compiler. ∎
- **Facts that can't be probed** (e.g. behaviour of unspecified evaluation order) are listed in the report as assumptions (P7).
- Only compilation is needed, never running on the target.
- **Prior art:** Frama-C machdeps, cppcheck platform files, Polyspace target settings, all hand-configured. **Candidate** (verify that no tool auto-verifies them this way).

#### A03 Preprocessing record
- **Industry:** findings are reported at the expansion site or the macro definition, and tools differ. One defect in a macro body becomes hundreds of findings.
- **Injection 1, provenance as a graph map (C1–C3 of §1.3):** every expanded token maps to its spelling, and the continuity check runs on each file.
- **Injection 2, root-cause quotient (P4, Δ1):**
  - Findings whose cause lies entirely in a macro body are grouped as **one root finding with N instances**.
  - **Proof:** grouping is a partition of the finding set, so the same findings are present; each instance keeps its site, and nothing is dropped. ∎
- **Prior art:** macro-aware reporting exists in several tools. **Refinement.**

#### A04 Parsing
- **Industry:** a file with a parse error is skipped, or analysed with unspecified recovery.
- **Injection, function-level isolation (Δ4 with soundness):**
  - A function is analysed only if clang reports **no** diagnostic inside its range, **and** every declaration it uses is free of errors.
  - Everything else is reported *can't tell: parse error at …* (P7).
  - **Proof of soundness:** under those conditions, its AST is the AST clang would build for that function in an error-free file, because clang's semantic analysis of a function depends only on its own tokens and the declarations it references.
  - **Proof of Δ4:** the set analysed ⊇ the set analysed by file-level skipping.
  - **Caveat:** that dependence claim must be validated on clang's test suite before relying on it. Until then, the condition is strengthened to "no diagnostics anywhere before the function's end".
- **Position:** **Refinement.**

#### A05 Location mapping
- **Injection:** a round-trip check. Every finding's location maps to a token and back to the same location, so the C3 path lifting holds. A mismatch is an internal error (P7).
- **Position:** **Refinement** (an integrity check, not a new capability).

#### A14 Control-flow graph
- **Industry:** one CFG builder. C++ tools often assume every call may throw, which adds edges and false alarms in data-flow and resource checks.
- **Injection 1, two independent builders and topological invariants (Δ3-like):**
  - Our builder and clang's CFG must agree after smoothing nodes with one entry and one exit.
  - V(G) is computed two ways, and I1 and I2 are checked.
  - **Claim:** an error goes undetected only if both builders are wrong in the same way.
  - **Prior art:** N-version checking. **Known.**
- **Injection 2, proven "can't throw" (P2, Δ2):**
  - may-throw(f) is the **least** fixpoint of: f contains a `throw`, or calls a may-throw callee, or calls unknown code that may throw (callbacks, external C++).
  - Edges are added only for may-throw calls.
  - **Proof of soundness:** a real throw out of f needs a finite chain of calls ending in a `throw` or in unknown code. By induction on the chain's length, every function on it is in the least fixpoint, so no real exception edge is dropped. ∎
  - **Proof of Δ2:** the edge set ⊆ the "every call may throw" edge set, so alarms ⊆.
  - **Prior art:** LLVM's `nounwind` inference does the same for code generation. **Known**; applying it to analysis edges is a **Refinement**.

### A.4b Injection, batch 2: metrics and quality (A12–A13), 2026-10-31

**The industry problem:** tools disagree on the same code. They count `&&`/`||`, `switch` cases, macros, early returns and formatting differently, and quality models mix metrics with arbitrary weights. A number that depends on the tool or the formatting can't be trusted for certification. Batch 2 makes every metric a **well-defined invariant** with a stated invariance group, cross-checked by proven identities, and reported as an interval where the inputs are uncertain.

#### A12.0 New principle P8: interval metrics (Δ4, honesty)
- **Claim:** a metric that depends on an over-approximated relation R (indirect calls, aliases) is reported as **[m(R_must), m(R_may)]**, with the true value inside.
- **Proof:** if m is monotone in the relation and R_must ⊆ R_true ⊆ R_may (P2 soundness), then m(R_must) ≤ m(R_true) ≤ m(R_may). ∎
- **Example:** fan-out [3, 7] means "3 direct calls, up to 4 more through pointers".
- **Position:** **Candidate** (not seen in commercial metric reports; unverified).

#### A12.1 Cyclomatic complexity V(G)
- **Industry:** E − N + 2 or "decisions + 1". The results differ when tools build blocks differently or count `&&`/`||` differently.
- **Injection:** two named, invariant values:
  - **V_dec**, on the decision-level CFG;
  - **V_cond**, on the condition-level CFG, where each operand of `&&`/`||`/`?:` is its own node (Myers' extension, 1977).
- **Lemma 1 (invariance under block splitting):** subdividing an edge or merging a chain of one-in/one-out nodes leaves V unchanged.
  - **Proof:** subdividing adds one node and one edge, so E − N is unchanged. V is the first Betti number of G plus an exit→entry edge, a topological invariant. ∎
  - **Consequence:** how a tool forms basic blocks can no longer change V.
- **Lemma 2 (the two formulas agree):** for a connected CFG whose returns all lead to one exit node, V = E − N + 2 = 1 + Σ over decision nodes of (out-degree − 1).
  - **Proof:** Σ out-degree = E, so the sum over all nodes of (out-degree − 1) is E − N. The exit contributes −1, so the sum over the other nodes is E − N + 1. ∎
  - **Use:** V is computed both ways, and a mismatch is an internal error (Δ3).
- **Lemma 3 (rewrite invariance of V_cond):** `if (a && b) S` and `if (a) { if (b) S }` give the same condition-level CFG, so the same V_cond.
  - **Proof:** C's short-circuit semantics make the two graphs identical. ∎
  - V_dec differs (1 vs 2) and is reported as such.
- **Prior art:** McCabe 1976; Myers 1977. **Known.** Our contribution is the stated invariance group plus the self-check, a **Refinement**.

#### A12.2 Essential complexity ev(G): made well defined
- **Industry:** McCabe's ev(G) is "V of the graph after removing structured constructs". Tools differ on what counts as structured (`break`, `continue`, early `return`) and on the order of removal.
- **Injection:**
  1. Compute the **program structure tree** (Johnson, Pearson and Pingali, PLDI 1994: [paper](https://iss.oden.utexas.edu/Publications/Papers/PLDI1994.pdf)), the unique hierarchy of canonical single-entry/single-exit regions, found in linear time through **cycle equivalence** (two edges are equivalent when they lie on exactly the same cycles).
  2. Working bottom-up, collapse each canonical region whose collapsed interior is a structured primitive (sequence, if/else, while, do-while, switch without fall-through).
  3. ev(G) = V of the result.
  4. Early `return`, `break` and `continue` are an **explicit, reported option** (count as structured, or not; MISRA R15.5 suggests "not").
- **Theorem (well-defined):** ev(G) does not depend on the order of collapsing.
  - **Proof:** canonical regions are unique and laminar (nested or disjoint) by the PST theorem. Collapsing one region doesn't change the canonical regions disjoint from it or containing it, so every bottom-up order collapses the same set. ∎
- **Properties:** ev = 1 ⟺ fully structured under the chosen option; 1 ≤ ev ≤ V; linear time.
- **Prior art:** the PST and cycle equivalence are known and used in compilers ([V8](https://chromium.googlesource.com/v8/v8/+/432790c/src/compiler/control-equivalence.h), [GCC NVPTX patch](https://patchwork.ozlabs.org/project/gcc/patch/564CC75D.3020309@acm.org/), [Harpoon](https://flex.cscott.net/Harpoon/doc/harpoon/Analysis/SESE.html)). A first search found **no use of the PST to define essential complexity**. **Candidate** (unverified).

#### A12.3 Knots
- **Industry:** knots (Woodward, Hennell and Hedley 1979) count crossing jump arcs drawn beside the **line-numbered** listing, so putting two statements on one line can change the count.
- **Injection:**
  - Positions are the **statement order** in the AST, not line numbers, so knots don't change with formatting.
  - The arc convention (which jumps are drawn) is stated in the report.
  - Counted with a Fenwick-tree sweep in O(J log J).
- **Lemma 4 (structured ⇒ knot-free):** if ev = 1, under the convention that each construct draws its arcs within its own region, knots = 0.
  - **Proof:** in a fully structured function every arc lies inside one canonical region and spans its children, so the arc intervals form a **laminar family** (nested or disjoint). A laminar family has no partly overlapping pairs, and so no crossings. ∎
  - **Use:** ev = 1 with knots > 0 is an internal error (Δ3). The converse fails (an unstructured `goto` may not cross anything), so knots is reported **alongside** ev, never in its place.
- **Position:** **Refinement**; Lemma 4 as a self-check is a **Candidate**.

#### A12.4 Halstead
- **Industry:** operator/operand classification differs between tools. The derived "time" and "delivered bugs" figures are empirical formulas.
- **Injection:**
  - Counts come from a versioned table of clang token kinds, published in the specification, so they don't change with formatting or comments.
  - Counts are given on both the spelled tokens and the expanded tokens (A03).
  - The exact counts (n₁, n₂, N₁, N₂) and the formula-based volume and difficulty are **exact given the table**.
  - "Time" and "bugs" are labelled **empirical model, not a measurement**.
- **Position:** **Refinement** (honest labelling).

#### A12.5 Paths: NPATH and the exact acyclic path count
- **Industry:** NPATH (Nejmeh 1988) is defined by grammar rules, so it's an estimate of path count with its own conventions, and it overflows on large functions.
- **Injection:**
  - Report Nejmeh's NPATH (labelled as such) **and** the **exact** number of entry→exit paths in the CFG with back edges removed.
  - The count uses dynamic programming in topological order over (ℕ, +, ×) with arbitrary-precision integers: O(E) big-integer additions.
- **Lemma 5 (paths ≥ V, loop-free functions):** for a loop-free CFG where every node lies on an entry→exit path, the number of paths ≥ V(G).
  - **Proof:**
    - Add the exit→entry edge e*. Each path P gives a cycle P + e*.
    - Removing e* leaves a DAG with no cycles, so every cycle in the cycle space uses e*.
    - Every such cycle splits into entry→exit paths, so the cycles {P + e*} span the cycle space, whose dimension is V.
    - Hence at least V paths. ∎
  - **Use:** a self-check (Δ3).
- **Position:** **Known**, plus a **Refinement** (exact count and self-check).

#### A12.6 Testability: a proven lower bound on test count
- **Industry:** V(G) is used informally as "number of tests needed".
- **Injection:** report **T_branch**, the minimum number of entry→exit walks that together cover every edge. It's computed exactly as a **minimum flow with a lower bound of 1 on every edge** (Ntafos and Hakimi 1979, on path covers for testing), in polynomial time.
- **Theorem (lower bound):** every test set achieving full branch coverage has at least T_branch tests.
  - **Proof:** each test executes one entry→exit walk. A covering set of walks is a feasible flow meeting every lower bound, and its value equals the number of walks. T_branch is the minimum such value. ∎
- **Honesty:** infeasible paths can only **raise** the real number, so T_branch is a lower bound, never a promise. Both T_branch and V(G) are reported.
- **Position:** the algorithm is **Known**; reporting it as a proven testability bound in an analyser is a **Candidate**.

#### A12.7 Nesting, size, comments, fan-in and fan-out
- **Nesting:** depth in the loop nesting forest. It's unique for reducible graphs, so irreducible functions are reported as "irreducible" instead of an arbitrary number.
- **Size:** logical statements from the AST (formatting-invariant) and physical lines, both named.
- **Comment density:** comment tokens ÷ (code + comment tokens), formatting-invariant, plus the line-based figure, both named.
- **Fan-in and fan-out:** intervals by P8.
- **Position:** **Refinement.**

#### A12.8 Every metric value is checkable (P1)
- **What's reported:** with each value, its **witness elements**: the decision nodes counted, the operators and operands, the collapsed regions, the crossing arc pairs, the minimum-flow solution.
- **The checker** recomputes the value from the witness and the CFG in linear time.
- **Proof:** each formula is a simple function of the witness. Witness consistency (e.g. every listed decision node really has out-degree > 1) is checked locally. ∎

#### A12.9 Invariance table

| Metric | Formatting / comments | Block splitting | Renaming | `&&` → nested `if` | Macro spelled vs expanded |
|---|---|---|---|---|---|
| V_dec | ✓ | ✓ (Lemma 1) | ✓ | ✗ (by design) | reported both |
| V_cond | ✓ | ✓ | ✓ | ✓ (Lemma 3) | reported both |
| ev | ✓ | ✓ | ✓ | ✓ | reported both |
| Knots (statement order) | ✓ | ✓ | ✓ | depends on the arc convention (stated) | reported both |
| Halstead counts | ✓ | ✓ | ✓ (counts, not names) | ✗ | reported both |
| Exact path count | ✓ | ✓ | ✓ | ✓ on the condition-level CFG | reported both |
| T_branch | ✓ | ✓ | ✓ | ✗ on the decision-level CFG | reported both |

**Metamorphic tests:** each ✓ is tested by applying the transformation to the corpora and requiring identical values (SKYFLOWX-TASK §9 guardrail 5).

#### A13 Quality model: non-compensatory and explainable
- **Industry:** threshold checks and weighted scores. Weights let one good metric hide a bad one (excellent comments "compensating" for an unreadable function), and grades can't always be explained.
- **Injection:**
  - **Per-metric grade:** gᵢ = a monotone step function of metric i, with thresholds from the chosen metric set. For automotive that's the HIS metric set; its thresholds are taken from its published document at implementation, not quoted from memory.
  - **Overall grade:** G = min over i of gᵢ (the bottleneck).
  - **Explanation:** the reason is the metric(s) achieving the minimum.
- **Theorem (axioms, proven):**
  - **(a) Monotone:** a worse value on any metric never improves G, because the minimum of monotone functions is monotone.
  - **(b) Non-compensatory:** G ≤ gᵢ for every i, so no metric can be hidden by another.
  - **(c) Explainable:** G = g_j for some j, which is a witness the checker verifies (P1).
  - **(d) Invariant** under every transformation in A12.9 marked ✓ for all the metrics used.
  - **Proof:** (a), (b) and (c) are properties of min; (d) follows from the table. ∎
- **"Fix first" order without weights:** rank functions by **Pareto layers** of badness.
  - Layer 1 holds the functions no other function is worse than on every metric at once.
  - **Claim:** if f is worse than or equal to g on every metric, f is never ranked below g.
  - **Proof:** non-dominated sorting places a dominated element in a strictly later layer than an element that dominates it. ∎
- **Prior art:** non-compensatory (conjunctive) aggregation and Pareto sorting are known in decision theory and optimisation. Applying them to code-quality grading with certificates is a **Refinement**.

#### Batch 2 summary

| Atom | Improvement type | Position |
|---|---|---|
| V_dec / V_cond with invariance and self-check | Δ3, determinism | Refinement |
| ev via the program structure tree | Well defined, linear time | **Candidate** |
| Knots on statement order, plus Lemma 4 | Invariance, Δ3 | Refinement / Candidate |
| Halstead with a published table and honest labels | Determinism | Refinement |
| Exact path count, plus Lemma 5 | Exactness, Δ3 | Refinement |
| T_branch lower bound | A new proven bound | **Candidate** |
| Interval metrics (P8) | Δ4, honesty | **Candidate** |
| Metric certificates | Δ3 | Candidate (P1) |
| Non-compensatory, explainable quality model; Pareto "fix first" | Proven axioms | Refinement |

### A.4c Injection, batch 3: rules (A06–A11), 2026-10-31

**The industry problems:**
1. **Hand-maintained cross-standard mappings:** MISRA's own Addendum 3 maps CERT C to MISRA C by hand, using the classes explicit / implicit / restrictive / partial / none ([MISRA C:2023 ADD3](https://misra.org.uk/app/uploads/2025/03/MISRA-C-2023-ADD3-CERT.pdf), [C:2012 matrix](https://misra.org.uk/app/uploads/2024/01/MISRA-C-2012-Addendum-3-Matrix-v-CERT-C.pdf)). Vendors publish their own unproven coverage tables ([Klocwork](https://help.klocwork.com/2023/en-us/concepts/codingstandardsmappedtoklocworkcheckers.htm), [Polyspace](https://www.mathworks.com/help/bugfinder/ug/polyspace_coverage_coding_standard.html)).
2. **Undecidable rules give "violation / not found"** with no measure of how much was actually proven.
3. **Deviations anchored to line numbers** drift when code changes.

#### A06 Rule catalogue: rules as formulas, mappings proven by homomorphism
- **Industry:**
  - Rules are prose plus checker code.
  - Rules written as logic programs have been proposed for conformance checking ([Marpons et al., arXiv 0711.0344](https://arxiv.org/pdf/0711.0344)), but not for **proving relations between rules**.
  - A first search found no automated subsumption between rule formalisations.
- **Injection:**
  - The *candidate test* of each structural rule is written as a **conjunctive query** (CQ), or a union of them (UCQ), over AST relations: `Node(n, kind)`, `Child(p, c, role)`, `Type(n, t)`, `EssCat(n, c)`, `InMacro(n)`, and so on.
  - Rules that need negation, counting or flow keep their checker code and are mapped by hand, with that **labelled**.
- **Theorem (Chandra and Merlin 1977):** for CQs Q₁ and Q₂, Q₁ ⊆ Q₂ on all databases ⟺ there is a **homomorphism** from Q₂ into the canonical database of Q₁ that preserves the head.
- **Theorem (Sagiv and Yannakakis 1980):** for unions, ⋃Pᵢ ⊆ ⋃Qⱼ ⟺ each Pᵢ ⊆ some Qⱼ.
- **Consequence: the mapping classes are computed and proven.** For a CERT rule C and a set M of MISRA rules:

| Relation (computed) | Meaning | Addendum-style class |
|---|---|---|
| C ⊆ ⋃M and ⋃M ⊆ C | Same violations | explicit |
| ⋃M ⊆ C, strictly | MISRA flags less than C asks | partial |
| C ⊆ ⋃M, strictly | MISRA forbids more (stricter) | restrictive |
| Overlap only | Some cases shared | partial |
| No overlap | Unrelated | none |

- **Soundness:**
  - Containment over **all** structures implies containment over real ASTs, so every "⊆" the tool claims is true.
  - A "not contained" result comes with a counterexample: the canonical database. It's turned into C code and checked by parsing. If it isn't a valid program, the result is "possibly contained", never "not contained" (P7).
- **Bonus: user-defined standards are checked for:**
  - **redundancy:** a rule contained in another;
  - **conflict:** two rules whose combined demands no code can meet (an unsatisfiable conjunction, checked the same way).
- **Cost:** CQ containment is NP-complete, but rule queries are small (a handful of atoms), so it's instant in practice.
- **Limits:** with inequalities, containment gets harder (Π₂ᵖ); with full negation it's undecidable (Trakhtenbrot). Those rules stay hand-mapped and labelled.
- **Position:** **Candidate (strong):** automatic, *proven* cross-standard mapping and standard consistency checking.

#### A07 Lexical rules: one pass for all of them
- **Industry:** each rule scans the tokens.
- **Injection:** compile every lexical rule's pattern into one automaton (Aho–Corasick for keyword sets; a product DFA for token-sequence patterns), run once over the tokens.
- **Δ1 proof:** the product automaton accepts exactly the union of the languages and records which component accepted, so the results equal running each rule separately. Cost is O(tokens), independent of the number of rules. ∎
- **Explicit:** whether a rule reads **spelled** or **expanded** tokens (A03).
- **Position:** **Known** (lexer generators, Aho and Corasick 1975).

#### A08 Syntactic rules: one tree automaton plus the feature basis
- **Injection:** compile all structural rules into one bottom-up **tree pattern automaton** (Hoffmann and O'Donnell 1982), combined with the feature basis of SKYFLOWX-TASK §5.1 (shared tests, as in the Rete algorithm, Forgy 1982).
- **Δ1 proof:** each node's automaton state encodes exactly which pattern prefixes match, so the results equal running the rules separately. One pass, O(nodes). ∎
- **Position:** **Known**; combining it with A06's proven mappings is a **Refinement**.

#### A09 Semantic rules: essential types proven by exhaustion
- **Industry:** the essential type model (MISRA R10) is implemented by hand; correctness rests on testing samples.
- **Injection 1, a fold (§3 M5):** the essential type of an expression is a fold over its tree, unique by the initial-algebra property.
- **Injection 2, exhaustive verification (Δ3):**
  - The model's domain is **finite**: categories (Boolean, character, signed, unsigned, enum, floating) × ranks, and a finite set of operators.
  - Our implementation is checked on **every** (operator, operand category, operand category) combination against a table written from the licensed standard.
  - **Proof:** an exhaustive check over a finite domain is a proof of agreement on that whole domain. ∎
  - **Constants:** the essential type of integer constant expressions depends on the value; it's computed with exact big-integer arithmetic, then the same table applies.
- **Benefit for qualification:** the check's correctness is **proven, not sampled**.
- **Position:** **Candidate** (exhaustive proof as qualification evidence).
- **Unsequenced side effects (R13):** for each full expression, build C's sequenced-before partial order (C11 §6.5). Two conflicting accesses that are unordered:
  - must-alias (P2): **proven violation**;
  - may-alias: **possible**, with the aliasing reason;
  - no alias: **pass**.
  - Small per expression (k accesses → O(k²)).
  - **Position:** **Refinement.**

#### A10 Flow and system rules: a sandwich with "proof coverage"
- **Injection 1, a two-sided sandwich** for every undecidable rule:
  - an **over-approximation** (sound: it finds every violation; anything it doesn't flag is **proven compliant**);
  - an **under-approximation** (every report is a real violation, with a witness path validated by replay or SMT: **proven violation**);
  - anything in between is **possible**.
  - **Proof:** Over ⊇ True ⊇ Under, so "outside Over" ⇒ compliant and "inside Under" ⇒ violation. ∎
  - **Prior art:** may/must abstractions (Godefroid, Nori, Rajamani and Tetali 2010). **Known.**
- **Injection 2, proof coverage (new honesty metric):** for each rule and each file, report
  - **proven compliant %**
  - **proven violation count**
  - **possible count**
  - This shows how much of the code is *actually proven*, not just how few warnings appeared.
  - **Position:** **Candidate.**
- **Injection 3, cross-file rules, incremental and exact (P5, Δ1):** compatibility constraints for declarations (R8) and identifier rules (R5) only relate declarations with the same name and linkage, so the constraint graph **splits by name bucket**.
  - After an edit, only the buckets the changed file touches are rebuilt with union-find, so the result equals a full rebuild.
  - **Proof:** the buckets are independent by construction, and each bucket's result is a deterministic function of its members. ∎
  - **Identifier distinctness:** the classes are "equal in the first k significant characters", with k set per standard (M4); found in O(n) by hashing prefixes.
  - **Position:** **Refinement.**
- **Unused code across files:** reachability from entry points, reported as an interval (P8): "proven unused" versus "unused unless reached by pointer".

#### A11 Deviations: fingerprint anchoring with no silent spread
- **Industry:** deviations are attached to lines, comments or suppression markers. After edits they go stale (still suppressing changed code) or are lost (moved code needs re-approval).
- **Injection:**
  - Each deviation is anchored to (rule id, **semantic fingerprint**). The fingerprint is the canonical form (M6) of the smallest enclosing statement or declaration, plus the finding's witness.
  - It has no line numbers and no names of unrelated code.
  - A finding is suppressed **only if** its exact pair is in the approved set.
  - Changed code shows "deviation needs re-approval", with a diff of the canonical forms.
- **Theorems:**
  - **(a) No silent spread:** a deviation never suppresses a finding it wasn't approved for. By construction, suppression needs an exact pair match (fingerprints confirmed exactly, P→E).
  - **(b) Stable under unrelated edits:** moving code, reformatting, or editing other statements leaves the canonical form unchanged, so no re-approval is needed.
- **Process:** deviation records, approvers and scopes follow the deviation permits of MISRA Compliance:2020.
- **Prior art:** result fingerprints exist (e.g. SARIF `partialFingerprints`). **Refinement.**

#### Batch 3 summary

| Atom | Improvement type | Position |
|---|---|---|
| Proven cross-standard mapping and standard consistency through CQ containment (homomorphisms) | Δ3, replaces manual tables | **Candidate (strong)** |
| One-pass lexical and syntactic matching | Δ1 | Known |
| Essential types proven by exhaustive check over a finite domain | Δ3 (qualification) | **Candidate** |
| Unsequenced side effects with must/may aliasing | Δ2 | Refinement |
| Sandwich verdicts plus **proof coverage** per rule | Honesty metric | Known / **Candidate** |
| Incremental cross-file rules by name buckets | Δ1 | Refinement |
| Fingerprint-anchored deviations | Process soundness | Refinement |

### A.4d Injection, batch 4: flow (A15–A22), 2026-10-31

#### A15 Call graph
- **Industry:**
  - virtual calls: class-hierarchy analysis;
  - function pointers: "any address-taken function" or type matching (unsound when the code casts pointers).
- **Injection:**
  - **Candidate targets** = (address-taken functions) ∩ (type-compatible, **or** cast to that type somewhere) ∩ (points-to set). For virtual calls: class hierarchy ∩ classes actually instantiated (RTA) ∩ points-to.
  - **Proof:** each set contains every real target, so their intersection does too (P2), and it's ⊆ each (Δ2). ∎
  - The cast clause keeps the type filter sound under C casts.
- **Reporting:**
  - fan-out and reachability as intervals (P8);
  - every function not reachable from a declared entry point is listed: "unreached", or "reached only through a candidate" (P7).
- **Prior art:** RTA (Bacon and Sweeney 1996), reduced product. **Known**; the cast-aware type filter is a **Refinement**.

#### A16 Data-flow anomalies: one engine for every path property (the transition monoid)
- **Industry:** DU/UR/DD over all CFG paths, insensitive to correlated branches. Each anomaly kind is coded separately.
- **Injection 1, anomalies are a regular path property:**
  - Per variable, the events along a path form a word over {d = define, u = use, k = kill/out of scope}.
  - Each anomaly is a pattern of that word, recognised by a small DFA (Fosdick and Osterweil 1976; Huang 1979).
  - The DFA's **transition monoid** (the functions from states to states, composed along the path) is a finite monoid. So **D2.2's spanning-tree potential theorem applies unchanged.**
- **Consequence:**
  - **Fast exact pass:** if the potential exists, there are no anomalies of that variable, proven in O(E).
  - **Evidence:** otherwise, the two disagreeing paths.
  - **One engine, one proof, many properties:** data-flow anomalies (A16), resources (A21, D2) and use-after-close all become different monoids.
- **Injection 2, exact over graph paths in the general case:**
  - When the potential doesn't exist, use the product CFG × DFA. The set of DFA states reachable at a node is **exactly** the set reached over all paths to it, found by graph reachability in O(E·|Q|).
  - **Proof:** product paths correspond one-to-one to (CFG path, DFA run) pairs. ∎
- **Injection 3:** correlated branches are handled by lifting (D2.4/P3, Δ2).
- **Two strengths reported:** *must* (on all paths: definite) and *may* (on some path).
- **Prior art:** typestate and automata-based path properties are known. The **monoid potential as one linear-time proof engine for all regular path properties** is a **Candidate** (generalises D2.2).

#### A17 Cross-reference
- **Injection:**
  - Symbols are identified across files by clang's USRs (unified symbol identifiers), so two different symbols that share a name are never merged.
  - Macro uses are recorded at both spelling and expansion (A03).
  - The cross-reference is built from the same AST as the analysis, which makes the two consistent by construction.
- **Position:** **Known / Refinement.**

#### A18 Information flow
- **Industry:** dependency relations per function (Bergeretti and Carré 1985; SPARK).
- **Injection:**
  - Explicit flows come from def-use; implicit flows come from **control dependence** (Ferrante, Ottenstein and Warren). They compose as Boolean matrices (§3 M3, M9).
  - **Certificates (Δ3):**
    - a claimed **dependence** carries a path in the dependence graph;
    - a claimed **independence** ("output o never depends on input i") carries a **cut**: the set of nodes reachable backwards from o, shown to exclude i. The checker re-runs one reachability, which is linear.
- **Soundness:** no dependence-graph path from i to o implies non-interference for terminating runs (machine-checked for PDGs: Wasserrab, Lohner and Snelting 2009). Timing and termination channels are **out of scope**, and that's stated.
- **Position:** **Refinement** (certificates).

#### A19 Data and control coupling: a precise definition, proven sets, minimal probes
- **Industry:** DO-178C requires tests to exercise the data and control coupling between components. The term is notoriously ambiguous in practice: the FAA's CAST-19 position paper was written to clarify it. Tools mostly list interfaces and leave the judgement to people.
- **Injection, definitions:**
  - Components C₁…C_m are declared by the user (files, modules or partitions).
  - **Data coupling DC:** the set of (P, v, C) where a definition of v in component P **reaches** a use in component C ≠ P. It's computed from interprocedural def-use chains, through globals, parameters, return values and pointers (P8 interval for aliasing).
  - **Control coupling CC:** the set of (caller's component, callee's component, call site), including indirect calls (an A15 interval).
- **Theorem (static completeness):** DC_static ⊇ DC_real and CC_static ⊇ CC_real.
  - **Proof:** reaching definitions and the A15 candidates are sound over-approximations. ∎
- **Coverage:**
  - Each coupling is **exercised** (seen at run time by A29/A30 probes), **proven infeasible** (a sandwich certificate, A10), or **open**.
  - The claim "every coupling is exercised or proven infeasible" is then backed by certificates (P1).
- **Minimal probes (Δ1):** only the defs and uses **on component boundaries** are instrumented, not every def-use pair. Call edges use dominator-based probe reduction (§4.4).
- **Position:** **Candidate.** It addresses a documented ambiguity with a precise, checkable definition. To verify against DO-178C's wording in the user's copy.

#### A20 Run-time defects (abstract interpretation)
- **Injection 1:** the sandwich and proof coverage (A10).
- **Injection 2, certificates (Δ3):** every "proven safe" carries the **invariant** at each loop head and call.
  - The checker verifies it is **inductive** by local checks: entry ⇒ invariant, and invariant + one step ⇒ invariant. That's far easier than finding it.
  - **Prior art:** abstraction-carrying code. **Known.**
- **Injection 3, verified blame for imprecision:** a "possible" alarm usually comes from one merge or widening that lost precision.
  - We name the **earliest join or widening** whose splitting (P3) **removes** the alarm, and confirm it by re-running the analysis with that split. The blame is a **checked counterfactual**, not a guess.
  - If no single split removes it, it's reported as "not caused by one merge".
  - **Proof:** the re-run's result is the evidence, and P3 guarantees the split loses no real error. ∎
  - **Position:** **Candidate.**
- **Ranking:** Bayesian ordering of findings, learned from user confirmations (F5), applied only to *possible* findings, never to proven ones.

#### A21 Resources
- See **D2**: monoid labels (bicyclic and polycyclic), the linear-time proof, lifting, summaries, must/may windows.
- **New here:** it is one instance of A16's single engine (transition monoids).

#### A22 Concurrency: closing the flag-synchronisation gap
- See **D1** for the models, the proofs of interrupt interference and cutoffs, and the provider closure.
- **Documented gap:** Chopra, Pai and D'Souza (ESOP 2019) note that lockset and disjoint-block methods are **not precise enough for flag-based synchronisation**. That's the typical embedded pattern:
  ```c
  /* thread */  buf = compute(); ready = 1;
  /* ISR    */  if (ready) { use(buf); ready = 0; }
  ```
- **Injection, guarded interference (extends D1.a′ Theorem 1):**
  - Let σ(g) be the set of possible values of the handler's **guard variables** (e.g. `ready`) at gap g of the thread. A flag that is only set or cleared has a finite transition monoid, so σ comes from the A16 engine.
  - **Theorem 1′:** interference on W is possible ⟺ some enabled gap g inside W has a handler path that **is feasible under some value in σ(g)** and makes a conflicting access.
  - **Proof:**
    - (⇒) As in Theorem 1. In addition, the handler's actual path at g is feasible under the actual guard value at g, which lies in σ(g) by soundness.
    - (⇐) For a *proven* report, use must-values: if σ(g) is exact (a single value), an activation at g takes that feasible path (A5). Otherwise the report is *possible*.
    - Lifting (P3) removes paths ruled out by the guard, so true interference is kept. ∎
  - **Example result:** at the gap where `compute()` writes `buf`, σ(g) = {ready = 0} on the first round, so the handler's `use(buf)` path is infeasible and **no false alarm** is raised. If `ready` can still be 1 from a previous round (the handler didn't clear it, or the thread sets it early), σ(g) contains 1 and the race is reported with that path.
- **Required checks (assumption A9):**
  - the flag write must be ordered after the data writes **at compiler level**: `volatile` alone doesn't order non-volatile `buf`; it needs a compiler barrier, `atomic_signal_fence`, or `buf` made volatile/atomic;
  - on multi-core, release/acquire is needed (D1.k).
  - A missing barrier is reported as a **violation** in its own right, a real and common bug class.
- **Position:** **Candidate.** It targets a documented weakness of existing static methods, with a linear-time check plus guard values. Prior art to check further: SDRacer's symbolic validation ([arXiv 2305.17869](https://arxiv.org/pdf/2305.17869)).

#### Batch 4 summary

| Atom | Improvement type | Position |
|---|---|---|
| Cast-aware intersected call targets, unreached list | Δ2, P7 | Refinement |
| **One monoid engine for every regular path property** (anomalies, resources, close/use) | Δ1/Δ2, linear proof plus evidence | **Candidate** |
| Exact product reachability over graph paths | Exactness | Known |
| Information-flow certificates (path or cut) | Δ3 | Refinement |
| **Data/control coupling:** precise definition, proven completeness, minimal probes | Δ3, Δ1 | **Candidate** |
| Defect invariants as checkable certificates | Δ3 | Known |
| **Verified blame for imprecise alarms** | A new, checkable explanation | **Candidate** |
| **Guarded interference for flag synchronisation** (Theorem 1′) | Δ2 on a documented gap | **Candidate** |

### A.4e Injection, batch 5: coverage (A23–A32), 2026-10-31

**Rule for the whole batch: coverage must never over-claim.** Reported coverage ⊆ true coverage, always. Equality is claimed only where it is proven.

#### A23 Instrumentation: probes that never over-claim
- **Industry:**
  - one probe per block or edge;
  - or optimal placement assuming every run **completes**: Knuth and Stevenson 1973, Ball and Larus 1994 for counts; Agrawal 1994 for hits, which uses both dominators and post-dominators.
  - On embedded targets, runs often **don't complete** (a reset, an infinite main loop, a debugger halt), and post-dominator inference then reports code as run when it wasn't.
- **Injection, a completion-aware hybrid:**
  - Probes are placed on the leaves of the dominator tree of the **edge-split** graph (blocks plus edges as nodes).
  - Two small counters per function count **entries** and **normal exits**.
  - When the checker reads the data:
    - if, for a function, entries = exits (every activation completed), Agrawal's full inference with post-dominators is valid;
    - otherwise only dominator inference is used.
- **Theorem:**
  - **(a) Never over-claims, in all cases:** reported ⊆ true.
  - **(b) Exact** for every function whose activations all completed.
- **Proof:**
  - (a) Dominator inference is sound for any prefix of a run: if v ran, each dominator of v ran before it. Post-dominator inference is used only where every activation reached the exit, and it is sound there.
  - (b) For complete entry→exit paths, dominator plus post-dominator inference from super-block leaves determines every node exactly (Agrawal). ∎
- **Cost:** the minimal probe set plus 2 counters per function.
- **Plus the C4 subdivision check:** probes only split edges, so the original flow is preserved.
- **Position:** **Candidate (refinement):** completion-gated inference, soundly applicable to non-terminating embedded code.

#### A24 Target integration
- **Injection:**
  - a probe-data header carrying the build fingerprint, the compiler and target model (A02), and a CRC over GF(2);
  - transfer by UART, semihosting, debugger memory dump or file.
- **Theorem:** data is merged only into the build it came from: an exact fingerprint match is required (P→E).
- **Position:** **Refinement.**

#### A25–A26 Statement and branch/decision coverage
- **Injection:**
  - named definitions: decision-level vs condition-level branches; implicit `default` edges; short-circuit edges;
  - each checked against the definitions in the user's DO-178C copy at implementation;
  - invariance as in A12.9.
- **Self-checks (lattice consistency, Δ3):**
  - every covered branch implies its source statement is covered;
  - every covered MC/DC independence pair implies both outcomes of that decision are covered (the pair's outcomes differ by definition), so MC/DC 100% ⇒ decision 100%;
  - every covered LCSAJ implies its statements and its jump are covered.
  - Any violation is an internal error.
  - **Proof:** each implication follows directly from the definitions. ∎
- **Position:** **Refinement.**

#### A27 MC/DC
- **Industry, state of the art:** Clang/LLVM records **executed test vectors** in a bitmap, with an index accumulated condition by condition. The old cap of 6 conditions was raised by storing possible test vectors instead of all combinations ([RFC](https://discourse.llvm.org/t/rfc-coverage-new-algorithm-and-file-format-for-mc-dc/76798), [PR #82448](https://github.com/llvm/llvm-project/pull/82448)). The RFC notes that real code can produce **billions** of possible vectors.
- **Injection 1, exact analysis:**
  - Each decision has a reduced, ordered BDD in C's short-circuit order (M14).
  - Executed vectors are paths in it.
  - Independence pairs come from the Boolean derivative ∂f/∂xᵢ (M8), for both unique-cause and masking MC/DC.
  - Coupled conditions (the same variable twice, or conditions proven dependent) are detected and reported: unique-cause is impossible for them, so masking is offered instead.
  - **Known** (the method); our addition is reporting both forms side by side.
- **Injection 2, bounded memory without losing exactness (P7):**
  - When a decision's number of possible vectors exceeds the target's memory budget, record **executed** path ids in a fixed exact table (not a Bloom filter). Its size is bounded by the number of distinct vectors actually executed.
  - If the table overflows, the decision is flagged "incomplete record" and never silently truncated.
  - **Theorem:** without overflow, the recorded set equals the executed set. With overflow, the report says so, and the coverage computed from the recorded subset is still never over-claimed.
  - **Position:** **Refinement.**
- **Injection 3, the missing tests, verified:**
  - For each condition not yet shown independent, the **partner vectors** that would complete a pair with an already-executed vector are exactly those with xᵢ flipped and ∂f/∂xᵢ = 1.
  - The minimum number of additional vectors is a small set-cover problem, solved exactly by integer programming (n is small per decision).
  - Each vector's **feasibility** is checked by SMT on the path condition to the decision (S7/S11), giving concrete inputs or "infeasible, with proof".
  - **Theorem:** each suggested vector, if executed, completes the pair it was chosen for. By definition of the independence pair. ∎
  - **Position:** **Candidate**, combined with S11 test generation.
- **Reported bound:** at least n+1 tests are needed for unique-cause MC/DC with n independent conditions. **Known.**

#### A28 LCSAJ: exact from jump pairs
- **Industry:** LCSAJ (Woodward, Hennell and Hedley) is defined on the program text: start, linear sequence, jump. It is hard to derive from edge hits, because it depends on **which jump led in**.
- **Injection:**
  - Positions are statement order (as for knots, A12.3), so LCSAJs don't change with formatting.
  - Instrumentation keeps the **last jump target** per activation in a local variable; at each jump it records the pair (last target or entry, this jump), which is exactly one LCSAJ id from a static enumeration.
- **Theorem:** the recorded pairs are exactly the executed LCSAJs.
  - **Proof:** an LCSAJ is a maximal linear run from a jump target (or entry) to a jump. The last jump target before a jump is precisely its start, and the jump gives its end and target. ∎
- **Cost:** one register write per jump, plus one bit per LCSAJ.
- **Also reported:** TER₁, TER₂ and TER₃, with the lattice self-checks (A25–A26).
- **Position:** **Refinement** (LDRA's own method isn't public).

#### A29 Procedure-call coverage
- **Injection:** a call edge is inferred from the callee's entry hit when the callee has **one** caller site; otherwise there's a probe at the call site. Indirect calls are recorded with their actual targets, which narrows A15's candidates by observation.
- **Position:** **Known / Refinement.**

#### A30 Dynamic data-flow coverage: exact through SSA origins
- **Industry and research:** dynamic def-use coverage is costly; the standard method tracks "last definitions". Santelices and Harrold (ASE 2007, [paper](https://personal.utdallas.edu/~lxz144130/cs6301-readings/coverage-santelices-ase07.pdf)) infer many def-use pairs from **branch** coverage and **predict** the rest "with high accuracy", which is approximate.
- **Injection, exact and cheap with SSA:**
  - **Non-φ uses (Lemma):** in SSA, a definition dominates all its uses. If use u of SSA variable v ran in an activation, then v's single definition ran before it in that activation, so the pair (def(v), u) is exercised **iff u ran**. No extra probe is needed beyond statement coverage.
  - **Merges (shadow origins):** for source variables merging at φ-nodes, keep a **shadow origin id** per variable, assigned statically at each definition and copied only at φ-nodes, i.e. one copy per taken φ edge. At a use of interest, record (origin, u).
  - **Theorem:** the recorded pairs equal the exercised source-level def-use pairs.
  - **Proof:** by induction on execution steps, the shadow holds the id of the definition whose value the variable currently holds. Definitions set it, φ-copies move it with the value, and nothing else changes either. ∎
  - **Cost:** proportional to φ-nodes plus uses of interest, not to all definitions.
- **Use:** A19 coupling coverage needs only the uses that cross component boundaries.
- **Position:** **Candidate (refinement)**: exact where the prior art predicts.

#### A31 Object-code verification: untraceable code found automatically
- **Industry:** for the highest assurance level, code the compiler generated without a direct source counterpart must be verified at object level. Identifying it is largely manual review.
- **Injection:**
  - Build the object-level CFG (offline LLVM disassembler) and map it to the source CFG through the DWARF line table.
  - Run the continuity checks C1–C3 (§1.3).
- **Theorem:**
  - **(a)** For the mapped part (a graph map, onto, with path lifting), covering a source edge implies covering some object path for it.
  - **(b)** Object edges **without a source preimage** (bounds checks, jump tables, compiler helper calls, branch duplication) are listed exactly. They need object-level coverage, which the same probe or trace data provides.
  - **Proof:** (a) is path lifting; (b) is the complement of the image, computed edge by edge. ∎
  - **Caveat:** line tables at high optimisation levels are imperfect. Where the map fails C1, the function is flagged "mapping not trustworthy" (P7) and needs object-level coverage in full.
- **Position:** **Candidate.**

#### A32 Aggregation and carry-over
- **Injection:**
  - hit sets are combined by union (exact);
  - MC/DC pairs may combine vectors from different tests, which the standard definitions allow;
  - every merge requires matching fingerprints (A24).
- **Carry-over across code changes:** a test's coverage carries to a new build if **every function the test executed** (recorded as per-test function-entry sets) is unchanged by canonical fingerprint.
  - **Proof:** with deterministic code on the executed path and the same inputs, the execution is identical. ∎
  - **Assumption, stated:** no environmental nondeterminism. Tests marked nondeterministic are always rerun.
  - **Position:** **Known** (safe regression test selection, Rothermel and Harrold 1997).
- **Coverage certificate (P1):** probe data, build fingerprint, subdivision proof and inference steps. The checker recomputes the reported coverage from these alone. **Candidate** (with P1).

#### Batch 5 summary

| Atom | Improvement type | Position |
|---|---|---|
| Completion-gated probe inference (never over-claims; exact for completed functions) | Soundness on embedded targets | **Candidate** |
| Fingerprinted probe data | Integrity | Refinement |
| Coverage lattice self-checks | Δ3 | Refinement |
| MC/DC: both forms, exact bounded record, verified missing-test vectors | Exactness, tests generated with proof | Known / **Candidate** |
| Exact LCSAJ from jump pairs | Exactness, low cost | Refinement |
| Exact def-use coverage through SSA shadow origins | Exact where prior art predicts | **Candidate** |
| Automatic untraceable-object-code list through continuity | Replaces manual work | **Candidate** |
| Safe carry-over, coverage certificates | Δ1, Δ3 | Known / Candidate |

### A.4f Injection, batch 6: testing (A33–A43), 2026-10-31

#### A33 Unit interface extraction: complete by proof
- **Industry:** parameters, globals and calls, extracted from control and data flow (TBrun's public description).
- **Injection:**
  - **Inputs** = parameters, upward-exposed reads of globals and statics, memory read through pointers (a P8 interval), callee return values, and **environment inputs**: `volatile` reads, memory-mapped registers, time, I/O.
  - **Outputs** = return value, out-parameters, globals written that are live at exit, and calls made, with their arguments.
- **Theorem (complete interface):** every output depends only on the listed inputs, so a harness that controls all of them makes the unit test **deterministic**.
  - **Proof:** S6 dependence is sound (A18), so no unlisted input can reach an output. ∎
- **Hidden inputs** (environment reads) are listed explicitly and need stubs or control (P7). A test touching an uncontrolled one is marked "may be nondeterministic".
- **Position:** **Refinement.**

#### A34–A35 Harness and stubs: closed by a call-graph cut
- **Injection:**
  - The unit boundary is a set U of functions.
  - **Stubs** = every function outside U reachable by one call edge from U, including all **may**-targets of indirect calls (A15).
- **Theorem (closure):** a test of U executes only code in U ∪ stubs.
  - **Proof:** any call leaving U goes along an edge of the sound call graph to a function in the stub set by construction. ∎
- **Stub behaviour:** scripted per call (count, arguments, returns, side effects). Expected calls are checked: order and arguments.
- **Position:** **Known / Refinement.**

#### A36 Test cases and oracles
- **Guardrail (SKYFLOWX-TASK S11):** expected values come from requirements or the user, never from current behaviour without confirmation.
- **Injection, free generic oracles:** every test also checks properties that need no expected value:
  - **at the unit's exit, every resource potential is 0:** the D2 run-time counters, so a leak fails the test;
  - no run-time error (host sanitizers; on target, bounds and overflow checks inserted by S7 where proof failed);
  - the MISRA run-time conditions;
  - any **metamorphic relations** the user declares (e.g. `f(x) == f(x+period)`).
- **Position:** **Known** pieces (sanitizers, metamorphic testing); the D2 potential as a run-time oracle is a **Candidate**.

#### A37 Execution, host and target
- **Injection, flakiness detection:**
  - Each test runs twice (configurable). The coverage bitmaps and outputs are compared, and any difference marks the test **nondeterministic**.
  - This protects A32 carry-over and the repair obligation O4.
- **Proof:** a deterministic test gives identical traces on identical inputs, so a difference proves nondeterminism. (The converse doesn't hold, so it's labelled "not observed nondeterministic", not "deterministic".)
- **Position:** **Known / Refinement.**

#### A38 Regression: safe selection, honest minimisation
- **Selection:** safe test selection by function-entry sets (A32; Rothermel and Harrold 1997). **Known.**
- **Minimisation:** "keep coverage, fewer tests" is set cover:
  - solved **exactly** by integer programming for small suites;
  - otherwise greedy, **labelled** "within ln n of optimal".
  - Coverage is preserved either way, proven because the selected set covers the same goal set.
- **Position:** **Known.**

#### A39 Test-vector generation for coverage
- **Industry:** TBextreme generates vectors to maximise coverage. Research: concolic or symbolic testing (DART, KLEE).
- **Injection 1, fewer goals by dominance:**
  - Target only the **unconstrained** goals: the leaves of the dominator tree over the uncovered part (Bertolino and Marrè 1994).
  - Covering a leaf covers all its dominators, so the uncovered nodes become a much smaller goal set. **Known.**
- **Injection 2, infeasible goals proven:** when SMT finds a goal's path condition **unsatisfiable**, the unsat core is the certificate (Δ3), and the goal is excluded from the denominator with that proof attached. That's the honest form of "coverage target adjusted".
- **Injection 3:** MC/DC partner vectors (A27) are generated the same way.
- **Position:** **Known / Refinement** (proof-carrying infeasibility).

#### A40 Boundary values: ON/OFF points that are reachable
- **Known:** domain testing (White and Cohen 1980). For linear borders, an ON point and an OFF point per border detect border-shift errors.
- **Injection:**
  - For each branch predicate on the path to a goal, SMT computes ON and OFF points **that are reachable** (path condition ∧ predicate at equality, and just past it).
  - Type limits come from the target model (A02).
  - **Proof:** the SMT model satisfies the path condition, so the input reaches the border. ∎
- **Position:** **Refinement.**

#### A41 Equivalence classes: path domains as a homomorphism
- **Injection:**
  - Map each input to the **path** it executes. Its classes are the **path domains** (Howden).
  - For any property that depends only on the executed path (coverage, control-flow outcomes), one representative per class is enough, by the factorisation argument (P4).
  - For value properties, classes are refined by output predicates (as in D1.j's outcome classes).
  - User categories (category-partition: Ostrand and Balcer 1988) are combined pairwise with GF(q) orthogonal arrays (F2).
- **Position:** **Known**, combined.

#### A42 Requirements-based tests: requirements checked before tests are made
- **Injection:**
  - Requirements written in a structured form (EARS templates: Mavin et al. 2009) are translated into predicates over interface variables (A33).
  - Then SMT checks:
    - **consistency:** no two requirements demand contradictory outputs for the same input (the conjunction of their triggers and responses is satisfiable);
    - **completeness:** the triggers cover the declared input domain (their disjunction is valid).
  - Tests: boundary tests (A40) on each trigger, plus a **run-time monitor** of each requirement as the oracle.
- **Prior art:** requirements completeness and consistency analysis (Heimdahl and Leveson 1996). **Known**; the link to unit interfaces and test generation inside one tool is a **Candidate**.

#### A43 Fuzzing: turning "possible" into "proven"
- **Injection:**
  - **Directed fuzzing** (AFLGo: Böhme et al. 2017) aims at the **possible** findings from the sandwich (A10/A20), with input dictionaries made of the constants in branch predicates.
  - A fuzzing run that reaches the finding with a failing oracle is a **witness**, so the finding becomes **proven violation**.
- **Honesty:** fuzzing never proves absence, so a possible finding the fuzzer didn't reach **stays possible**.
- **Position:** **Known** parts, **Candidate** as the sandwich discharger.

#### A44-prep Mutation adequacy using the repair grammar
- **Injection:**
  - The repair engine's deviation grammar (D3.6.2 R2) doubles as the **mutation operators**.
  - Equivalent mutants are removed by analysis-equivalence (D3.6.4), plus compiling both and comparing the binaries (Trivial Compiler Equivalence: Papadakis et al. 2015).
  - Surviving mutants show weak tests and generate test suggestions.
- **Position:** **Known** (mutation testing); the shared grammar and reduction is a **Candidate** (an integration).

#### Batch 6 repair contributions (added to D3.7)

| Atom | Fix classes | Confirmation | Reduction |
|---|---|---|---|
| A33 interface | Parameters and returns for extraction; "make this hidden input controllable" | Determinism of tests (complete interface) | — |
| A34–A35 harness | **Test suggestions become complete:** harness, stubs, inputs and oracle | Closure theorem | — |
| A36 oracles | — | The D2 potential and sanitizers as oracles in O4 | — |
| A37 flakiness | — | O4 refuses nondeterministic tests as evidence | — |
| A39–A40 generation | — | **A regression test for every verified fix, from its witness:** SMT solves the witness path condition into a concrete input. The test **fails before the fix and passes after** (for findings observable at run time: leaks through the potential oracle, crashes, run-time errors) | Dominance-reduced goals |
| A42 requirements | — | Requirement predicates join O3 as invariants a fix must keep | — |
| A43 fuzzing | — | Possible findings confirmed by fuzzing **become eligible for "verified fix"** | — |
| Mutation | — | **Fix-protecting tests:** the fixed region's tests must kill the fix's own reversal mutant, which proves the tests would catch a regression of the fix | One grammar for repair and mutation; one equivalence reduction |

**The fix-plus-test theorem:**
- **Statement:** for a verified fix of a run-time-observable finding, the generated test t has its input from the witness path condition. Then **t fails on the original program** (it follows the witness path and the oracle detects the finding), and **passes on the patched one** (O1, plus confinement keeps the input on a now-correct path).
- **So:** every accepted fix ships with its own regression test. ∎
- **Condition:** the finding must be observable by an oracle (A36). For purely static findings (e.g. a MISRA style rule), no such test exists, and none is claimed.

### A.4g Injection, batch 7: requirements, compliance, qualification and baselines (A44–A47, A51–A52), 2026-10-31

#### A44 Requirements model
- **Industry:** requirements are imported from tools or ReqIF (an OMG standard exchange format), with hierarchy and versions. Links go "suspect" when an endpoint changes (DOORS-style).
- **Injection:**
  - Each requirement is a typed object: id, level (system, high-level, low-level; or ISO 26262's system and software levels), text, an optional **formal part** (an EARS predicate, A42), criticality (ASIL or DAL), and a **semantic fingerprint** of the normalised text and the formal part.
  - A link becomes **suspect** exactly when an endpoint's semantic fingerprint changes after the link's last review.
- **Theorem:** a suspect mark is never missed, and whitespace or formatting edits never cause one.
  - **Proof:** the mark is defined by fingerprint inequality, and normalisation removes formatting before fingerprinting. ∎
- **Position:** **Refinement.**

#### A45 Trace links: a typed graph with a schema, and the concept lattice
- **Injection 1, the schema:** links are typed (derives, implements, verifies, satisfies). The schema states the required edges per node type:
  - every low-level requirement traces **up** to a higher one **or** is marked *derived* (DO-178C asks that derived requirements be justified and passed to the safety assessment);
  - every function traces to a requirement **or** is listed as untraced;
  - every test verifies some requirement.
  - Validation is linear. The result lists exactly the nodes missing a required edge.
- **Injection 2, proposed links from executions (never automatic):**
  - If the tests of requirement R execute function F, and the tests of the other requirements don't, F is a **candidate** implementer of R. This is software reconnaissance (Wilde and Scully 1995), **Known**.
  - A person confirms each link.
- **Injection 3, formal concept analysis** (Ganter and Wille): the relation requirements × code is a **Galois connection**. Its concept lattice shows:
  - **tangling:** code that implements many requirements;
  - **scattering:** a requirement implemented across many places.
  - **Prior art:** concept analysis for feature location (Eisenbarth, Koschke and Simon 2003). **Known.**
- **Position:** **Known / Refinement.**

#### A46 Gaps, impact and status
- **Injection 1, gaps:** zero rows and columns of the trace matrices (§5.3), exact.
- **Injection 2, impact of a change (Boolean matrix closure, M3):**
  - **A changed requirement** → its traced code, then the call-graph closure → the tests to rerun.
  - **Changed code** → the requirements it traces to, plus a warning for **untraced** code that's reached.
  - **Honest completeness:** the impact set is complete *relative to the links and the sound call graph*. Untraced code is called out, never assumed harmless.
- **Injection 3, a status lattice:**
  - Each requirement is in one of verified ⊐ stale ⊐ unverified, plus failed (a separate, absorbing state for its current baseline).
  - A requirement is **verified** iff all its tests pass on the current baseline **and** none of its dependencies (its code, its tests, the requirement itself) changed since that pass (by fingerprint).
  - Any change makes it **stale**, exactly.
  - **Proof:** the definition is by fingerprint equality over its declared dependencies (P5). ∎
- **Position:** **Refinement.**

#### A47 Compliance objectives: evaluated as Datalog over evidence
- **Industry:** objective tables (DO-178C Annex A by level, with and without independence; the ISO 26262-6 method tables by ASIL; MISRA Compliance:2020's guideline compliance summary) are tracked in spreadsheets or tool dashboards.
- **Injection:**
  - Each objective is a **Datalog rule** over the evidence store. The store holds facts produced with certificates: test results, coverage certificates, proof coverage, deviations, reviews with reviewer ≠ author for independence, trace completeness.
  - Objective status is the **least model**: unique, terminating, deterministic.
  - Every "met" carries its **derivation tree**, which is a checkable certificate (P1 for compliance).
- **Theorem:** status is reproducible, and every "met" can be re-derived by a small checker from the stored evidence alone.
  - **Proof:** Datalog has a unique least model computed by monotone fixpoint iteration, and a derivation tree is a finite proof checked rule by rule. ∎
- **What-if:** evaluate with hypothetical evidence, such as "if this fix and its regression test are accepted". That shows which objectives a change would complete (used for ranking, below).
- **Licensing:** objective **identifiers** only. The objective texts come from the user's licensed copies, read locally, never stored in the repo.
- **Position:** **Candidate** (checkable compliance status).

#### A51 Tool qualification support
- **Injection 1, the split of trust (P1 with the correction):**
  - **Checker:** small, and qualified with its own validation suite.
  - **Analyser:** untrusted, because its verdicts carry certificates.
  - **Front end (clang):** argued separately, by the dual CFG builder (A14), the continuity checks (C1–C3), probe-verified target models (A02), and its use history.
- **Injection 2, delta qualification:** SkyFlowX traces **its own** code to its own specification (we use the trace engine on ourselves). When the tool changes, the impact closure (A46) gives exactly which specification items' validation tests to rerun.
  - **Proof:** as A46, relative to our own trace links, which our CI keeps complete by the A45 schema check.
- **Injection 3, classification help:** the ISO 26262-8 tool-classification inputs (tool impact, detection) are pre-filled per use case and adjusted by the user (S15).
- **Position:** **Candidate** (delta qualification by self-tracing).

#### A52 Configuration and baselines
- **Injection:**
  - A **baseline** is a content-addressed snapshot (a Merkle DAG): code, configuration and target models, tool version, results, certificates, the evidence store.
  - **Reproducibility (P5):** re-running on a baseline gives identical results.
  - **Comparing baselines:** findings are matched by fingerprint (A11), so each is new, fixed or unchanged, exactly.
  - **Tamper evidence:** the hash chain makes any edit to stored evidence detectable, assuming a collision-resistant hash. Offline.
- **Position:** **Known** (version control and content addressing), applied to evidence.

#### Batch 7 repair contributions (D3.7)

| Atom | Fix classes | Confirmation | Reduction / ranking |
|---|---|---|---|
| A44–A46 | **Trace repairs:** proposed links (confirmed by a person), test skeletons for unverified requirements (A42), *derived requirement* records for untraced code (**need your intent**) | — | — |
| A46 impact | — | **Every fix produces a change-impact record automatically:** the finding, the patch, the requirements traced to the touched code, the tests rerun, and status changes (verified → stale → verified). That's the change-impact analysis certification asks for | Only impacted tests rerun |
| A44 criticality | — | **Obligations scale with criticality:** the obligation set is a monotone function of the highest ASIL/DAL traced to the touched code. E.g. at ASIL D / DAL A, O3 must be *proven*, not a candidate. **Proof of monotonicity:** higher level ⊇ lower level's obligations, by construction of the table | — |
| A45 concept lattice | **Untangling suggestions:** split code that implements many requirements (**needs your intent**). The benefit is measurable: fewer requirements affected per future change, computed from the lattice | — | — |
| A42 + A47 | **Requirement conflict repair:** contradictory requirements are shown as a **minimal unsatisfiable subset** (the smallest set that conflicts; exact). Which one to relax **needs your intent** | — | — |
| A47 what-if | — | — | **Rank fixes by the objectives they complete** (Datalog what-if), then by D3.6.5's ordering |
| A51 | — | "Verified fix" verdicts come from the **qualified checker**, so they're usable as qualification-grade evidence, with the front-end caveat above | — |
| A52 | — | Every accepted fix is a baseline delta: **exact rollback**, and a tamper-evident record | — |

### A.4h Injection, batch 8: visuals and reports (A48–A50), 2026-10-31
**Rule for the batch:** **the picture is the data.** Nothing drawn may be absent from the data, nothing in the data may be silently missing from the picture, and nothing may look proven unless it is.

#### A48 Graph visualisation
- **Industry:** static flow and call graph pictures, laid out again from scratch on every change, so your mental map is lost. Huge graphs are either unreadable or thinned out invisibly.
- **Injection 1, visual integrity (C1–C3 applied to pictures):**
  - The scene description is a pure function of the analysis result, used by the canvas, WebGL and report renderers alike (speed plan).
  - A check verifies the map scene ↔ data is a **bijection** on visible elements. Culled or folded elements are accounted for as **counted placeholders** ("+37 hidden", or a folded region's box), never silently dropped.
  - **Proof:** a bijection plus an exact count for the hidden set means every data element is either drawn or counted. ∎
- **Injection 2, determinism:** layout is a deterministic function of the graph's **canonical form** (M6), so identical graphs always look identical (P4/P5).
- **Injection 3, layout nested by the program structure tree, for stability:**
  - Each canonical single-entry/single-exit region is laid out as a nested box, bottom-up.
  - **Theorem (locality of change):** after an edit inside region R, only R and its **ancestor** regions change size. Every other region keeps its internal layout and, at most, **moves rigidly**.
  - **Proof:** the layout is composed bottom-up, each region's layout is a deterministic function of its own subtree, and an unchanged subtree gives an identical sub-layout that its parent only places. ∎
  - **Prior art:** structured diagrams (Nassi–Shneiderman) and mental-map preservation in dynamic graph drawing (Misue et al. 1995). Our PST-based guarantee is a **Candidate**.
- **Injection 4, folding with guaranteed meaning:**
  - CFG folds are canonical single-entry/single-exit regions. Call-graph folds are strongly connected components (recursion clusters) or user components.
  - **Theorem:** folding a canonical region leaves a valid flow graph (one edge in, one out), and complexity stays additive: V(G) = V(G/R) + V(R) − 1 (the D3.2.4 lemma). So each fold can show its own complexity, and the totals are consistent.
  - **Zoom levels:** chosen by region depth and size (a concrete form of F1's persistent-homology idea: structures that survive zooming out are the large, deep regions).
- **Injection 5, accessibility:** every status is encoded twice (colour plus shape or dash), with colour-blind-safe palettes. **Known.**

#### A49 Annotated source
- **Injection 1, never on the wrong line:**
  - Overlays (findings, coverage, proof status) are anchored by fingerprint and token mapping (A05, A11).
  - If the source changed since the analysis, overlays on changed tokens are shown **stale** (faded, "re-analysing") and never moved onto another line.
  - **Proof:** an overlay is drawn only where its fingerprint and token map still match. ∎
  - (SkyCodeX's existing ripple note for unsaved edits is the first form of this.)
- **Injection 2, honest shading:** each line shows **proven** / **possible** / **can't tell** (three-valued), and coverage as run / not run / proven infeasible. Nothing is ever green without a proof or a measurement.
- **Position:** **Refinement.**

#### A50 Reports
- **Injection 1, a report is a function of a baseline:**
  - Generated deterministically from a baseline (A52), with the baseline's hash printed.
  - A checker can regenerate the report and compare hashes, which gives **report integrity**.
  - Each claim links to its certificate (P1) or derivation (A47).
- **Injection 2, formats:**
  - HTML and PDF;
  - **SARIF 2.1.0** (the OASIS standard for static-analysis results) for CI and other tools. **Known.**
  - MISRA Compliance:2020 summaries by guideline ID.
  - Differences between baselines: new / fixed / unchanged (A52).
- **Injection 3, minimal explanations:** each finding shows its **shortest** witness (breadth-first search on the product graph, so exact) or its smallest failing cycle. Dynamic findings get a minimised reproducer input (ddmin).
  - **Proof:** BFS returns a shortest path. ∎
- **Injection 4, certificates drawn:**
  - D2 potentials as the height of the "held" band;
  - invariants as value ranges on hover;
  - MC/DC pairs as matched marks;
  - Datalog derivations as a collapsible tree.
- **Position:** **Known / Refinement.**

#### Batch 8 repair contributions (D3.7)

| Atom | Fix classes | Confirmation | Reduction / UX |
|---|---|---|---|
| A48 PST layout | — | **Fix previews are stable:** by the locality theorem, the before and after pictures differ **only** in the edited region and its enclosing boxes, so you see exactly what a fix changes | — |
| A48 integrity | — | **Nothing changes unseen:** every hunk of the patch maps to a highlighted scene change and vice versa (a bijection check). A fix can't hide an edit from the preview | — |
| A48 confinement | — | **O3b shown visually:** the non-defective paths are drawn unchanged, and the witness paths are highlighted as the only ones that change | — |
| A50 explanations | — | Each fix is shown beside the **shortest witness** it breaks | — |
| A50 SARIF | Fix suggestions exported as SARIF `fixes` for CI tools | — | — |
| A49 shading | — | **The effect of precision repairs (R-11) is visible:** lines turn from possible to proven after accepting | — |
| A47/A50 | — | Change-impact records (batch 7) rendered as part of the report | — |
| UI | — | **Feedback capture** (accept / edit / reject with reason, D3.8) built into the finding and fix views | — |

### A.5 Next batches (planned)
1. ~~Batch 2~~ done (A.4b).
2. ~~Batch 3~~ done (A.4c).
3. ~~Batch 4~~ done (A.4d).
4. ~~Batch 5~~ done (A.4e).
5. ~~Batch 6~~ done (A.4f).
6. ~~Batch 7~~ done (A.4g).
7. ~~Batch 8~~ done (A.4h). **All 52 atoms covered** (A21/A22 via D2/D1).

---

## U. Unified SkyFlowX: Frama-C's gaps, LDRA parity and the common core on every OS (2026-11-03)

### U.0 Decisions (2026-11-03)
1. **Languages:** C and C++ only in 1.x.
2. **Common core, the first target, on every OS (Windows, Linux, macOS):**
   - the clang (libclang) front end;
   - SkyFlowX (Rust);
   - built-in compliance rules: MISRA C, MISRA C++, CERT C/C++ with the CWE mapping, AUTOSAR C++14, JSF AV C++, and ARINC 653 partitioning and APEX use.
3. **Add-on on Linux and macOS, after the core:**
   - Frama-C, installed by the user from its public release, called by SkyFlowX as a separate program;
   - for C++, Frama-Clang where it measures well on our own samples (the project calls it experimental).
   - No WSL route on Windows.
4. **Clean-room rule.**
   - **Allowed:** Frama-C's *published methods* may be rebuilt in SkyFlowX, from the papers and public manuals only.
   - **Never:** Frama-C source, tests, library contract files or manual text are not copied, ported or translated.
   - **Result:** no LGPL duty arises for our code. "Frama-C" is never used as a product name; the app at most says "works with Frama-C if installed".
   - **Still required:** the licence notices of tools we bundle (clangd, the SMT solver).
5. **UI:** results are shown natively in SkyCodeX, interactive, in its own look. Mock-ups come first.
6. **Licensed texts** (MISRA, ARINC 653, DO-178C) are read locally from the user's copies and never put into the repo or the app. Rules are referenced by number and described in our own words.
7. **Platform rule (P7):** a check that needs the add-on shows *can't tell: needs Frama-C (Linux, macOS)* on Windows, never a pass.

**Source:** the user's comparison document *Frama-C, Polyspace and LDRA: exhaustive concept-by-concept and component-by-component comparison* (2 November 2026; public information only; claims marked "verify" there stay unconfirmed here). The concept IDs A1–M5 below are that document's, not our atom IDs A01–A52.

### U.1 Architecture

| Layer | Contents | Atoms | Platforms | Phase |
|---|---|---|---|---|
| L0 Front end | clang/libclang, compile database, target model, preprocessing record, location mapping; continuity checks C1–C4 on every lowering | A01–A05 | All | Core |
| L1 Graphs and facts | CFG, call graph, SSA, read and write sets per function, dependence of outputs on inputs | A14–A18 | All | Core |
| L2 Rules | Lexical to system levels T0–T5, the standards catalogue, deviations | A06–A11 | All | Core |
| L3 Metrics and quality | Size, cyclomatic, essential, knots, Halstead per function, LCSAJ counts, HIS profile, quality model, trends | A12, A13, A52 | All | Core |
| L4 Sound semantics | Our own value analysis (S7). Add-on: Eva, WP and E-ACSL on C; Frama-Clang on C++ where measured. Combined by P2 only under the same machine model | A20–A22 | Own: all, later. Add-on: Linux, macOS | Later |
| L5 Dynamic | Instrumentation, target run-time library, coverage, harnesses, stubs, test generation | A23–A43 | All | Later |
| L6 Evidence | Requirements, trace links, objectives, certificates and the small checker, reports, qualification kit | A44–A51 | All | Later |
| UI | SkyCodeX views: findings on the flow, coverage as light, compliance board | A48–A50 | All | Core |

### U.2 Where Frama-C is below LDRA, and how SkyFlowX closes it
Counted from the document's ratings, **64 concepts** rate LDRA higher than Frama-C. Our 52 atoms already cover each one; this table adds the mathematics and the phase.

| # | Group | Document concepts | Atoms | Our mathematics | Certainty | Phase |
|---|---|---|---|---|---|---|
| 1 | Front end | A1, A3, A4 | A01–A05 | Continuity C1–C4 on clang → CFG → SSA; a C++ One Definition Rule violation read as a gluing failure across files (D4) | E | Core |
| 2 | Concurrency, stack, timing | A8, B10, B11 | A22, S12 | D1 directed topology, D1.a′ interrupts, D1.h′ cutoff, Petri invariants; stack depth as a max-plus longest path over the call graph (recursion → *can't tell*); loop bounds by ranking functions, response-time analysis. Static WCET needs a processor model, so timing is measured (B) | S / B | Later |
| 3 | Defect finding | B6 | A20, A21 | The fast unsound mode and the sound mode share one engine; a finding says which mode made it | S / B | Later |
| 4 | Flow structure | D2, D3, D8, D9 | A14, A16, A19 | I5 reducibility gives structuredness and essential complexity; reaching definitions give UR, DD and DU, each with its witness path; coupling is the read and write sets projected onto component boundaries | E | Core |
| 5 | Coding standards | E1–E9 | A06–A11 | Decidable rules exact; undecidable rules take their evidence from the sound side only (A10 sandwich); deviations by fingerprint (A11) | E / S | Core (first slice) |
| 6 | Metrics and quality | F3–F8 | A12, A13, A52 | Halstead per function; knots as crossing pairs of jumps, O(n log n); LCSAJ from the CFG; trends from P4/P5 fingerprints | E | Core |
| 7 | Instrumentation and execution | G1–G4, G6 | A23, A24, A32 | Probes only on edges outside a spanning tree, with every other count recovered from B·x = 0 (Δ1); instrumentation must be a subdivision (C4); target data checked by CRC over GF(2); runs merged as a join keyed by build identity (P→E) | E | Later |
| 8 | Structural coverage | H1–H12 | A25–A31 | MC/DC independence pairs, unique-cause and masking; object-code coverage as continuity through the line tables; gaps justified only by *sound* unreachability | E | Later |
| 9 | Unit and integration testing | I1–I8 | A33–A43 | Interfaces from the read and write sets; one contract used three ways (proved, used as the test stub, checked at run time); boundaries and classes from the interval edges of the value analysis; inputs by SMT | E / B | Later |
| 10 | Requirements and objectives | J1–J4 | A44–A47 | Trace links as a bipartite graph: gaps are unmatched nodes, impact is reachability; statement-level impact joined with artefact-level impact | E | Later |
| 11 | UI, certification, platform | K2–K4, L1–L3, M3–M5 | SkyCodeX, A50–A52 | SkyCodeX is the IDE (K2); P1 certificates, so qualification rests on a small checker; proofs as DO-333 evidence; scale by modular proofs, P4 and P5 | E | Core (UI), later (rest) |

### U.3 Methods taken from Frama-C's published work (clean-room)

| Method | Published source | Lands in | Position |
|---|---|---|---|
| ACSL as the contract language SkyFlowX reads | The public ACSL reference manual; Kirchner, Kosmatov, Prevosto, Signoles and Yakobowski, *Formal Aspects of Computing* 27(3), 2015 | S7, S11 stubs, D3 | Known |
| Value analysis by abstract interpretation: intervals, congruences, base and offset pointers, state partitioning | Cousot and Cousot, POPL 1977; Kirchner et al. 2015; Kosmatov, Prevosto and Signoles (eds.), *Guide to Software Verification with Frama-C*, Springer 2024 | S7 | Known |
| One obligation per run-time-error site | Kirchner et al. 2015 | S7, rules E10 | Known |
| Weakest preconditions for contract proofs | Dijkstra, CACM 1975; Kirchner et al. 2015 | Proofs (add-on first, own later) | Known |
| Run-time checking of contracts and memory with shadow memory | Kosmatov, Prevosto and Signoles 2024 | S9, S11, fuzzing oracle | Known |
| Temporal properties as automata over calls and returns | F5 (Büchi automata) | S12 | Known |
| Meta-properties ("only M writes x") | Kosmatov, Prevosto and Signoles 2024 | A10, S6 | Known |
| Slicing on a program dependence graph | Weiser, ICSE 1981; Ferrante, Ottenstein and Warren, TOPLAS 1987 | S6, D3.11 footprints | Known |
| One status per property: valid, invalid, unknown, or valid under hypotheses, with dependencies tracked | Kirchner et al. 2015 | §1.4 finding states | Known |
| Infeasible coverage objectives detected by static analysis | Bardin, Kosmatov and Cheynier, ICST 2014 | H11 gap justification | Known |
| Termination by variants and ranking functions | Podelski and Rybalchenko 2004 (F5) | S7 | Known |

### U.4 What neither tool offers (claims hold only after measurement)
- **P1 certificates** for every verdict, checked by a small separate checker.
- **P5 incremental results** that equal from-scratch results.
- **D1 concurrency proofs**, **D2 resource algebra**, **D4 gluing across files**.
- **The checked repair engine (D3).**
- **Probe minimisation by spanning tree** (Knuth and Stevenson 1973; Ball and Larus 1994). The document describes no such minimisation for LDRA. Any claimed gain must be measured.
- **ARINC 653 checks.** The document compares no ARINC 653 support for any of the three tools.

### U.5 ARINC 653 (to confirm against the user's licensed copy)
| Check | Mathematics | Certainty |
|---|---|---|
| Time partitioning: the partition windows in the major frame fit their processes' demand | Response-time analysis (F5) | S |
| Space partitioning: no data flow between partitions except through declared ports | Noninterference on information flow (Denning's lattice, F5; A18) | S |
| APEX ports: sampling and queuing ports created and used in matched pairs | D2 monoid labels | E / S |
| Health monitoring: every declared error handler is reachable and covered | I1 reachability; coverage (A25) | E |
| Processes inside a partition | D1, within the partition's windows | S |

The configuration tables are an input. Their exact form is taken from the licensed text.

### U.6 What "more capable" means: measured per axis
| Axis | Measure | Benchmarks | A win means |
|---|---|---|---|
| Findings | True findings caught; false alarms | NIST Juliet (CWE), Toyota ITC suite, SV-COMP | Caught ≥ theirs and false alarms ≤ theirs, on the same set |
| Rules | Per-rule agreement with hand-worked answers | MISRA example suite (licensed), our known-answer tests | Every rule passes its tests |
| Soundness | Missed errors in the sound mode | Juliet and SV-COMP with known answers | Zero misses within the stated scope |
| Coverage | Counts against ground truth | gcov, llvm-cov | Identical counts |
| Speed | Time to results, first and incremental | ThreadX, RTEMS, LLVM | ≤ theirs at equal certainty |

**Limits stated up front:**
1. No single analysis is both fully sound and as fast as a rule checker on every program (undecidability). Each mode must beat its own counterpart.
2. Matching Eva's precision on every program takes measured iterations.
3. Ready-made compiler/processor packages, a field and certification track record, and vendor support aren't design outcomes. They're earned over time.

### U.7 First target: the common core (about two weeks, after SkyCodeX is finished, on "Skyflow execute!")
- `skyflowx` in Rust on libclang, over JSON-RPC, inside SkyCodeX, for C and C++.
- L1 graphs and the flow-integrity invariants I1–I8.
- L3 metrics, exact.
- Data-flow anomalies UR, DD and DU; cross-reference.
- **A first slice of decidable rules** from MISRA C, MISRA C++ and CERT, each with a written spec and known-answer tests (the process rule in ROADMAP.md). The full catalogues follow later.
- Findings shown natively in SkyCodeX, after mock-ups.

**Not in the first target:** the Frama-C add-on, our own sound engine, coverage, testing, traceability, the qualification kit, D1, the Lean proofs and the benchmark campaigns.

### U.8 Repair contributions (D3.7)
| Item | Fix classes added | Confirmation added | Reduction added |
|---|---|---|---|
| U.3 contracts | Fixes that keep a function's contract | Add-on: WP proves the patched function still meets its contract | A contract acts as the stub, so only callers whose assumptions changed are rechecked |
| U.3 value analysis | Guard fixes at an alarmed operation | The alarm is gone and no new alarm appears, under the same machine model | — |
| U.3 run-time checking | — | The fix is re-run on the tests with contract and memory checks on | — |
| U.3 slicing | — | — | A fix's footprint is its backward slice; only checks that meet the slice are rerun (D3.11) |
| U.5 APEX ports | Port pairing fixes | The D2 pass certificate | — |
| U.2 group 5 | — | An undecidable rule's fix is confirmed only by the sound side (A10) | — |
| U.11 repair card | — | A suggestion is drawn beside its error only after its confirmation passed; the card says which check confirmed it | — |

### U.9 Open, and to verify
1. The exact licences of the Frama-C plug-ins and of the Alt-Ergo prover. This matters only to users of the add-on, who install them.
2. A freedom-to-operate (patent) check before a commercial release, by a lawyer.
3. How much of C++ Frama-Clang handles, measured on our own samples before it is relied on.
4. Frama-C's report formats, read from a real run before the reader is written.
5. MISRA and ARINC 653 checks to be confirmed against the user's licensed copies.
6. Every claim marked "verify" in the comparison document.

### U.10 Open-source checks we reuse, and the full use of clang (2026-11-03)
**Decision:** where an open-source check already exists, we take it. Our own mathematics (U.2, D1–D4, P1–P8) is added on top.

**Licence rule, per source:**
- **Apache 2.0 with the LLVM exception** (clang, clang-tidy, the Clang Static Analyzer, CodeChecker): the code may be built into SkyFlowX. Its licence notice goes into the third-party notices file. That notice is a licence condition, not credit for anyone's work.
- **GPL** (cppcheck and its MISRA add-on): never built in, because that would make SkyFlowX GPL. It may only be run as a separate program installed by the user, like the Frama-C add-on.
- **Licensed standards** (MISRA, ARINC 653): checks are confirmed against the user's copies. The texts never ship.

| Source | Licence | What it gives | How we use it |
|---|---|---|---|
| clang diagnostics (all warnings) with fix-its | Apache 2.0 + LLVM exception | Many decidable rules at T1–T2; exact locations; fixes | Mapped to rules one by one; fix-its feed the repair engine (as in SkyCodeX today) |
| clang-tidy (cert, bugprone, cppcoreguidelines, hicpp, misc, readability, performance) | Apache 2.0 + LLVM exception | CERT C/C++ subset; many checks overlapping MISRA C++ and AUTOSAR | Built in as a library; each check mapped to the rules it implements exactly, or to the rules it only relates to |
| Clang Static Analyzer | Apache 2.0 + LLVM exception | Path-sensitive defect finding: null, leaks, use after free, division, uninitialised values | The fast unsound mode (U.2 group 3); every finding carries its path as a witness (P1) |
| clang dataflow framework and `clang::CFG` | Apache 2.0 + LLVM exception | CFG, dominators, lattice-based dataflow | The base for L1; our certificates are stated over this CFG |
| `-Wthread-safety` capability analysis | Apache 2.0 + LLVM exception | Lock discipline from annotations | A cross-check for D1 and D2 where the code is annotated |
| LLVM source-based coverage, with MC/DC from LLVM 18 | Apache 2.0 + LLVM exception | Statement, branch and MC/DC on the host | The ground truth our own instrumentation must equal (U.6), and a first coverage source |
| Sanitizers (address, undefined, memory, thread) | Apache 2.0 + LLVM exception | Run-time detection of the same error classes | The dynamic confirmation of static findings; the thread sanitizer confirms D1 races |
| CodeChecker guideline maps | Apache 2.0 | Which clang and clang-tidy checks relate to which MISRA, CERT and AUTOSAR rules | A starting map only: "relates to" is not "implements"; each rule still needs our known-answer tests |

**What open source doesn't cover:**
- **MISRA C and MISRA C++:** no complete open-source checker under a licence we can build in. Most rules are our own work, using clang's AST and CFG.
- **AUTOSAR C++14:** only partly covered, through clang-tidy checks that overlap it.
- **ARINC 653:** no open checker. The checks in U.5 are our own.

**Full use of clang:**
- libclang's C interface doesn't expose the CFG, the dataflow framework, the Static Analyzer or clang-tidy.
- So SkyFlowX links clang's C++ libraries through a small C++ layer that Rust calls. This replaces "libclang" in ROADMAP.md.
- **Cost:** a larger binary, and one pinned LLVM version per release.
- **Gain:** every check above, and one parser shared by everything.

**Exactness rule:** a reused check counts toward a rule only after it passes that rule's known-answer tests. Until then, it is shown as *relates to* the rule, not as checking it.

**Prior art:** all methods in U.3 are Known. Candidates: one contract used three ways in one product (Refinement at most; the Frama-C ecosystem already shares ACSL between WP and E-ACSL); reading a C++ One Definition Rule violation as a gluing failure (Candidate, unverified).

### U.11 Concept 0: the SkyFlowX tab (decided 2026-11-04, mock-ups approved)
The approved mock-ups for U.11–U.14 are in [mockups/skyflowx](mockups/skyflowx/README.md).

**Place:** a tab of its own, at the far right of the tab row (`flow · folder · files … · [SkyFlowX]`). Its label sits in a thin bordered box (`1px #3a3f3a`, accent while the engine pulses).

**States shown in the box:**
| State | Box shows |
|---|---|
| Not started | `SkyFlowX` + **Init** |
| Running | `SkyFlowX covered / total` (files analysed, like clangd's indexing count) and a thin progress line under the box |
| Ready | `SkyFlowX 3 · 12`: proven (error colour) · possible (warning colour) |
| Stale | the counts dimmed, **Init** back |
| Stopped or failed | "engine stopped" + **Retry**; the editor and flow keep working |

**On/off control (decided 2026-11-04, option 2 of three compared):** an **ON | OFF** segmented control at the end of the SkyFlowX button, both words always visible, the current one filled. The button is larger (38 px, label 19 px, control 30 px). OFF never relies on colour: the OFF segment is filled, the border turns dashed, the label and kept counts dim.

**The button, prominent (approved 2026-11-04 on the real app, tinyhttp):** 42 px tall, its own mark (two crossing flow paths with nodes at their ends, an X made of flow), the label `SkyFlow` + a gold semibold **X** (20 px), a warm accent tint, an accent border and a soft halo; a thin vertical divider sets it apart from the tabs and clangd's status. Contents in order: mark, label, then Init / `covered / total` / `proven · possible`, then **ON | OFF**. When the SkyFlowX tab is open the button lights fully, a 2 px gold rule runs under the tab row and the other tabs dim. When OFF it stays visible (dashed border, no tint, mark and label dimmed), so the feature is never hidden.

**The other tabs, for balance (approved 2026-11-04):** flow, folder and file tabs each sit in a thin 1 px box (`#2a2d2a`), 42 px tall like SkyFlowX, 10 px apart; the open tab has a brighter border (`#5f665f`) and a faint fill. Only SkyFlowX carries gold, tint and halo.

**Engine at work:** the whole tab row brightens and dims, about every 1.6 s (accent tint and a hairline under the row). With reduced motion it stays bright.

**Starts only on Init.** SkyFlowX never runs by itself; after an edit the results go stale until the next Init.

**Storage:** results only in SkyCodeX's data folder, never in the project.

**Repair suggestions in the file:** while the repair engine runs, each confirmed suggestion is drawn to the right of its error line, joined by a thin connector (a dot at the error's end, an elbow, a card). The card holds clangd's message and position, the fixed line with the edit highlighted, the confirmation ("checked by the second clangd: the error is gone, no new error"), **✓ Apply** and **✗**. Nothing changes until ✓.

**Edge cases (from Concept 0):** no folder open; no C/C++ in the project; mixed projects (only C/C++ analysed, the skipped count shown); very large projects (scope settled in Concept 1); read-only folders; the Frama-C add-on missing (its checks *can't tell*, never pass); the engine missing or crashed.

**Next:** Concept 1, initialization: what's in the folder, how it is built, for which machine, what to check, what to cover, and the Start summary.

### U.12 Concept 1.1: the inventory (decided 2026-11-04)
On Init, before analysis, SkyFlowX lists everything in the project:
- **Sources** (`.c .cc .cpp .cxx .c++`): by extension, then confirmed by their compile commands (Concept 1.2, still open).
- **Headers** (`.h .hh .hpp .hxx .inl .ipp .tpp`, and headers with no extension): from the `#include`s the sources actually make.
- **Language per file:** from `-x` and `-std`, otherwise from the extension.
- **Programs:** from the build's link steps, otherwise from SkyCodeX's `main` finder.
- **Libraries:** units with no `main`.
- **Assembly and linker scripts:** listed only, not analysed.

**Decided:**
| Case | Rule |
|---|---|
| Header used by both C and C++ | Analysed in each language; findings tagged *in C*, *in C++* or *both* |
| Orphan header (included by no source) | Analysed alone with the project's settings; findings marked "not included by any source" |
| Vendor, generated and test code | Analysed as context; findings hidden by default, kept under "not yours" |
| Build output folders | Skipped; their generated headers are still read when a source includes them |
| Symlinks and duplicates | Counted once, by real path; names differing only in capitals flagged on macOS and Windows |
| Encodings | Windows line endings handled; non-UTF-8 read in the detected encoding and noted; unreadable files listed with the reason |
| Huge files | Analysed, shown with their size |
| Large repositories | No file cap; the inventory fills in as it goes; the tab box shows the real total |

**Connections:** each file's content hash is kept in the data folder, so a later Init re-reads only changed files (P5). Every skipped or excluded file is listed with its reason (P7). SkyCodeX's file listing and `main` finder are reused.

### U.13 Concept 1.3: the toolchain, and how static and dynamic analysis run (decided 2026-11-04, mock-ups shown)
**No build for static analysis.** clang's front end reads each file in memory with its compile command (no code generation, no linking, no object files). Per-function summaries are joined into a whole-program view. A build is needed only for dynamic analysis, which is a separate step: SkyFlowX compiles its own instrumented copy in the data folder and never touches the project's build outputs. Code that doesn't compile is still analysed; functions clang couldn't read cleanly are *can't tell*.

**The user chooses the toolchain; SkyFlowX never infers it (revised 2026-11-04):**
1. The Toolchain step shows one toggle button per compiler family (GCC, Clang, Apple clang, Arm GNU, IAR, Keil, TI, Green Hills, MSVC, Other…). Click selects, click again deselects; several may be selected.
2. What the project's files name (e.g. "compile_commands.json names clang++ for 9 files") is shown as information beside the buttons, never pre-selected.
3. For each selected family, the copies on the machine are listed (folders read, nothing run) and the user picks one, or a download.
4. **Confirm**: only then does SkyCodeX offer the commands, in the permission window below.
5. If a command's output contradicts the choice (e.g. a `gcc` that is really Apple clang), SkyFlowX stops and shows it; it never switches family by itself.
6. The queries carry the project's own flags (`-std`, `--target`, `-mcpu`, `--sysroot`…); files sharing one flag set share one query.

Labels: the chosen compiler and its queried settings are **Exact**; a skipped query reads with clang's defaults, **Guessed**. SkyFlowX is C/C++ only, so Ada (GNAT) isn't offered; GNAT's C compiler counts as GCC.

**Permission window (SkyCodeX look):** lists every exact command and why, says they only print, warns when the compiler lives inside the project folder; **Run**, **Run once**, **Skip** (Skip reads with clang's defaults, Guessed). While running, a terminal panel shows each command's live output and exit code, with **Stop**. Permission is remembered per project and per compiler file (SHA-256); a changed compiler asks again.

**Downloads:** only open-licence toolchains with official checksums (LLVM/clang, Arm GNU Toolchain, xPack GNU, llvm-mingw), through the language-pack process: official release, resumable download, size + SHA-256 (+ signature where published), unpack to a temporary folder, check the layout and `--version`, one atomic move into `language_packs/<name>-<version>`, a manifest of every file and hash so removal is exact. No installer, no admin, no PATH change. Licensed compilers (IAR, Keil, Green Hills, TI, Wind River, MSVC) are detected only. Offline: the download list is shown greyed with the reason.

**Branches:** several compilers per project (each file uses its own); wrappers (ccache, sccache, distcc) unwrapped; builds in Docker or elsewhere (path mapping, or an installed equivalent); MSVC via clang's MSVC mode; vendor extensions through a table, unknown ones named, dependent code *can't tell*.

### U.14 Results display principles (decided 2026-11-04, mock-ups shown; full design in Concept 7)
Not limited to LDRA's reports: more complete and easier to act on.
- **Standards are verdicts with a breakdown, never a lone %:** *Compliant*, *Not compliant* or *Can't tell yet*, with rules and code split into met, deviated, violated and **not checked** (always shown, hatched so colour isn't the only cue).
- **DO-178C is objectives:** backed by SkyFlowX evidence, needing people or process evidence, missing. SkyFlowX never claims DO-178C compliance on its own. Objective counts per level confirmed against the user's licensed copy.
- **Coverage** (statement, decision, MC/DC) against the level's target, with the uncovered part split by reason: **proven unreachable** (certificate attached), **missing test**, **can't tell**.
- **Every segment is clickable**, drilling standard → rule → file → function → line, with a breadcrumb; Esc goes back, F8 / ⇧F8 move between gaps.
- **Project map:** files sized by lines, coloured by worst finding.
- **Fix first:** proven before possible, checked fixes first.
- **Filters:** mine / not yours, certainty, program, configuration; change since the last Init.
- **In the code:** a coverage band in the margin (covered, partly, not covered), uncovered lines shaded, reason tags on the line, and an MC/DC card joined by a connector, showing the condition combinations seen and the ones still needed.
- **Flow tab:** uncovered calls faded, findings on their steps; "Show in flow" from any card.

**Layout of the results page (approved 2026-11-04): one reading order, top to bottom.**
1. **Context line:** "Results", project, configuration, file count, last Init; on the right the active filters ("Showing mine · all certainties ▾") and a **List | Map** switch (the project map lives behind Map, not on the main page).
2. **The answer:** one sentence in a band with a coloured edge, e.g. "Not compliant with 2 of 4 standards", then "3 proven and 12 possible findings · 2 checked fixes ready · 2 more violations than the last Init", and **Fix first ›**.
3. **One legend** for every bar: met / covered, deviated / proven unreachable, violated / missing test, not checked / can't tell (hatched).
4. **Standards** as aligned rows on one column grid: name · verdict (icon + word: ✕ Not compliant, ? Can't tell yet, ✓ Compliant) · one rules bar · met · deviated · violated · not checked, numbers right-aligned in equal-width digits, zeros faded. A row opens **in place** (no pop-ups): its code bar, then its rules with the location and **Open ›**.
5. **Fix first:** proven before possible, with location and *checked fix* / *possible*.
6. **Coverage:** statement, decision, MC/DC on the same grid (covered %, bar, covered, unreachable, missing test, can't tell), target from the level.
7. **DO-178C:** objectives by evidence (SkyFlowX, people or process, missing), with "never claims DO-178C compliance on its own".

Three text sizes only, colour only where it means something, space between groups instead of boxes.

### U.15 Concept 1.2 decisions, the engine's life, and the on/off switch (decided 2026-11-04)
**Compile commands (Concept 1.2):**
- Sources in order: the project's `compile_commands.json` → build tools that list commands without building → IDE project files → watching a real build → guessed.
- Running the project's own tools (CMake set-up, watching a build) needs one yes per project at Init, remembered.
- A file with only a Guessed command: rules that depend on macros or type sizes show *can't tell*, never a pass; other rules run as usual.
- A file built twice with different flags is analysed in each context, its findings tagged by context.

**Engine life:** the engine starts on Init and closes when the run finishes; nothing stays in memory. Results are files in the data folder; viewing them needs no engine.

**On/off switch, per project:** a switch in the SkyFlowX box.
- **Off:** the engine stops at once (mid-run too), nothing runs, edits aren't even compared. Every finished file's results are already saved (P5), so nothing is lost; the box shows `SkyFlowX off` with the last counts dimmed.
- **On again:** it resumes. Files finished before are kept if their content hash, compile command, toolchain and rule-set version are unchanged; everything else, and every file not reached, is analysed. Old results are never shown as current: what's being redone is marked stale until done.
