// Shared by both programs.
#include "log.hpp"
#include <cstdio>

void log_line(const char* what) { std::printf("%s\n", what); }
