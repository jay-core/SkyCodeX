// Configurations: code that exists only under other build settings. As built (compile_flags.txt) BOARD is 1 and
// nothing else is defined. src/tests/configs.test.ts checks what each setting runs.
void log_line(const char *) {}
void init_board_a() {}
void init_board_b() {}
void check_stack() {}
void run() {}
void wide() {}
void narrow() {}

void start() {
#ifdef DEBUG
  log_line("start");
#endif
#if BOARD == 1
  init_board_a();
#elif BOARD == 2
  init_board_b();
#endif
#ifndef NO_CHECKS
  check_stack();
#endif
  run();
}

// decided by the compiler in every build: on a 64-bit target only wide() is in it
void pick_width() {
  if constexpr (sizeof(void *) == 8) wide();
  else narrow();
}

// the discarded side returns early: the code after the if is still reached
int after_constexpr() {
  if constexpr (sizeof(char) == 2) { narrow(); return 1; }
  run();
  return 0;
}

int main() {
  start();
  pick_width();
  return after_constexpr();
}
