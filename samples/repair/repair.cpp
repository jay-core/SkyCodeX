// The error repair engine's coverage sample: correct code that the `repair` smoke scenario breaks one edit at a time
// (src/renderer/smoke.ts, repairCheck), to measure how many errors get a fix that clangd confirms.
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Point { int x; int y; };

int total(const std::vector<int> &v) {
  int sum = 0;
  for (std::size_t i = 0; i < v.size(); i++) sum += v[i];
  return sum;
}

int area(const Point *p) { return p->x * p->y; }

int first(const int *values) {
  int head = *values;
  return head;
}

void fill(int *out, int value) { *out = value; }

int main() {
  std::vector<int> numbers = {3, 1, 2};
  std::sort(numbers.begin(), numbers.end());
  Point corner{2, 3};
  std::string name = "corner";
  int count = 0;
  fill(&count, total(numbers));
  count += corner.x;
  if (area(&corner) > 4 && count > 0) {
    std::cout << name << " " << first(numbers.data()) << std::endl;
  }
  return 0;
}
