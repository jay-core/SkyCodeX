# Static and dynamic analysis: study resources

This list covers static and dynamic analysis of code, and the hybrids between them: what a reader needs, from the foundations up to what tools such as SkyCodeX and SkyFlowX do.

**Each entry gives:**
- the title, authors, venue and year;
- **what it covers**, from its contents;
- **why it is on the list**, meaning the gap it fills;
- **how it was vetted.**

Every title and author here is a real, published work: a book, a peer-reviewed paper, a thesis or a published standard. Nothing is unpublished or invented.

## How the vetting is marked

- **✔ Checked:** I confirmed the work's details and an outside recommendation on 2026-11-05. The links are under *Sources* at the end.
- **○ Standing:** I'm confident it's real and important from its content and its place in the field: the paper that defined the method, or the standard reference. I didn't re-check it on 2026-11-05.

I searched for forum testimonials on Hacker News and Reddit's r/ProgrammingLanguages, and found very few threads that could be checked. Where I couldn't find a forum post, the entry says so rather than inventing a testimonial. In those cases the evidence is course adoption, publisher reviews, awards I could verify, and the content itself.

**Tiers:**
- **Core:** read it through.
- **Reference:** read the chapters named.
- **Paper:** the primary source for one method.

Works marked **Free** are legally free online from their authors.

---

## P. Prerequisites: read before Part A

The list assumes six skills. If one is missing, the entry below fills it.

| Skill | Needed for |
|---|---|
| Writing and reading proofs | Every soundness argument, starting with fixed points (A1) and abstract interpretation (B3) |
| Discrete maths, plus basic probability | Sets, relations, graphs, induction everywhere. Probability for fuzzing as a Markov chain (C12) and statistical fault localization (C10) |
| Graph algorithms, union-find, linear programming | Worklists, DFS, strongly connected components, dominators (A5); Steensgaard's union-find (B6); polyhedra (B3) |
| C and C++, fluently | Every C/C++ entry; reading the analyzers, which are mostly C/C++ |
| How a machine runs C: memory, stack, linking, threads, interrupts | Memory models (B17), sanitizers and instrumentation (C2–C3), races (B11, C6), binaries (B20) |
| How a language tool is built: parsing, ASTs, an interpreter | An interpreter is the concrete semantics that an analysis approximates (A3, B1) |

**Two practical skills**, with no book needed:
- **Python** to the level of the official tutorial, because The Fuzzing Book and The Debugging Book are runnable Python.
- **Reading ML-style notation**, which Nielson et al., Pierce and Shivers use. Real World OCaml covers it, below.

### P1. Proofs and discrete mathematics
- **How to Prove It: A Structured Approach** (3rd ed.). D. J. Velleman. Cambridge University Press, 2019. *Core, if proofs are new.*
  - **Covers:** logic, sets, relations, functions, induction, and how to build and write a proof.
  - **Vetting:** ○ The usual first book on proofs. It's the step before Davey & Priestley.
- **Mathematics for Computer Science.** E. Lehman, F. T. Leighton, A. R. Meyer. MIT, 2017 revision. *Core. Free (MIT OpenCourseWare).*
  - **Covers:** proofs, induction, number theory, graphs, relations and partial orders, counting, and discrete probability.
  - **Why:** it covers both the order theory ahead of A1 and the probability for C10 and C12.
  - **Vetting:** ✔ Recommended as the maths text in the *Teach Yourself Computer Science* guide.

### P2. Algorithms
- **The Algorithm Design Manual** (3rd ed.). S. S. Skiena. Springer, 2020. *Core.*
  - **Covers:** graph traversal, DFS, topological sort, strongly connected components, union-find, shortest paths, and a catalogue of problems.
  - **Vetting:** ✔ Recommended in *Teach Yourself Computer Science* as more practical and less proof-heavy than CLRS.
- **Introduction to Algorithms** (4th ed.). T. H. Cormen, C. E. Leiserson, R. L. Rivest, C. Stein. MIT Press, 2022. *Reference: elementary graph algorithms, disjoint sets, linear programming.*
  - **Why:** the precise proofs for union-find (Steensgaard, B6) and linear programming (polyhedra, B3).
  - **Vetting:** ○ The standard algorithms reference.

### P3. C and C++
- **The C Programming Language** (2nd ed.). B. W. Kernighan, D. M. Ritchie. Prentice Hall, 1988. *Core.*
  - **Covers:** the whole language, compactly, including pointers, arrays and function pointers.
  - **Vetting:** ○ The C classic, by the language's co-designer.
- **A Tour of C++** (3rd ed.). B. Stroustrup. Addison-Wesley, 2022. *Core.*
  - **Covers:** modern C++ (C++20): classes, virtual functions, templates, the standard library, and concurrency, in 300 pages.
  - **Why:** enough C++ to follow virtual-call (B5) and C++ analysis papers.
  - **Vetting:** ○ By the language's designer.

### P4. How a machine runs a program
- **Computer Systems: A Programmer's Perspective** (3rd ed.). R. E. Bryant, D. R. O'Hallaron. Pearson, 2016. *Core, ch. 1–3 and 7–9, 12.*
  - **Covers:**
    - data representation and x86-64 machine code (ch. 2–3);
    - linking (ch. 7);
    - exceptions and signals (ch. 8);
    - virtual memory and malloc (ch. 9);
    - threads and synchronisation (ch. 12).
  - **Why:** the prerequisite for sanitizers, instrumentation, binaries and memory models.
  - **Vetting:** ✔ The first of the two books *Teach Yourself Computer Science* recommends if you read only two, for its practical, programmer-oriented approach.
- **Operating Systems: Three Easy Pieces.** R. H. Arpaci-Dusseau, A. C. Arpaci-Dusseau. Arpaci-Dusseau Books, 2018 (online, updated). *Core: the virtualisation and concurrency parts. Free (ostep.org).*
  - **Covers:** processes, scheduling, address spaces, threads, locks, condition variables, and common concurrency bugs.
  - **Why:** what RTOS tasks, interrupts and races mean before you analyse them (B11, C6).
  - **Vetting:** ✔ Recommended in *Teach Yourself Computer Science* for its structure, readability and exercises, and it's free.

### P5. How a language tool is built
- **Crafting Interpreters.** R. Nystrom. Genever Benning, 2021. *Core, part II. Free (craftinginterpreters.com).*
  - **Covers:** scanning, parsing, ASTs, resolving names, and a tree-walking interpreter, then a bytecode virtual machine.
  - **Why:** you build the concrete execution that every static analysis approximates and every dynamic analysis observes.
  - **Vetting:** ✔ The languages-and-compilers pick in *Teach Yourself Computer Science*, which calls it well organised, free and suited to understanding language tools. The guide notes that the Dragon Book is a reference, not for self-study.

### P6. ML-style notation
- **Real World OCaml** (2nd ed.). Y. Minsky, A. Madhavapeddy. Cambridge University Press, 2022. *Reference, part I. Free (dev.realworldocaml.org).*
  - **Covers:** algebraic data types, pattern matching, modules, and functional style.
  - **Why:** the notation of Nielson et al., Pierce and Shivers. Infer, Frama-C and Why3 are written in OCaml.
  - **Vetting:** ○ The standard practical OCaml book.

---

## How to read this list (suggested order)

0. **Prerequisites.** Part P, only for the skills you're missing.
1. **Foundations.**
   - A1: lattices and fixed points.
   - A2: undecidability.
   - A5: control-flow graphs and SSA.
2. **Static core.** Møller & Schwartzbach (B1), then Rival & Yi (B1/B3).
3. **Dynamic core.** Pezzè & Young (C1), then Ball and Ernst (C1).
4. **Topics.** Then each topic section, in any order, by its papers.
5. **Hybrids last.** Symbolic and concolic execution (D) draws on both halves.

---

## A. Foundations

### A1. Order theory and fixed points
The mathematics behind every dataflow analysis and abstract interpretation.

- **Introduction to Lattices and Order** (2nd ed.). B. A. Davey, H. A. Priestley. Cambridge University Press, 2002. *Reference, ch. 1–2 and 8.*
  - **Covers:** partial orders, lattices, complete lattices, Galois connections, and the Knaster–Tarski and Kleene fixed-point theorems.
  - **Why:** analyses compute the least fixed point of a monotone function over a lattice, and this book proves why that works and why it ends.
  - **Vetting:** ○ The standard undergraduate text on order theory, cited by the analysis textbooks below for these results.

### A2. Limits of analysis
- **Classes of recursively enumerable sets and their decision problems.** H. G. Rice. *Transactions of the AMS* 74, 1953. *Paper.*
  - **Covers:** Rice's theorem: no exact analysis of any non-trivial property of what a program does is possible.
  - **Why:** it's the reason every analysis over- or under-approximates, and why SkyCodeX grades results as *proved*, *possible* or *can't tell*.
  - **Vetting:** ○ The original source.
- **Introduction to the Theory of Computation** (3rd ed.). M. Sipser. Cengage, 2012. *Reference, ch. 3–5.*
  - **Covers:** Turing machines, decidability, reductions, and Rice's theorem in a readable form.
  - **Vetting:** ○ The most widely used computability textbook.

