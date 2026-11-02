// Pairs that don't close, for src/tests/pairs.test.ts: each function says what the analysis should find.
#include <pthread.h>
#include <cstdio>
#include <cstdlib>
#include <mutex>
#include <stdexcept>

static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static std::mutex mu;
[[noreturn]] void die(const char* why) { std::fputs(why, stderr); std::exit(2); }

// nothing: locked, then unlocked on the only path
int lock_ok(int x) { pthread_mutex_lock(&m); x += 1; pthread_mutex_unlock(&m); return x; }

// the lock stays taken if x < 0
int lock_early(int x) {
  pthread_mutex_lock(&m);
  if (x < 0) return -1;
  pthread_mutex_unlock(&m);
  return 0;
}

// buf leaks when bad
int mem_branch(int n, bool bad) {
  char* buf = (char*)malloc(n);
  if (bad) {
    return 0;
  }
  free(buf);
  return 1;
}

// nothing: the goto path is not judged, the other frees
int mem_goto(int n) {
  char* p = (char*)malloc(n);
  if (!p) goto out;
  p[0] = 0;
  free(p);
out:
  return n;
}

// nothing: break leaves the loop, then the file is closed
int file_loop(const char* name) {
  FILE* f = fopen(name, "r");
  char line[80];
  int n = 0;
  while (fgets(line, sizeof line, f)) {
    if (line[0] == '#') break;
    n++;
  }
  fclose(f);
  return n;
}

// the file stays open when the header is wrong
int file_throw(const char* name) {
  FILE* f = fopen(name, "r");
  if (fgetc(f) != 'P') throw std::runtime_error("not a P file");
  fclose(f);
  return 1;
}

// mu stays locked if a
void member_lock(bool a) {
  mu.lock();
  if (a) return;
  mu.unlock();
}

// nothing: die never returns
void dies(bool bad) {
  pthread_mutex_lock(&m);
  if (bad) die("bad");
  pthread_mutex_unlock(&m);
}

// case 1 leaves with the lock taken
int by_case(int k) {
  pthread_mutex_lock(&m);
  switch (k) {
    case 0: pthread_mutex_unlock(&m); return 0;
    case 1: return 1;
    default: break;
  }
  pthread_mutex_unlock(&m);
  return 2;
}

// a known limit: the two conditions are the same, so it always closes, but the paths are judged one by one
void linked(bool a) {
  if (a) pthread_mutex_lock(&m);
  if (a) pthread_mutex_unlock(&m);
}

int main(int argc, char** argv) {
  int v = lock_ok(argc) + lock_early(argc) + mem_branch(argc, argc > 2) + mem_goto(argc);
  v += file_loop(argv[0]) + file_throw(argv[0]);
  member_lock(argc > 3);
  dies(argc > 4);
  v += by_case(argc);
  linked(argc > 1);
  return v;
}
