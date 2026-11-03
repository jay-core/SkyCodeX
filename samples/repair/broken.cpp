// Three errors on purpose, for the repair engine's view (the `repair` smoke scenario): a name missing its std::, a
// missing ), and a misspelt call. Each gets a fix clangd confirms, applied only on ✓.
#include <string>
struct Request { string path; int size; };


void log_request(const Request &) {}
bool validate(const Request &r) { return !r.path.empty(); }
bool check_size(const Request &r) { return r.size < 4096; }
void route(const Request &) {}
void send_response(int) {}
void accept(Request &r) { r.path = "/"; r.size = 10; }

void handle(Request &r) {
  if (validate(r) && check_size(r) {
    rout(r);
  }
  send_response(200);
}

void start() {
  Request r;
  accept(r);
  handle(r);
}

int main() { start(); }