### A3. Semantics
What a program *means*, which is what an analysis approximates.

- **The Formal Semantics of Programming Languages.** G. Winskel. MIT Press, 1993. *Reference, ch. 2–6.*
  - **Covers:** operational, denotational and axiomatic semantics, and domain theory.
  - **Why:** "sound" in program analysis is defined against a semantics.
  - **Vetting:** ○ The classic graduate semantics text.
- **Concrete Semantics: With Isabelle/HOL.** T. Nipkow, G. Klein. Springer, 2014. *Core for semantics. Free (concrete-semantics.org).*
  - **Covers:** big- and small-step semantics, type systems, Hoare logic, dataflow analysis and abstract interpretation, all proved in a proof assistant.
  - **Why:** it's the shortest route from a semantics to a *proved-correct* analysis.
  - **Vetting:** ○ Its abstract interpretation chapters connect directly to B3.

### A4. Logic and decision procedures
The solvers behind model checking, symbolic execution and verification.

- **Logic in Computer Science: Modelling and Reasoning about Systems** (2nd ed.). M. Huth, M. Ryan. Cambridge University Press, 2004. *Core, ch. 1–4.*
  - **Covers:** propositional and predicate logic, temporal logic (LTL/CTL), model checking basics, and Hoare logic.
  - **Vetting:** ○ A standard undergraduate course text.
- **The Calculus of Computation: Decision Procedures with Applications to Verification.** A. R. Bradley, Z. Manna. Springer, 2007. *Reference.*
  - **Covers:** first-order theories, inductive invariants, and decision procedures for arithmetic, arrays and equality.
  - **Why:** it links logic to program verification conditions.
  - **Vetting:** ○ Bradley later created IC3 (B12).
- **Decision Procedures: An Algorithmic Point of View** (2nd ed.). D. Kroening, O. Strichman. Springer, 2016. *Core, ch. 1–4 and 11.*
  - **Covers:** SAT and CDCL, SMT (DPLL(T)), bit-vectors, arrays and pointers. It also covers how bounded model checkers and symbolic executors encode C.
  - **Vetting:** ○ Kroening wrote CBMC (B12), so the C encoding is first-hand.
- **Handbook of Satisfiability** (2nd ed.). A. Biere, M. Heule, H. van Maaren, T. Walsh (eds.). IOS Press, 2021. *Reference only.*
  - **Covers:** the full depth of SAT solving.
  - **Why:** use it when a solver's behaviour, or its slowness, needs explaining.
  - **Vetting:** ○ The field's reference handbook.
- **Z3: An Efficient SMT Solver.** L. de Moura, N. Bjørner. TACAS 2008. *Paper.*
  - **Covers:** the architecture of the SMT solver most analysis tools use.
  - **Vetting:** ○ The original paper for Z3.

### A5. Program representations
These are control-flow graphs, dominators, SSA, dependence graphs and intermediate representations (IR).

- **Engineering a Compiler** (3rd ed.). K. D. Cooper, L. Torczon. Morgan Kaufmann, 2022. *Core, ch. 4–5, 8–9.*
  - **Covers:** IRs, CFGs, dominance, SSA construction, and iterative dataflow, all at a practical level.
  - **Vetting:** ○ A standard compiler course text.
- **Compilers: Principles, Techniques, and Tools** (2nd ed., "the Dragon Book"). A. V. Aho, M. S. Lam, R. Sethi, J. D. Ullman. Pearson, 2006. *Reference, ch. 9 and 12.*
  - **Covers:** dataflow analysis foundations (ch. 9) and interprocedural and pointer analysis with Datalog (ch. 12, by Lam).
  - **Vetting:** ○ The classic compiler text. Chapter 12 is a rare textbook account of Datalog pointer analysis.
- **Advanced Compiler Design and Implementation.** S. S. Muchnick. Morgan Kaufmann, 1997. *Reference, ch. 7–10.*
  - **Covers:** control-flow, dataflow, dependence and alias analysis in implementation detail.
  - **Vetting:** ○ The long-standing practitioner reference.
- **SSA-based Compiler Design.** F. Rastello, F. Bouchez Tichadou (eds.). Springer, 2022. *Reference.*
  - **Covers:** SSA theory, construction and destruction, and sparse analyses on SSA.
  - **Vetting:** ○ Written by many SSA researchers together. It's the deepest single source on SSA.
- **Efficiently computing static single assignment form and the control dependence graph.** R. Cytron, J. Ferrante, B. K. Rosen, M. N. Wegman, F. K. Zadeck. *ACM TOPLAS* 13(4), 1991. *Paper.*
  - **Covers:** dominance frontiers and SSA construction.
  - **Vetting:** ○ The defining SSA paper.
- **A Simple, Fast Dominance Algorithm.** K. D. Cooper, T. J. Harvey, K. Kennedy. *Software: Practice and Experience*, 2001. *Paper.*
  - **Covers:** the dominator algorithm most tools actually implement.
  - **Vetting:** ○ Cited as the practical alternative to Lengauer–Tarjan.
- **The program dependence graph and its use in optimization.** J. Ferrante, K. J. Ottenstein, J. D. Warren. *ACM TOPLAS* 9(3), 1987. *Paper.*
  - **Covers:** control and data dependence in one graph, the basis of slicing (B8).
  - **Vetting:** ○ The original source.
- **LLVM: A Compilation Framework for Lifelong Program Analysis & Transformation.** C. Lattner, V. Adve. CGO 2004. *Paper.*
  - **Covers:** the SSA-based IR that most C/C++ analysis, static and dynamic, is built on today.
  - **Vetting:** ○ The original LLVM paper.

---

## B. Static analysis

### B1. Textbooks for the whole field
- **Static Program Analysis.** A. Møller, M. I. Schwartzbach. Aarhus University, continuously revised (latest 2026). *Core. Free (cs.au.dk/~amoeller/spa).*
  - **Covers:**
    - type analysis;
    - lattices and fixed points;
    - monotone dataflow frameworks (liveness, reaching definitions, constant propagation, intervals);
    - widening and narrowing;
    - path-sensitive and relational analysis;
    - interprocedural analysis (context sensitivity, IFDS/IDE);
    - control-flow analysis;
    - pointer analysis (Andersen, Steensgaard, flow-sensitive);
    - abstract interpretation.
  - **Why:** the best first book. It covers B2–B6 at a level you can implement, with an open-source TIP implementation.
  - **Vetting:**
    - ✔ The site confirms the authors, the free licence (CC BY-NC-ND), the topics, and its use since 2008 for Aarhus's graduate course.
    - ✔ It was taught at the ECOOP/ISSTA 2018 summer school.
    - ✔ Its TIP language is used in M. Dwyer's analysis course (UVA CS 6620).
- **Introduction to Static Analysis: An Abstract Interpretation Perspective.** X. Rival, K. Yi. MIT Press, 2020. *Core.*
  - **Covers:** abstract interpretation built step by step, then numeric domains, memory and heap abstraction, and building and choosing analyses.
  - **Why:** the readable bridge from Møller & Schwartzbach to Cousot's theory (B3).
  - **Vetting:**
    - ✔ The publisher describes it as a self-contained introduction for advanced undergraduate and graduate courses.
    - ✔ The authors are at INRIA and Seoul National University. Yi's group built the Sparrow analyzer (see B17).
    - No independent review or course syllabus was found in the 2026-11-05 searches.
- **Principles of Program Analysis.** F. Nielson, H. R. Nielson, C. Hankin. Springer, 1999 (corrected printing 2005). *Reference.*
  - **Covers:** the four classic approaches in formal depth: dataflow analysis, constraint-based analysis, abstract interpretation, and type and effect systems.
  - **Why:** the rigorous reference when the core books simplify.
  - **Vetting:**
    - ✔ It's the supplementary text for CMU's program analysis course (17-355/17-665/17-819).
    - ✔ It's listed as the book for Technion's course 236347 and an EPFL course.
    - ✔ A 2010 post on the LLVM developers' list recommended it for classic dataflow, while calling it theory-leaning. Goodreads reviewers call it both "probably the best book" on static analysis and a "HARD read".
- **Data Flow Analysis: Theory and Practice.** U. P. Khedker, A. Sanyal, B. Karkare. CRC Press, 2009. *Reference.*
  - **Covers:** dataflow theory in depth, bit-vector and general frameworks, interprocedural methods, and an implementation in GCC.
  - **Vetting:** ○ The only full book on dataflow alone, written by researchers who work on GCC analysis.

### B2. Dataflow frameworks (intraprocedural)
- **A unified approach to global program optimization.** G. A. Kildall. POPL 1973. *Paper.*
  - **Covers:** the iterative worklist algorithm over a lattice.
  - **Vetting:** ○ The origin of the dataflow framework.
- **Monotone data flow analysis frameworks.** J. B. Kam, J. D. Ullman. *Acta Informatica* 7, 1977. *Paper.*
  - **Covers:** when iteration gives the meet-over-all-paths solution, and when it can't (monotone versus distributive frameworks).
  - **Vetting:** ○ The original source.
- **Further reading:** Møller & Schwartzbach ch. 4–5, and Khedker et al.

