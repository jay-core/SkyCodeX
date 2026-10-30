// What the flow engine must follow beyond plain calls: overrides of a virtual method, calls through a table of
// function pointers, a thread, and interrupt handlers that nothing in the code calls.
#include <cstdio>
#include <thread>

struct Shape {
  virtual ~Shape() = default;
  virtual double area() const = 0;
  virtual void draw() const { std::puts("shape"); }
};
struct Circle : Shape {
  double r;
  explicit Circle(double r) : r(r) {}
  double area() const override { return 3.14159 * r * r; }
  void draw() const override { outline(); }
  void outline() const { std::puts("circle"); }
};
struct Square : Shape {
  double s;
  explicit Square(double s) : s(s) {}
  double area() const override { return s * s; }
};

using Handler = int (*)(int);
static int on_get(int x) { return x + 1; }
static int on_post(int x) { return x * 2; }
static Handler table[] = { on_get, on_post };
static int dispatch(int i, int v) { return table[i](v); }

static void worker() { dispatch(0, 1); }

extern "C" void SysTick_Handler(void) { std::puts("tick"); }
extern "C" void USART1_IRQHandler(void) { dispatch(1, 2); }

int main() {
  Circle c(1.0);
  Square q(2.0);
  const Shape* shapes[] = { &c, &q };
  double total = 0;
  for (const Shape* s : shapes) {
    total += s->area();
    s->draw();
  }
  std::thread t(worker);
  t.join();
  return total > 0 ? 0 : 1;
}
