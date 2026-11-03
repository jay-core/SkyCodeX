// The repair engine's coverage sample in C (see repair.cpp).
#include <stdio.h>
#include <string.h>

size_t length(const char *s) { return strlen(s); }

int main(void) {
  const char *word = "flow";
  printf("%zu\n", length(word));
  return 0;
}
