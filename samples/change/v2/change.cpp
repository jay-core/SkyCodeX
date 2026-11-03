// What a change does: the version after. Against samples/change/v1: start no longer logs the request, handle
// validates it first and routes only a valid one; every function moved down a line, which changes nothing.
#include <string>
struct Request { std::string path; int size; };


void log_request(const Request &) {}
bool validate(const Request &r) { return !r.path.empty(); }
bool check_size(const Request &r) { return r.size < 4096; }
void route(const Request &) {}
void send_response(int) {}
void accept(Request &r) { r.path = "/"; r.size = 10; }

void handle(Request &r) {
  if (validate(r) && check_size(r)) {
    route(r);
  }
  send_response(200);
}

void start() {
  Request r;
  accept(r);
  handle(r);
}

int main() { start(); }
