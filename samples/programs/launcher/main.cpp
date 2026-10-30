// Starts the server program by name.
#include <cstdlib>
#include "../common/log.hpp"

int main() {
  log_line("starting the server");
  return std::system("./server");
}
