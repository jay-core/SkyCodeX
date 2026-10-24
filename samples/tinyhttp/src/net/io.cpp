#include "io.hpp"

void Socket::listen(int port) {
    queue.push_back({"/api/users", "Host: local\r\nConnection: keep-alive"});
    queue.push_back({"/missing", "Host: local"});
    (void)port;
}

bool Socket::accept(Request& out) {
    if (queue.empty()) return false;
    out = queue.front();
    queue.pop_front();
    return true;
}

void Socket::close() { queue.clear(); }

void write_all(Socket& s, std::string_view bytes) {
    size_t written = 0;
    while (written < bytes.size()) {
        size_t chunk = bytes.size() - written < 512 ? bytes.size() - written : 512;
        s.sent.append(bytes.substr(written, chunk));
        written += chunk;
    }
}

void send_response(Socket& s, const Response& r) {
    std::string head = "HTTP/1.1 " + std::to_string(r.status) + "\r\n\r\n";
    write_all(s, head);
    write_all(s, r.body);
}
