// What a change does: the version before. samples/change/v2 is the version after; src/tests/change.test.ts checks
// what the analyser says changed between them.
#include <string>
struct Request { std::string path; int size; };

void log_request(const Request &) {}
bool validate(const Request &r) { return !r.path.empty(); }
bool check_size(const Request &r) { return r.size < 4096; }
void route(const Request &) {}
void send_response(int) {}
void accept(Request &r) { r.path = "/"; r.size = 10; }

void handle(Request &r) {
  route(r);
  send_response(200);
}

void start() {
  Request r;
  log_request(r);
  accept(r);
  handle(r);
}

int main() { start(); }
