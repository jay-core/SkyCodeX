#pragma once
#include <atomic>
#include "config.hpp"
#include "metrics.hpp"
#include "net/io.hpp"
#include "router.hpp"

class Server {
public:
    explicit Server(const Config& c);
    void start();
    Response handle(const Request& req);
    void stop();
private:
    Config config_;
    Socket socket_;
    Routes routes_;
    Metrics metrics_;
    std::atomic<bool> running_{false};
};
