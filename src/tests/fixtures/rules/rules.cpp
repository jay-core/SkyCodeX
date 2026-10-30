// One function per evaluation-order rule of the flow analyser (src/shared/flowrun.ts); the expected run of each is
// written beside it and checked in src/tests/flowrun.test.ts.
#include <functional>
#include <thread>

int a() { return 1; }
int b() { return 2; }
int c() { return 3; }
int d(int x) { return x; }
int e(int x, int y) { return x + y; }
void worker() {}
struct S { void m() {} };

void nested() { d(a()); }                                        // a, then d
void for_parts() { for (int i = a(); i < b(); i += c()) d(i); }  // a once; every pass: b, d, c
void ternary() { int x = a() ? b() : c(); (void)x; }             // a; then b, or else c
void logic() { if (a() || b()) c(); }                            // a; b only when a() is false; then c
void args() { e(a(), b()); }                                     // a and b in an order the compiler picks; then e
void assign() { int v[4]; v[a()] = b(); }                        // C++17: the right side first, b then a
void sw(int k) {
    switch (k) {
    case 0: a(); break;
    case 1: case 2: b();                                         // falls through into default
    default: c();
    }
}
void tr() { try { a(); } catch (...) { b(); } }                 // a always starts; b only when something is thrown
void ptr(int (*f)()) { f(); }                                    // through a pointer
void mptr(S& s, void (S::*p)()) { (s.*p)(); }                   // through a member pointer
void thr() { std::thread t(worker); t.join(); }                  // worker runs on a new thread
void lam() { auto f = [] { a(); }; f(); }                       // a runs when the lambda is called
void stat() { static int s = a(); (void)s; }                     // a the first time only
void dowhile() { do { a(); } while (b()); }                      // every pass: a, then b
void early(int k) { if (k) return; a(); }                        // a only when k is 0
void dead() { return; a(); }                                     // a never runs
void elif(int k) { if (k == 1) a(); else if (k == 2) b(); else c(); }
void counts() {
    for (int i = 0; i < 3; ++i) a();                             // exactly 3 passes
    for (int j = 0; j < 3; ++j) { if (j) break; b(); }           // not certain: it can leave early
}
void fnvalue() { std::function<int()> g = a; g(); }              // a is a value; g() goes through the std::function

struct P { float x; };
P operator*(const P& p, float k) { return P{p.x * k}; }
float sq(float v) { return v * v; }                              // built-in *: no call, though an operator* exists
P scale(P p) { return p * 2.0f; }                                // operator*
template <class T> void tmpl(T t) { t.go(); }                    // dependent: resolved per instantiation
struct Inc;
Inc* get();
void broken() { get()->go(); }                                   // does not compile: unresolved, never a guess
