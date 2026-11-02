// Every way out of a function, for the "errors only" analysis (src/tests/exits.test.ts).
#include <cstdio>
#include <cstdlib>
#include <csetjmp>
#include <stdexcept>

static std::jmp_buf restart;

[[noreturn]] void die(const char* why) {
  std::fputs(why, stderr);
  std::exit(3);
}

__attribute__((noreturn)) static void halt() { std::abort(); }

int parse(const char* s) {
  if (!s) return -1;
  if (*s == '!') throw std::runtime_error("bang");
  int n = 0;
  for (; *s; ++s) {
    if (*s == ' ') continue;
    if (*s < '0' || *s > '9') break;
    n = n * 10 + (*s - '0');
  }
  return n;
}

int command(int cmd) {
  switch (cmd) {
    case 0: return 0;
    case 1: die("one");
    case 2: halt();
    case 3: std::longjmp(restart, 1);
    default: break;
  }
  auto twice = [](int x) { if (x < 0) return 0; return x * 2; };
  return twice(cmd);
}

int open_all(int k) {
  int rc = 0;
  if (k > 3) goto cleanup;
  rc = k;
  try {
    rc = parse("12");
  } catch (const std::exception&) {
    return -2;
  }
cleanup:
  return rc;
}

int main(int argc, char** argv) {
  if (setjmp(restart)) return 9;
  if (argc > 5) std::exit(1);
  int v = parse(argc > 1 ? argv[1] : "7");
  v += command(v);
  v += open_all(v);
  return v;
}