### B3. Abstract interpretation and numeric domains
- **Abstract interpretation: a unified lattice model for static analysis of programs by construction or approximation of fixpoints.** P. Cousot, R. Cousot. POPL 1977. *Paper.*
  - **Covers:** the theory itself: abstract domains, soundness, widening.
  - **Vetting:** ○ The founding paper.
- **Systematic design of program analysis frameworks.** P. Cousot, R. Cousot. POPL 1979. *Paper.*
  - **Covers:** Galois connections and combining domains.
  - **Vetting:** ○ The companion founding paper.
- **Principles of Abstract Interpretation.** P. Cousot. MIT Press, 2021. *Reference.*
  - **Covers:** the complete theory from its creator.
  - **Why:** read the chapters on whatever Rival & Yi summarise.
  - **Vetting:** ○ The definitive book by the theory's founder.
- **Automatic discovery of linear restraints among variables of a program.** P. Cousot, N. Halbwachs. POPL 1978. *Paper.*
  - **Covers:** the polyhedra domain.
  - **Vetting:** ○ The original source.
- **The octagon abstract domain.** A. Miné. *Higher-Order and Symbolic Computation* 19(1), 2006. *Paper.*
  - **Covers:** relational constraints of the form ±x ± y ≤ c, at a practical cost.
  - **Vetting:** ○ Used in Astrée.
- **Tutorial on Static Inference of Numeric Invariants by Abstract Interpretation.** A. Miné. *Foundations and Trends in Programming Languages* 4(3–4), 2017. *Core for numeric analysis.*
  - **Covers:** intervals, congruences, octagons and polyhedra; widening; floating point; implementation.
  - **Vetting:** ○ A long survey-tutorial by a lead Astrée developer.
- **Efficient chaotic iteration strategies with widenings.** F. Bourdoncle. FMPA 1993, LNCS 735. *Paper.*
  - **Covers:** the order in which to iterate, and where to widen (weak topological order).
  - **Why:** this is what makes fixed points fast in practice.
  - **Vetting:** ○ Its iteration order is the standard one.
- **A static analyzer for large safety-critical software.** B. Blanchet, P. Cousot, R. Cousot, J. Feret, L. Mauborgne, A. Miné, D. Monniaux, X. Rival. PLDI 2003. *Paper.*
  - **Covers:** Astrée proving no run-time errors in flight-control C code.
  - **Why:** abstract interpretation at industrial scale on embedded C.
  - **Vetting:** ○ A landmark industrial application.

### B4. Interprocedural analysis
- **Two approaches to interprocedural data flow analysis.** M. Sharir, A. Pnueli. In S. S. Muchnick, N. D. Jones (eds.), *Program Flow Analysis: Theory and Applications*, Prentice-Hall, 1981. *Paper.*
  - **Covers:** the call-string and functional approaches to context sensitivity.
  - **Vetting:** ○ The original source.
- **Precise interprocedural dataflow analysis via graph reachability.** T. Reps, S. Horwitz, M. Sagiv. POPL 1995. *Paper.*
  - **Covers:** IFDS: distributive problems solved exactly as reachability in an "exploded" graph.
  - **Vetting:** ○ The basis of most modern interprocedural taint and typestate tools.
