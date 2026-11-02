// Values settled per call (src/shared/flowvalues.ts): a constant passed in settles a condition for that call only.
// Each function says what its call from main settles; src/tests/values.test.ts checks the analyser against it.
void a() {}
void b() {}
void c() {}
void d() {}
void e() {}
bool ready() { return true; }

// draw(true): the else cannot happen
void draw(bool clear) {
  if (clear) a();
  else b();
}

// frame(false) passes its value on: in paint, the then cannot happen
void paint(bool clear) {
  if (clear) a();
}
void frame(bool clear) { paint(clear); }

// pick(1): case 1 runs and falls into case 2; case 0 and default cannot happen
void pick(int mode) {
  switch (mode) {
    case 0: a(); break;
    case 1: b();
    case 2: c(); break;
    default: d();
  }
}

// early(true): it returns, so what follows cannot happen
void early(bool quick) {
  if (quick) return;
  e();
}

// both(false): the right side of && and the then cannot happen
void both(bool on) {
  if (on && ready()) a();
}

// greet("hi"): a string literal is never null, so the then cannot happen
void greet(const char *name) {
  if (name == nullptr) a();
  else b();
}

// big(-1): -1 made unsigned is larger than 10 on every platform (65535 or more), so the else cannot happen
void big(unsigned n) {
  if (n > 10) a();
  else b();
}

// spin(false): the loop never runs
void spin(bool go) {
  while (go) a();
}

// outer(false): the then cannot happen, and inner's only call is inside it
void inner(bool v) {
  if (v) a();
  else b();
}
void outer(bool go) {
  if (go) inner(true);
}

// tern(true): the else of ?: cannot happen
int tern(bool t) { return t ? (a(), 1) : (b(), 2); }

// ch('A'): 'A' is 65 whether char is signed or not, so the then cannot happen
void ch(char k) {
  if (k < 0) a();
}

// Nothing is settled below: each says why.

// the parameter is assigned before the test
void reset(int k) {
  k = 0;
  if (k) a();
}
// the parameter is pointed to, so it may change through the pointer
void poke(int k) {
  int *p = &k;
  *p = 1;
  if (k == 0) a();
}
// the condition is true whatever is passed: a constant, not settled by this call
void fixed(bool x) {
  if (x || true) a();
  else b();
}
// a goto: a part that looks unreachable may be jumped into
void jumpy(bool x) {
  if (x) a();
  goto done;
done:
  b();
}
// k + 1 overflows int: undefined, so not judged
void over(int k) {
  if (k + 1 > k) a();
}
// 65536 * 65536 overflows a 32-bit long: the platforms disagree
void wide(long v) {
  if (v * 65536 > 100000) a();
}
// an enumerator passed in is not read as a value
enum Color { Red, Green, Blue };
void hue(Color col) {
  switch (col) {
    case Red: a(); break;
    case Green: b(); break;
    default: c();
  }
}

int main() {
  draw(true);
  draw(false);
  frame(false);
  pick(1);
  early(true);
  both(false);
  greet("hi");
  big(-1);
  spin(false);
  outer(false);
  tern(true);
  ch('A');
  reset(5);
  poke(0);
  fixed(false);
  jumpy(false);
  over(2147483647);
  wide(65536);
  hue(Green);
  return 0;
}
