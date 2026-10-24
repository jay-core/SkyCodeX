#pragma once
#include <deque>
#include <string>
#include "../router.hpp"

class Socket {
public:
    void listen(int port);
    bool accept(Request& out);
    void close();
    std::deque<Request> queue;
    std::string sent;
};

void send_response(Socket& s, const Response& r);
void write_all(Socket& s, std::string_view bytes);