- **Precise interprocedural dataflow analysis with applications to constant propagation.** M. Sagiv, T. Reps, S. Horwitz. *Theoretical Computer Science* 167, 1996. *Paper.*
  - **Covers:** IDE, which extends IFDS to values (such as SkyCodeX's "values settled per call").
  - **Vetting:** ○ The original source.

### B5. Call graphs and control-flow analysis
Covers virtual calls, function pointers and higher-order code.

- **Optimization of object-oriented programs using static class hierarchy analysis.** J. Dean, D. Grove, C. Chambers. ECOOP 1995. *Paper.*
  - **Covers:** CHA, resolving virtual calls from the class hierarchy.
  - **Vetting:** ○ The original source.
- **Fast static analysis of C++ virtual function calls.** D. F. Bacon, P. F. Sweeney. OOPSLA 1996. *Paper.*
  - **Covers:** RTA, which narrows CHA to the classes actually created, for C++ specifically.
  - **Vetting:** ○ The original source.
- **A framework for call graph construction algorithms.** D. Grove, C. Chambers. *ACM TOPLAS* 23(6), 2001. *Paper.*
  - **Covers:** one framework placing the call-graph algorithms by precision and cost.
  - **Vetting:** ○ The standard comparison.
- **Precise call graphs for C programs with function pointers.** A. Milanova, A. Rountev, B. G. Ryder. *Automated Software Engineering* 11(1), 2004. *Paper.*
  - **Covers:** resolving C function pointers, measured on real C.
  - **Why:** directly relevant to SkyCodeX following calls through function pointers and handler tables.
  - **Vetting:** ○
- **Control-Flow Analysis of Higher-Order Languages.** O. Shivers. PhD thesis, Carnegie Mellon University, 1991. *Reference.*
  - **Covers:** k-CFA, call graphs when functions are values (lambdas, callbacks).
  - **Vetting:** ○ The origin of k-CFA.

### B6. Pointer and alias analysis
- **Program Analysis and Specialization for the C Programming Language.** L. O. Andersen. PhD thesis, DIKU, University of Copenhagen, 1994. *Paper.*
  - **Covers:** inclusion-based points-to analysis for C.
  - **Vetting:** ○ "Andersen's analysis" comes from this thesis.
- **Points-to analysis in almost linear time.** B. Steensgaard. POPL 1996. *Paper.*
  - **Covers:** unification-based points-to: less precise, very fast.
  - **Vetting:** ○ The original source.
- **Pointer analysis: haven't we solved this problem yet?** M. Hind. PASTE 2001. *Paper.*
  - **Covers:** a survey of the dimensions: flow, context, field and heap modelling.
  - **Vetting:** ○ The standard orientation paper.
- **The ant and the grasshopper: fast and accurate pointer analysis for millions of lines of code.** B. Hardekopf, C. Lin. PLDI 2007. *Paper.*
  - **Covers:** making Andersen's analysis scale (cycle detection).
  - **Vetting:** ○
- **Pointer Analysis.** Y. Smaragdakis, G. Balatsouras. *Foundations and Trends in Programming Languages* 2(1), 2015. *Core for this topic.*
  - **Covers:** the modern account: Datalog formulation, context sensitivity, heap abstraction.
  - **Vetting:** ○ By the authors of Doop (B16).
- **Demand-driven pointer analysis.** N. Heintze, O. Tardieu. PLDI 2001. *Paper.*
  - **Covers:** answering only the queries needed.
  - **Why:** the same idea as tracing only the program on screen.
  - **Vetting:** ○
- **Refinement-based context-sensitive points-to analysis for Java.** M. Sridharan, R. Bodík. PLDI 2006. *Paper.*
  - **Covers:** demand-driven analysis with precision that grows as needed.
  - **Vetting:** ○

### B7. Heap and shape analysis, and separation logic
- **Separation logic: a logic for shared mutable data structures.** J. C. Reynolds. LICS 2002. *Paper.*
  - **Covers:** reasoning about the heap in local pieces.
  - **Vetting:** ○ The defining paper.
- **Parametric shape analysis via 3-valued logic.** M. Sagiv, T. Reps, R. Wilhelm. *ACM TOPLAS* 24(3), 2002. *Paper.*
  - **Covers:** shape analysis of lists, trees and cycles.
  - **Vetting:** ○ The TVLA framework.
- **Compositional shape analysis by means of bi-abduction.** C. Calcagno, D. Distefano, P. W. O'Hearn, H. Yang. *Journal of the ACM* 58(6), 2011 (POPL 2009). *Paper.*
  - **Covers:** per-function summaries inferred bottom-up.
  - **Vetting:** ○ The basis of Facebook/Meta Infer.
- **Incorrectness logic.** P. W. O'Hearn. POPL 2020. *Paper.*
  - **Covers:** under-approximate reasoning: proving that a bug *is* reachable.
  - **Why:** the theory behind graded results such as *possible* versus *proved*.
  - **Vetting:** ○

### B8. Slicing and dependence
- **Program slicing.** M. Weiser. *IEEE Transactions on Software Engineering* SE-10(4), 1984. *Paper.*
  - **Covers:** the statements that can affect a value at a point.
  - **Vetting:** ○ The original source.
- **Interprocedural slicing using dependence graphs.** S. Horwitz, T. Reps, D. Binkley. *ACM TOPLAS* 12(1), 1990. *Paper.*
  - **Covers:** system dependence graphs and slicing across calls.
  - **Vetting:** ○
- **A survey of program slicing techniques.** F. Tip. *Journal of Programming Languages* 3(3), 1995. *Core for this topic.*
  - **Covers:** static and dynamic slicing, and the main algorithms.
  - **Vetting:** ○ The standard survey.

### B9. Typestate, API rules and resource pairs
Covers lock/unlock, malloc/free and open/close.

- **Typestate: a programming language concept for enhancing software reliability.** R. E. Strom, S. Yemini. *IEEE TSE* SE-12(1), 1986. *Paper.*
  - **Covers:** objects as state machines, with operations allowed only in some states.
  - **Vetting:** ○ The original source.
- **Checking system rules using system-specific, programmer-written compiler extensions.** D. Engler, B. Chelf, A. Chou, S. Hallem. OSDI 2000. *Paper.*
  - **Covers:** state-machine checkers for rules such as "unlock after lock" and "free once", run on the Linux kernel.
  - **Vetting:** ○ The basis of Coverity.
- **Bugs as deviant behavior: a general approach to inferring errors in systems code.** D. Engler, D. Y. Chen, S. Hallem, A. Chou, B. Chelf. SOSP 2001. *Paper.*
  - **Covers:** inferring the rules (pairs, checks) from the code itself, then reporting deviations.
  - **Vetting:** ○
- **Effective typestate verification in the presence of aliasing.** S. J. Fink, E. Yahav, N. Dor, G. Ramalingam, E. Geay. *ACM TOSEM* 17(2), 2008. *Paper.*
  - **Covers:** typestate made precise despite aliases.
  - **Vetting:** ○

### B10. Information flow and static taint
- **A lattice model of secure information flow.** D. E. Denning. *Communications of the ACM* 19(5), 1976. *Paper.*
  - **Covers:** security levels as a lattice, and explicit versus implicit flows.
  - **Vetting:** ○ The original source.
- **Language-based information-flow security.** A. Sabelfeld, A. C. Myers. *IEEE Journal on Selected Areas in Communications* 21(1), 2003. *Core for this topic.*
  - **Covers:** non-interference, type systems for flow, and covert channels.
  - **Vetting:** ○ The standard survey.
- **Finding security vulnerabilities in Java applications with static analysis.** V. B. Livshits, M. S. Lam. USENIX Security 2005. *Paper.*
  - **Covers:** source-to-sink taint built on pointer analysis.
  - **Vetting:** ○
- **FlowDroid: precise context, flow, field, object-sensitive and lifecycle-aware taint analysis for Android apps.** S. Arzt, S. Rasthofer, C. Fritz, E. Bodden, A. Bartel, J. Klein, Y. Le Traon, D. Octeau, P. McDaniel. PLDI 2014. *Paper.*
  - **Covers:** a complete IFDS taint analysis, including callbacks and an implicit control-flow model.
  - **Vetting:** ○
- **Secure Programming with Static Analysis.** B. Chess, J. West. Addison-Wesley, 2007. *Reference.*
  - **Covers:** how commercial security analyzers work, and how to use their results.
  - **Vetting:** ○ The authors were at Fortify.

### B11. Static analysis of concurrency
Covers threads, interrupts and RTOS tasks.

- **Time, clocks, and the ordering of events in a distributed system.** L. Lamport. *Communications of the ACM* 21(7), 1978. *Paper.*
  - **Covers:** happens-before, the basis of all race definitions, static and dynamic.
  - **Vetting:** ○
- **The Art of Multiprocessor Programming** (2nd ed.). M. Herlihy, N. Shavit, V. Luchangco, M. Spear. Morgan Kaufmann, 2020. *Reference, ch. 1–3 and 7–8.*
  - **Covers:** mutual exclusion, linearizability and locks, which describe what an analysis is checking.
  - **Vetting:** ○ The standard concurrency text.
- **RacerX: effective, static detection of race conditions and deadlocks.** D. Engler, K. Ashcraft. SOSP 2003. *Paper.*
  - **Covers:** lockset-based static detection of races and deadlocks on OS kernels.
  - **Vetting:** ○
- **Effective static race detection for Java.** M. Naik, A. Aiken, J. Whaley. PLDI 2006. *Paper.*
  - **Covers:** the four-stage pipeline (reachable pairs, aliasing, escape, unlocked) with context sensitivity.
  - **Vetting:** ○
- **Static analysis of run-time errors in embedded real-time parallel C programs.** A. Miné. *Logical Methods in Computer Science* 8(1), 2012. *Paper.*
  - **Covers:** AstréeA, abstract interpretation across threads with priorities and interference.
  - **Why:** the closest published method to RTOS-task analysis.
  - **Vetting:** ○
- **Interrupt verification via thread verification.** J. Regehr, N. Cooprider. *Electronic Notes in Theoretical Computer Science* 174(9), 2007. *Paper.*
  - **Covers:** turning interrupt-driven embedded code into thread code so race tools apply.
  - **Vetting:** ○

### B12. Model checking and software model checking
- **Principles of Model Checking.** C. Baier, J.-P. Katoen. MIT Press, 2008. *Core for this topic.*
  - **Covers:** transition systems, LTL and CTL, automata-based checking, partial-order reduction, and timed and probabilistic systems.
  - **Vetting:** ○ The standard graduate textbook.
- **Model Checking** (2nd ed.). E. M. Clarke, O. Grumberg, D. Kroening, D. Peled, H. Veith. MIT Press, 2018. *Reference.*
  - **Covers:** the classic text by the field's founders, updated with SAT-based methods.
  - **Vetting:** ○
- **Handbook of Model Checking.** E. M. Clarke, T. A. Henzinger, H. Veith, R. Bloem (eds.). Springer, 2018. *Reference only.*
  - **Covers:** a chapter per technique, each written by its main researchers.
  - **Vetting:** ○
- **Symbolic model checking without BDDs.** A. Biere, A. Cimatti, E. Clarke, Y. Zhu. TACAS 1999. *Paper.*
  - **Covers:** bounded model checking (BMC).
  - **Vetting:** ○ The original source.
- **A tool for checking ANSI-C programs.** E. Clarke, D. Kroening, F. Lerda. TACAS 2004. *Paper.*
  - **Covers:** CBMC, bounded model checking of real C.
  - **Vetting:** ○
- **Counterexample-guided abstraction refinement.** E. Clarke, O. Grumberg, S. Jha, Y. Lu, H. Veith. CAV 2000. *Paper.*
  - **Covers:** CEGAR: abstract, check, refine.
  - **Vetting:** ○ The original source.
- **The SLAM project: debugging system software via static analysis.** T. Ball, S. K. Rajamani. POPL 2002. *Paper.*
  - **Covers:** predicate abstraction plus CEGAR on Windows drivers.
  - **Vetting:** ○ It became Microsoft's Static Driver Verifier.
- **Lazy abstraction.** T. A. Henzinger, R. Jhala, R. Majumdar, G. Sutre. POPL 2002. *Paper.*
  - **Covers:** refining only where needed (BLAST).
  - **Vetting:** ○
- **Interpolation and SAT-based model checking.** K. L. McMillan. CAV 2003. *Paper.*
  - **Covers:** Craig interpolants for unbounded proofs.
  - **Vetting:** ○
- **SAT-based model checking without unrolling.** A. R. Bradley. VMCAI 2011. *Paper.*
  - **Covers:** IC3/PDR.
  - **Vetting:** ○ The original source.
- **Software model checking.** R. Jhala, R. Majumdar. *ACM Computing Surveys* 41(4), 2009. *Core for this topic.*
  - **Covers:** a survey linking abstraction, CEGAR, BMC and interpolation for software.
  - **Vetting:** ○
- **Partial-Order Methods for the Verification of Concurrent Systems.** P. Godefroid. LNCS 1032, Springer, 1996. *Reference.*
  - **Covers:** reducing thread interleavings, the theory behind C6's DPOR.
  - **Vetting:** ○

### B13. Deductive verification and type systems
- **An axiomatic basis for computer programming.** C. A. R. Hoare. *Communications of the ACM* 12(10), 1969. *Paper.*
  - **Covers:** Hoare logic.
  - **Vetting:** ○ The original source.
- **Guarded commands, nondeterminacy and formal derivation of programs.** E. W. Dijkstra. *Communications of the ACM* 18(8), 1975. *Paper.*
  - **Covers:** weakest preconditions, which is how verification conditions are generated.
  - **Vetting:** ○
- **Program Proofs.** K. R. M. Leino. MIT Press, 2023. *Core for this topic.*
  - **Covers:** specification, invariants, termination and proofs, taught hands-on with Dafny.
  - **Vetting:** ○ By Dafny's author.
- **Dafny: an automatic program verifier for functional correctness.** K. R. M. Leino. LPAR 2010. *Paper.*
  - **Vetting:** ○
- **Frama-C: a software analysis perspective.** F. Kirchner, N. Kosmatov, V. Prevosto, J. Signoles, B. Yakobowski. *Formal Aspects of Computing* 27(3), 2015. *Paper.*
  - **Covers:** ACSL contracts on C; value analysis (abstract interpretation), WP (deductive proof) and runtime-assertion plug-ins on one platform.
  - **Why:** the main open platform combining static and dynamic analysis for C.
  - **Vetting:** ○
- **Why3 — where programs meet provers.** J.-C. Filliâtre, A. Paskevich. ESOP 2013. *Paper.*
  - **Covers:** the intermediate verification layer between programs and provers.
  - **Vetting:** ○
- **Types and Programming Languages.** B. C. Pierce. MIT Press, 2002. *Reference, ch. 1–11 and 22.*
  - **Covers:** type systems, soundness (progress and preservation), and type inference.
  - **Why:** type checking is the oldest static analysis. Inference is the "unification" solver in B1.
  - **Vetting:** ○ The standard text.

### B14. Termination and resource bounds
- **Proving program termination.** B. Cook, A. Podelski, A. Rybalchenko. *Communications of the ACM* 54(5), 2011. *Core for this topic.*
  - **Covers:** ranking functions, transition invariants and Terminator.
  - **Vetting:** ○
- **SPEED: precise and efficient static estimation of program computational complexity.** S. Gulwani, K. K. Mehra, T. Chilimbi. POPL 2009. *Paper.*
  - **Covers:** symbolic bounds on loop iterations.
  - **Vetting:** ○

### B15. Timing and stack analysis (embedded)
- **The worst-case execution-time problem — overview of methods and survey of tools.** R. Wilhelm, J. Engblom, A. Ermedahl, N. Holsti, S. Thesing, D. Whalley, G. Bernat, C. Ferdinand, R. Heckmann, T. Mitra, F. Mueller, I. Puaut, P. Puschner, J. Staschulat, P. Stenström. *ACM Transactions on Embedded Computing Systems* 7(3), 2008. *Core for this topic.*
  - **Covers:** WCET: cache and pipeline analysis, path analysis, and measurement-based versus static approaches.
  - **Vetting:** ○ The standard survey, by most of the field's tool authors.
- **Eliminating stack overflow by abstract interpretation.** J. Regehr, A. Reid, K. Webb. *ACM TECS* 4(4), 2005 (EMSOFT 2003). *Paper.*
  - **Covers:** worst-case stack depth, including interrupts, on microcontrollers.
  - **Vetting:** ○

### B16. Declarative analysis (Datalog and code queries)
- **Cloning-based context-sensitive pointer alias analysis using binary decision diagrams.** J. Whaley, M. S. Lam. PLDI 2004. *Paper.*
  - **Covers:** pointer analysis written as Datalog and solved with BDDs.
  - **Vetting:** ○
- **Strictly declarative specification of sophisticated points-to analyses.** M. Bravenboer, Y. Smaragdakis. OOPSLA 2009. *Paper.*
  - **Covers:** the Doop framework.
  - **Vetting:** ○
- **Soufflé: on synthesis of program analyzers.** H. Jordan, B. Scholz, P. Subotić. CAV 2016. *Paper.*
  - **Covers:** compiling Datalog to fast parallel C++.
  - **Vetting:** ○
- **QL: object-oriented queries on relational data.** P. Avgustinov, O. de Moor, M. P. Jones, M. Schäfer. ECOOP 2016. *Paper.*
  - **Covers:** the language behind CodeQL.
  - **Vetting:** ○

### B17. Scaling: sparse, incremental and compositional analysis
- **Design and implementation of sparse global analyses for C-like languages.** H. Oh, K. Heo, W. Lee, W. Lee, K. Yi. PLDI 2012. *Paper.*
  - **Covers:** following def-use chains instead of every CFG node, measured on large C (Sparrow).
  - **Vetting:** ○
- **Reviser: efficiently updating IDE-/IFDS-based data-flow analyses in response to incremental program changes.** S. Arzt, E. Bodden. ICSE 2014. *Paper.*
  - **Covers:** re-analysing only what changed.
  - **Why:** the same problem as Refresh and "what a change does".
  - **Vetting:** ○
- **Scaling static analyses at Facebook.** D. Distefano, M. Fähndrich, F. Logozzo, P. W. O'Hearn. *Communications of the ACM* 62(8), 2019. *Paper.*
  - **Covers:** compositional, diff-time analysis (Infer, Zoncolan) on huge codebases.
  - **Vetting:** ○
- **A memory model for static analysis of C programs.** Z. Xu, T. Kremenek, J. Zhang. ISoLA 2010, LNCS 6415. *Paper.*
  - **Covers:** the region-based memory model of the Clang Static Analyzer.
  - **Why:** the closest published account of the analyzer that sits next to clangd.
  - **Vetting:** ○

### B18. C and C++ specifics: undefined behaviour, coding rules, standards
- **Understanding integer overflow in C/C++.** W. Dietz, P. Li, J. Regehr, V. Adve. ICSE 2012. *Paper.*
  - **Covers:** which overflows are undefined, how common they are, and detection.
  - **Vetting:** ○
- **Towards optimization-safe systems: analyzing the impact of undefined behavior.** X. Wang, N. Zeldovich, M. F. Kaashoek, A. Solar-Lezama. SOSP 2013. *Paper.*
  - **Covers:** STACK: code the compiler may delete because of undefined behaviour.
  - **Vetting:** ○
- **Secure Coding in C and C++** (2nd ed.). R. C. Seacord. Addison-Wesley, 2013. *Reference.*
  - **Covers:** string, pointer, memory and integer errors, and their mitigations.
  - **Vetting:** ○ From CERT/SEI.
- **The CERT C Coding Standard** (2nd ed.). R. C. Seacord. Addison-Wesley, 2014. *Reference.*
  - **Covers:** the rules that analyzers check, each with its rationale.
  - **Vetting:** ○
- **Licensed standards:** study them, never copy their text into the project.
  - ISO/IEC 9899:2024 (C23) and ISO/IEC 14882:2024 (C++23), the languages' definitions.
  - **MISRA C:2023** and **MISRA C++:2023** (MISRA), coding rules for critical systems.
  - These are the final authority on what is undefined, unspecified or allowed. ○

### B19. Practice, soundness and usability
- **A few billion lines of code later: using static analysis to find bugs in the real world.** A. Bessey, K. Block, B. Chelf, A. Chou, B. Fulton, S. Hallem, C. Henri-Gros, A. Kamsky, S. McPeak, D. Engler. *Communications of the ACM* 53(2), 2010. *Core.*
  - **Covers:** what breaks when analysis meets real builds and real users (Coverity).
  - **Vetting:** ○
- **Lessons from building static analysis tools at Google.** C. Sadowski, E. Aftandilian, A. Eagle, L. Miller-Cushon, C. Jaspan. *Communications of the ACM* 61(4), 2018. *Core.*
  - **Covers:** false-positive budgets, and showing results where developers work.
  - **Vetting:** ○
- **Why don't software developers use static analysis tools to find bugs?** B. Johnson, Y. Song, E. Murphy-Hill, R. Bowdidge. ICSE 2013. *Paper.*
  - **Covers:** an interview study on trust, explanation and workflow.
  - **Vetting:** ○
- **In defense of soundiness: a manifesto.** B. Livshits, M. Sridharan, Y. Smaragdakis, O. Lhoták, J. N. Amaral, B.-Y. E. Chang, S. Z. Guyer, U. P. Khedker, A. Møller, D. Vardoulakis. *Communications of the ACM* 58(2), 2015. *Paper.*
  - **Covers:** how "sound" tools really handle reflection, eval and native code, and why they should say so.
  - **Why:** it backs honest grading of results.
  - **Vetting:** ○

### B20. Static analysis of binaries
- **Practical Binary Analysis.** D. Andriesse. No Starch Press, 2018. *Core for this topic.*
  - **Covers:** ELF, disassembly, binary CFGs, instrumentation, and dynamic taint and symbolic execution on binaries.
  - **Why:** it bridges B and C at machine level.
  - **Vetting:** ○
- **WYSINWYX: What You See Is Not What You eXecute.** G. Balakrishnan, T. Reps. *ACM TOPLAS* 32(6), 2010. *Paper.*
  - **Covers:** value-set analysis on executables, where source analysis and real behaviour differ.
  - **Vetting:** ○
- **SoK: (State of) the art of war: offensive techniques in binary analysis.** Y. Shoshitaishvili, R. Wang, C. Salls, N. Stephens, M. Polino, A. Dutcher, J. Grosen, S. Feng, C. Hauser, C. Kruegel, G. Vigna. IEEE S&P 2016. *Paper.*
  - **Covers:** angr; a systematic comparison of static, dynamic and symbolic binary techniques.
  - **Vetting:** ○

---

## C. Dynamic analysis

### C1. Foundations and overview
- **Software Testing and Analysis: Process, Principles, and Techniques.** M. Pezzè, M. Young. Wiley, 2008. *Core. Free electronic edition from the authors.*
  - **Covers:**
    - the dependability vocabulary;
    - finite-state verification;
    - dataflow models;
    - functional, structural (coverage) and model-based testing;
    - program analysis;
    - test execution, oracles and planning.
  - **Why:** the one textbook covering both static and dynamic analysis as one discipline.
  - **Vetting:**
    - ✔ The authors' site says Wiley returned the copyright so they could offer it free.
    - ✔ The preface positions it as a primary course text.
    - ✔ The table of contents confirms the topics.
- **The concept of dynamic analysis.** T. Ball. ESEC/FSE 1999. *Paper.*
  - **Covers:** what dynamic analysis can and can't conclude, and how frequency and coverage spectra work.
  - **Vetting:** ○ The defining short paper.
- **Static and dynamic analysis: synergy and duality.** M. D. Ernst. WODA 2003. *Core.*
  - **Covers:** soundness versus precision, and how each approach helps the other.
  - **Why:** the conceptual bridge between Parts B and C.
  - **Vetting:** ○ Widely cited.
- **A systematic survey of program comprehension through dynamic analysis.** B. Cornelissen, A. Zaidman, A. van Deursen, L. Moonen, R. Koschke. *IEEE TSE* 35(5), 2009. *Core.*
  - **Covers:** traces, visualisation, feature location and run views, for understanding code.
  - **Why:** the research behind showing *how a program actually runs*, which is SkyCodeX's purpose.
  - **Vetting:** ○

### C2. Instrumentation frameworks
- **Valgrind: a framework for heavyweight dynamic binary instrumentation.** N. Nethercote, J. Seward. PLDI 2007. *Paper.*
  - **Covers:** dynamic binary translation, shadow values, and building tools on it.
  - **Vetting:** ○
- **Pin: building customized program analysis tools with dynamic instrumentation.** C.-K. Luk, R. Cohn, R. Muth, H. Patil, A. Klauser, G. Lowney, S. Wallace, V. J. Reddi, K. Hazelwood. PLDI 2005. *Paper.*
  - **Covers:** just-in-time instrumentation, and the analysis-routine model.
  - **Vetting:** ○
- **Efficient, Transparent, and Comprehensive Runtime Code Manipulation.** D. Bruening. PhD thesis, MIT, 2004. *Reference.*
  - **Covers:** DynamoRIO's design: code caches, traces and transparency.
  - **Vetting:** ○
- **BPF Performance Tools.** B. Gregg. Addison-Wesley, 2019. *Reference.*
  - **Covers:** kernel and user tracing with eBPF, uprobes and USDT.
  - **Why:** dynamic analysis of running systems without restarting them.
  - **Vetting:** ○
- **See also:** Lattner & Adve (A5) for instrumentation at compile time, which is how the sanitizers work.

### C3. Memory error detection
- **Purify: fast detection of memory leaks and access errors.** R. Hastings, B. Joyce. Winter USENIX Conference, 1992. *Paper.*
  - **Covers:** object-code instrumentation for use-after-free, overflow and leaks.
  - **Vetting:** ○ The original source.
- **Using Valgrind to detect undefined value errors with bit-precision.** J. Seward, N. Nethercote. USENIX ATC 2005. *Paper.*
  - **Covers:** Memcheck's bit-level shadow memory.
  - **Vetting:** ○
- **AddressSanitizer: a fast address sanity checker.** K. Serebryany, D. Bruening, A. Potapenko, D. Vyukov. USENIX ATC 2012. *Paper.*
  - **Covers:** compile-time shadow memory and redzones (ASan, in Clang and GCC).
  - **Vetting:** ○
- **MemorySanitizer: fast detector of uninitialized memory use in C++.** E. Stepanov, K. Serebryany. CGO 2015. *Paper.*
  - **Vetting:** ○
- **SoftBound: highly compatible and complete spatial memory safety for C.** S. Nagarakatte, J. Zhao, M. M. K. Martin, S. Zdancewic. PLDI 2009. *Paper.*
  - **Covers:** pointer-based bounds checking, which complements ASan's object-based approach.
  - **Vetting:** ○
- **See also:** Dietz et al. (B18) for detecting undefined integer behaviour.

### C4. Profiling and performance analysis
- **gprof: a call graph execution profiler.** S. L. Graham, P. B. Kessler, M. K. McKusick. SIGPLAN Symposium on Compiler Construction, 1982. *Paper.*
  - **Covers:** sampling plus call counting, and its assumptions.
  - **Vetting:** ○
- **Optimally profiling and tracing programs.** T. Ball, J. R. Larus. *ACM TOPLAS* 16(4), 1994. *Paper.*
  - **Covers:** placing the fewest counters for complete edge counts.
  - **Vetting:** ○
- **Efficient path profiling.** T. Ball, J. R. Larus. MICRO 1996. *Paper.*
  - **Covers:** counting whole acyclic paths cheaply (Ball–Larus numbering).
  - **Vetting:** ○
- **Producing wrong data without doing anything obviously wrong!** T. Mytkowicz, A. Diwan, M. Hauswirth, P. F. Sweeney. ASPLOS 2009. *Paper.*
  - **Covers:** measurement bias from the environment and link order.
  - **Why:** required before believing any benchmark, the ThreadX ones included.
  - **Vetting:** ○
- **Evaluating the accuracy of Java profilers.** T. Mytkowicz, A. Diwan, M. Hauswirth, P. F. Sweeney. PLDI 2010. *Paper.*
  - **Covers:** why sampling profilers disagree (safepoint bias), which also applies outside Java.
  - **Vetting:** ○
- **Coz: finding code that counts with causal profiling.** C. Curtsinger, E. D. Berger. SOSP 2015. *Paper.*
  - **Covers:** virtual speed-ups that show what *would* help.
  - **Vetting:** ○
- **Systems Performance** (2nd ed.). B. Gregg. Addison-Wesley, 2020. *Reference.*
  - **Covers:** methodology (USE, workload characterisation), and CPU, memory and file-system profiling.
  - **Vetting:** ○

### C5. Tracing and record/replay
- **Whole program paths.** J. R. Larus. PLDI 1999. *Paper.*
  - **Covers:** a compressed record of a program's entire control-flow trace.
  - **Vetting:** ○
- **Engineering record and replay for deployability.** R. O'Callahan, C. Jones, N. Froyd, K. Huey, A. Noll, N. Partush. USENIX ATC 2017. *Paper.*
  - **Covers:** rr: low-cost recording of real C/C++ runs, and replaying them for reverse debugging.
  - **Vetting:** ○

### C6. Dynamic concurrency analysis
- **Eraser: a dynamic data race detector for multithreaded programs.** S. Savage, M. Burrows, G. Nelson, P. Sobalvarro, T. Anderson. *ACM TOCS* 15(4), 1997 (SOSP 1997). *Paper.*
  - **Covers:** the lockset algorithm.
  - **Vetting:** ○ The original source.
- **FastTrack: efficient and precise dynamic race detection.** C. Flanagan, S. N. Freund. PLDI 2009. *Paper.*
  - **Covers:** happens-before with epochs instead of full vector clocks.
  - **Vetting:** ○
- **ThreadSanitizer: data race detection in practice.** K. Serebryany, T. Iskhodzhanov. Workshop on Binary Instrumentation and Applications (WBIA), 2009. *Paper.*
  - **Covers:** a hybrid lockset and happens-before detector, used at Google scale.
  - **Vetting:** ○
- **Atomizer: a dynamic atomicity checker for multithreaded programs.** C. Flanagan, S. N. Freund. POPL 2004. *Paper.*
  - **Covers:** atomicity violations that aren't data races.
  - **Vetting:** ○
- **Using runtime analysis to guide model checking of Java programs.** K. Havelund. SPIN 2000, LNCS 1885. *Paper.*
  - **Covers:** GoodLock, deadlock prediction from lock-order cycles.
  - **Vetting:** ○
- **Finding and reproducing Heisenbugs in concurrent programs.** M. Musuvathi, S. Qadeer, T. Ball, G. Basler, P. A. Nainar, I. Neamtiu. OSDI 2008. *Paper.*
  - **Covers:** CHESS: systematic schedule exploration with a bound on preemptions.
  - **Vetting:** ○
- **Dynamic partial-order reduction for model checking software.** C. Flanagan, P. Godefroid. POPL 2005. *Paper.*
  - **Covers:** DPOR, exploring only interleavings that matter.
  - **Vetting:** ○

### C7. Dynamic taint and information flow
- **Dynamic taint analysis for automatic detection, analysis, and signature generation of exploits on commodity software.** J. Newsome, D. Song. NDSS 2005. *Paper.*
  - **Covers:** TaintCheck.
  - **Vetting:** ○ The original source.
- **Dytan: a generic dynamic taint analysis framework.** J. Clause, W. Li, A. Orso. ISSTA 2007. *Paper.*
  - **Covers:** configurable sources, sinks and propagation, including control-flow taint.
  - **Vetting:** ○
- **libdft: practical dynamic data flow tracking for commodity systems.** V. P. Kemerlis, G. Portokalidis, K. Jee, A. D. Keromytis. VEE 2012. *Paper.*
  - **Vetting:** ○
- **All you ever wanted to know about dynamic taint analysis and forward symbolic execution (but might have been afraid to ask).** E. J. Schwartz, T. Avgerinos, D. Brumley. IEEE S&P 2010. *Core for this topic.*
  - **Covers:** formal semantics of both techniques and their pitfalls (over- and under-tainting, path explosion).
  - **Vetting:** ○ A standard teaching paper.

### C8. Invariant and specification mining
- **Dynamically discovering likely program invariants to support program evolution.** M. D. Ernst, J. Cockrell, W. G. Griswold, D. Notkin. *IEEE TSE* 27(2), 2001. *Paper.*
  - **Covers:** the Daikon method.
  - **Vetting:** ○ The original source.
- **The Daikon system for dynamic detection of likely invariants.** M. D. Ernst, J. H. Perkins, P. J. Guo, S. McCamant, C. Pacheco, M. S. Tschantz, C. Xiao. *Science of Computer Programming* 69(1–3), 2007. *Paper.*
  - **Vetting:** ○

### C9. Runtime verification
- **A brief account of runtime verification.** M. Leucker, C. Schallhart. *Journal of Logic and Algebraic Programming* 78(5), 2009. *Core for this topic.*
  - **Covers:** building monitors from LTL, three-valued verdicts, and how this relates to testing and model checking.
  - **Vetting:** ○
- **Lectures on Runtime Verification: Introductory and Advanced Topics.** E. Bartocci, Y. Falcone (eds.). LNCS 10457, Springer, 2018. *Reference.*
  - **Covers:** specification languages, monitor synthesis, instrumentation, stream runtime verification, and distributed monitoring.
  - **Vetting:** ○ The field's tutorial volume.

### C10. Dynamic slicing, debugging and fault localization
- **Dynamic program slicing.** B. Korel, J. Laski. *Information Processing Letters* 29(3), 1988. *Paper.*
  - **Vetting:** ○ The original source.
- **Dynamic program slicing.** H. Agrawal, J. R. Horgan. PLDI 1990. *Paper.*
  - **Covers:** dependence-graph-based dynamic slices.
  - **Vetting:** ○
- **Why Programs Fail: A Guide to Systematic Debugging** (2nd ed.). A. Zeller. Morgan Kaufmann, 2009. *Core for this topic.*
  - **Covers:** the scientific method of debugging, observation, assertions, delta debugging, cause-effect chains and fault localization.
  - **Vetting:** ○
- **Simplifying and isolating failure-inducing input.** A. Zeller, R. Hildebrandt. *IEEE TSE* 28(2), 2002. *Paper.*
  - **Covers:** delta debugging.
  - **Vetting:** ○ The original source.
- **Visualization of test information to assist fault localization.** J. A. Jones, M. J. Harrold, J. Stasko. ICSE 2002. *Paper.*
  - **Covers:** Tarantula, spectrum-based fault localization.
  - **Vetting:** ○
- **A survey on software fault localization.** W. E. Wong, R. Gao, Y. Li, R. Abreu, F. Wotawa. *IEEE TSE* 42(8), 2016. *Paper.*
  - **Vetting:** ○ The standard survey.
- **The Debugging Book.** A. Zeller. CISPA Helmholtz Center for Information Security, continuously updated. *Reference. Free (debuggingbook.org).*
  - **Covers:** runnable chapters on tracing, slicing, delta debugging, statistical debugging and repair.
  - **Vetting:** ○ A companion to The Fuzzing Book (C12).

### C11. Testing and coverage adequacy
- **Introduction to Software Testing** (2nd ed.). P. Ammann, J. Offutt. Cambridge University Press, 2016. *Core for this topic.*
  - **Covers:** graph, logic, input-space and syntax coverage criteria; mutation; test automation.
  - **Vetting:** ○ A standard course text.
- **A Practical Tutorial on Modified Condition/Decision Coverage.** K. J. Hayhurst, D. S. Veerhusen, J. J. Chilenski, L. K. Rierson. NASA/TM-2001-210876, 2001. *Core for safety-critical work. Free (NASA).*
  - **Covers:** MC/DC as DO-178C requires it.
  - **Vetting:** ○
- **Applicability of modified condition/decision coverage to software testing.** J. J. Chilenski, S. P. Miller. *Software Engineering Journal* 9(5), 1994. *Paper.*
  - **Vetting:** ○ The original MC/DC paper.
- **Hints on test data selection: help for the practicing programmer.** R. A. DeMillo, R. J. Lipton, F. G. Sayward. *IEEE Computer* 11(4), 1978. *Paper.*
  - **Covers:** mutation testing and the coupling effect.
  - **Vetting:** ○ The original source.
- **An analysis and survey of the development of mutation testing.** Y. Jia, M. Harman. *IEEE TSE* 37(5), 2011. *Paper.*
  - **Vetting:** ○ The standard survey.
- **Licensed standards:** study them, never copy their text into the project.
  - **DO-178C**, *Software Considerations in Airborne Systems and Equipment Certification* (RTCA, 2011), with **DO-333**, its *Formal Methods Supplement* (RTCA, 2011).
  - They define what static, dynamic and formal evidence certification accepts. ○

### C12. Fuzzing and property-based testing
- **An empirical study of the reliability of UNIX utilities.** B. P. Miller, L. Fredriksen, B. So. *Communications of the ACM* 33(12), 1990. *Paper.*
  - **Covers:** the study that started fuzzing.
  - **Vetting:** ○ The original source.
- **The Fuzzing Book.** A. Zeller, R. Gopinath, M. Böhme, G. Fraser, C. Holler. CISPA, continuously updated. *Core for this topic. Free (fuzzingbook.org).*
  - **Covers:** random, mutation, grammar, greybox, search-based, symbolic and concolic fuzzing, with runnable code.
  - **Vetting:**
    - ✔ An ANU course recommends it as reading.
    - ✔ An ASE 2023 tutorial assigns its chapters.
    - ✔ A Reddit commenter recommends it (an archived copy, so its date and context are unclear).
    - ✔ Its code is MIT-licensed and its text CC BY-NC-SA.
- **Fuzzing: Brute Force Vulnerability Discovery.** M. Sutton, A. Greene, P. Amini. Addison-Wesley, 2007. *Reference.*
  - **Covers:** practical fuzzing of file formats, networks and environment variables.
  - **Vetting:** ○
- **Coverage-based greybox fuzzing as Markov chain.** M. Böhme, V.-T. Pham, A. Roychoudhury. CCS 2016. *Paper.*
  - **Covers:** AFLFast: why power schedules matter.
  - **Vetting:** ○
- **AFL++: combining incremental steps of fuzzing research.** A. Fioraldi, D. Maier, H. Eißfeldt, M. Heuse. USENIX WOOT 2020. *Paper.*
  - **Covers:** today's reference greybox fuzzer.
  - **Vetting:** ○
- **The art, science, and engineering of fuzzing: a survey.** V. J. M. Manès, H. Han, C. Han, S. K. Cha, M. Egele, E. J. Schwartz, M. Woo. *IEEE TSE* 47(11), 2021. *Core for this topic.*
  - **Covers:** a taxonomy of the whole field.
  - **Vetting:** ○
- **Evaluating fuzz testing.** G. Klees, A. Ruef, B. Cooper, S. Wei, M. Hicks. CCS 2018. *Paper.*
  - **Covers:** how to compare fuzzers without fooling yourself.
  - **Vetting:** ○
- **Fuzzing with code fragments.** C. Holler, K. Herzig, A. Zeller. USENIX Security 2012. *Paper.*
  - **Covers:** LangFuzz, grammar-based fuzzing of interpreters.
  - **Vetting:** ○
- **Finding and understanding bugs in C compilers.** X. Yang, Y. Chen, E. Eide, J. Regehr. PLDI 2011. *Paper.*
  - **Covers:** Csmith: generating C programs free of undefined behaviour, and differential testing.
  - **Vetting:** ○
- **QuickCheck: a lightweight tool for random testing of Haskell programs.** K. Claessen, J. Hughes. ICFP 2000. *Paper.*
  - **Covers:** property-based testing and shrinking.
  - **Vetting:** ○ The original source.

---

## D. Hybrid analysis: symbolic and concolic execution

- **Symbolic execution and program testing.** J. C. King. *Communications of the ACM* 19(7), 1976. *Paper.*
  - **Covers:** symbolic execution itself: symbolic values, path conditions and the execution tree.
  - **Vetting:** ○ The founding paper.
- **DART: directed automated random testing.** P. Godefroid, N. Klarlund, K. Sen. PLDI 2005. *Paper.*
  - **Covers:** concolic execution: concrete runs steering symbolic ones.
  - **Vetting:** ○ The original source.
- **CUTE: a concolic unit testing engine for C.** K. Sen, D. Marinov, G. Agha. ESEC/FSE 2005. *Paper.*
  - **Covers:** concolic testing with pointers and data structures in C.
  - **Vetting:** ○
- **KLEE: unassisted and automatic generation of high-coverage tests for complex systems programs.** C. Cadar, D. Dunbar, D. Engler. OSDI 2008. *Core for this topic.*
  - **Covers:** LLVM-based symbolic execution, environment models, search strategies, and the results on GNU Coreutils.
  - **Vetting:**
    - ✔ Imperial College confirms the paper won the Jay Lepreau Best Paper Award.
    - ✔ It was elected to the ACM SIGOPS Hall of Fame, presented at SOSP 2019.
- **Automated whitebox fuzz testing.** P. Godefroid, M. Y. Levin, D. Molnar. NDSS 2008. *Paper.*
  - **Covers:** SAGE, concolic fuzzing of whole x86 programs at Microsoft.
  - **Vetting:** ○
- **Symbolic execution for software testing: three decades later.** C. Cadar, K. Sen. *Communications of the ACM* 56(2), 2013. *Core.*
  - **Covers:** a short survey of the main methods and the open challenges.
  - **Vetting:** ○
- **A survey of symbolic execution techniques.** R. Baldoni, E. Coppa, D. C. D'Elia, C. Demetrescu, I. Finocchi. *ACM Computing Surveys* 51(3), 2018. *Core.*
  - **Covers:** memory models, path explosion, constraint solving, environment modelling and loops: the full depth of the topic.
  - **Vetting:** ○
- **Driller: augmenting fuzzing through selective symbolic execution.** N. Stephens, J. Grosen, C. Salls, A. Dutcher, R. Wang, J. Corbetta, Y. Shoshitaishvili, C. Kruegel, G. Vigna. NDSS 2016. *Paper.*
  - **Covers:** a hybrid fuzzer that switches between fuzzing and symbolic execution.
  - **Vetting:** ○
- **QSYM: a practical concolic execution engine tailored for hybrid fuzzing.** I. Yun, S. Lee, M. Xu, Y. Jang, T. Kim. USENIX Security 2018. *Paper.*
  - **Vetting:** ○
- **See also:**
  - Schwartz et al. (C7) for the formal semantics.
  - Kroening & Strichman (A4) for the solvers.
  - Andriesse (B20) for symbolic execution on binaries.

---

## E. Edge of the field

- **A survey of machine learning for big code and naturalness.** M. Allamanis, E. T. Barr, P. Devanbu, C. Sutton. *ACM Computing Surveys* 51(4), 2018. *Reference.*
  - **Covers:** learned models of code for bug finding, naming and type inference, and where they help or fall short next to analysis.
  - **Why:** the one entry for this area, so the list's scope is complete.
  - **Vetting:** ○ The standard survey of the area.

---

## Coverage map: every component and the entries that cover it

| Component | Subcomponent | Primary entries |
|---|---|---|
| Prerequisites | Proofs, discrete maths, probability | Velleman; Lehman–Leighton–Meyer |
| | Algorithms | Skiena; Cormen et al. |
| | C, C++ | Kernighan & Ritchie; Stroustrup |
| | Machine and OS | Bryant & O'Hallaron; Arpaci-Dusseau ×2 |
| | Language tools, ML notation | Nystrom; Minsky & Madhavapeddy |
| Foundations | Lattices, fixed points, Galois connections | Davey & Priestley; Møller & Schwartzbach ch. 4; Cousot 1979 |
| | Undecidability, approximation | Rice; Sipser |
| | Semantics, soundness | Winskel; Nipkow & Klein |
| | Logic, SAT/SMT | Huth & Ryan; Kroening & Strichman; Bradley & Manna; Z3 |
| | CFG, dominators, SSA, PDG, IR | Cooper & Torczon; Cytron; Cooper–Harvey–Kennedy; Ferrante; Rastello; LLVM |
| Static | Dataflow, intraprocedural | Kildall; Kam & Ullman; Khedker; M&S |
| | Abstract interpretation, widening | Cousot 1977/1979; Rival & Yi; Cousot 2021; Bourdoncle |
| | Numeric domains | Cousot & Halbwachs; Miné 2006; Miné 2017 |
| | Interprocedural, context sensitivity | Sharir & Pnueli; IFDS; IDE; M&S |
| | Call graphs, virtual calls, function pointers | CHA; RTA; Grove & Chambers; Milanova et al.; Shivers |
| | Pointers, aliasing | Andersen; Steensgaard; Hind; Hardekopf & Lin; Smaragdakis & Balatsouras |
| | Demand-driven analysis | Heintze & Tardieu; Sridharan & Bodík |
| | Heap, shape, separation logic | Reynolds; Sagiv–Reps–Wilhelm; bi-abduction; Incorrectness logic |
| | Slicing, dependence | Weiser; Horwitz–Reps–Binkley; Tip |
| | Typestate, resource pairs | Strom & Yemini; Engler 2000/2001; Fink et al. |
| | Information flow, taint | Denning; Sabelfeld & Myers; Livshits & Lam; FlowDroid |
| | Concurrency, interrupts, RTOS | Lamport; RacerX; Naik et al.; AstréeA; Regehr & Cooprider |
| | Model checking (finite and software) | Baier & Katoen; Clarke et al.; BMC; CBMC; CEGAR; SLAM; BLAST; interpolation; IC3; Jhala & Majumdar |
| | Deductive verification | Hoare; Dijkstra; Leino; Frama-C; Why3 |
| | Type systems | Pierce |
| | Termination, complexity bounds | Cook et al.; SPEED |
| | WCET, stack depth | Wilhelm et al.; Regehr–Reid–Webb |
| | Datalog, code queries | Whaley & Lam; Doop; Soufflé; QL |
| | Scaling, incremental, compositional | Sparse (Oh et al.); Reviser; Distefano et al.; Clang SA memory model |
| | C/C++ undefined behaviour, rules | Dietz et al.; STACK; Seacord ×2; ISO C/C++; MISRA |
| | Practice, soundness, usability | Bessey; Sadowski; Johnson; Soundiness |
| | Binaries | Andriesse; WYSINWYX; angr SoK |
| Dynamic | Concepts, comprehension | Pezzè & Young; Ball; Ernst; Cornelissen et al. |
| | Instrumentation | Valgrind; Pin; DynamoRIO; LLVM; BPF |
| | Memory errors | Purify; Memcheck; ASan; MSan; SoftBound |
| | Profiling, measurement | gprof; Ball–Larus ×2; Mytkowicz ×2; Coz; Gregg |
| | Tracing, record/replay | Whole program paths; rr |
| | Races, deadlocks, atomicity, schedules | Eraser; FastTrack; TSan; Atomizer; GoodLock; CHESS; DPOR |
| | Dynamic taint | TaintCheck; Dytan; libdft; Schwartz et al. |
| | Invariant mining | Daikon ×2 |
| | Runtime verification | Leucker & Schallhart; Bartocci & Falcone |
| | Dynamic slicing, debugging, fault localization | Korel & Laski; Agrawal & Horgan; Zeller ×3; Tarantula; Wong et al. |
| | Coverage, MC/DC, mutation | Ammann & Offutt; Hayhurst et al.; Chilenski & Miller; DeMillo et al.; Jia & Harman; DO-178C/DO-333 |
| | Fuzzing, property-based testing | Miller; Fuzzing Book; Sutton et al.; AFLFast; AFL++; Manès et al.; Klees et al.; LangFuzz; Csmith; QuickCheck |
| Hybrid | Symbolic, concolic, hybrid fuzzing | King; DART; CUTE; KLEE; SAGE; Cadar & Sen; Baldoni et al.; Driller; QSYM |
| Edge | Learned models of code | Allamanis et al. |

## Limits of "self-contained"

- **What it does cover:** every subcomponent in the map has a core text, a survey, or the original paper. Together they teach it fully, without further sources.
- **Language tools:** to use a tool from the list (KLEE, CBMC, Frama-C, AFL++, the sanitizers, Soufflé), its own manual is needed. Manuals aren't study texts, so they aren't listed.
- **New work:** research after 2026 will add to every section. The surveys above (Baldoni, Manès, Wong, Jhala & Majumdar, Smaragdakis & Balatsouras) are the places to look for it.
- **Out of scope:** probabilistic-program analysis, quantum programs, and smart-contract-specific tools. The methods transfer from the list, but the specialised literature isn't included.

## Sources checked on 2026-11-05
- [Teach Yourself Computer Science (the prerequisite recommendations)](https://teachyourselfcs.com/)
- [Static Program Analysis, the authors' site (Aarhus)](https://cs.au.dk/~amoeller/spa/)
- [ECOOP/ISSTA 2018 summer school: Static Program Analysis](https://2018.ecoop.org/details/ecoop-issta-2018-summer-school/5/Static-Program-Analysis)
- [UVA CS 6620 slides using TIP (M. Dwyer)](https://matthewbdwyer.github.io/6620/slides/1-TIP.pdf)
- [CMU 17-355 syllabus, which names PPA as the supplementary text](https://dcmpx.remotevs.com/edu/cmu/cs/www/PL/~aldrich/courses/17-355-18sp/syllabus.html)
- [Technion 236347 course book page (PPA)](https://webcourse.cs.technion.ac.il/02360347/Winter2015-2016/book.html)
- [EPFL LARA: PPA book page](https://lara.epfl.ch/w/sav10/principles_of_program_analysis_book)
- [LLVM-dev 2010 thread recommending PPA](https://lists.llvm.org/pipermail/llvm-dev/2010-April/030976.html)
- [Goodreads, Principles of Program Analysis](https://www.goodreads.com/book/show/913358)
- [Nielson & Nielson, Program Analysis (an Appetizer), arXiv](https://arxiv.org/abs/2012.10086)
- [Rival & Yi: MIT Press listing via i-programmer](https://i-programmer.info/book-watch-archive/13496-introduction-to-static-analysis-mit-press.html)
- [Pezzè & Young, free edition (University of Oregon)](https://ix.cs.uoregon.edu/~michal/book/free.php)
- [The Fuzzing Book](https://fuzzingbook.org/)
- [ANU COMP4130 readings](https://comp.anu.edu.au/courses/comp4130/readings/)
- [ASE 2023 tutorial: Language-Based Testing](https://conf.researchr.org/details/ase-2023/ase-2023-tutorials/1/Language-Based-Testing)
- [Reddit snapshot recommending The Fuzzing Book](https://reddit.sentinel-team.org/posts/1s3z5cx/snapshots/2026-03-27T20%3A52%3A56.578346Z)
- [Imperial College: KLEE paper elected to the SIGOPS Hall of Fame](https://imperial.ac.uk/news/193808/paper-co-authored-professor-cadar-elected-acm)
- [KLEE publication page (Imperial SRG)](https://srg.doc.ic.ac.uk/people/cristian-cadar/publications/08-klee-osdi.html)
