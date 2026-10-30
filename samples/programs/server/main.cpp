// The program the launcher starts.
#include "../common/log.hpp"

static void serve() { log_line("serving"); }

int main() {
  serve();
  return 0;
}
