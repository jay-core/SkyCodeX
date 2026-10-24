#include "server.hpp"
#include <thread>
#include "http/headers.hpp"

Server::Server(const Config& c) : config_(c) {
    routes_.push_back({"/api/*", [](const Request& r, const Headers&) {
        return Response{200, "ok " + r.path};
    }});
}

void Server::start() {
    socket_.listen(config_.port);
    running_ = true;
    std::thread flusher([this] { metrics_.run(running_); });
    Request req;
    while (running_ && socket_.accept(req)) {
        handle(req);
    }
    running_ = false;
    flusher.join();
}

// Handles one client request end-to-end.
Response Server::handle(const Request& req) {
    auto headers = parse_headers(req.raw);
    if (headers.empty())
        return Response{400, "bad request"};
    auto handler = route(req.path, routes_);
    Response res = handler(req, headers);
    send_response(socket_, res);
    metrics_.record(req.path, res.status);
    if (!keep_alive(headers))
        socket_.close();
    return res;
}

void Server::stop() {
    running_ = false;
    socket_.close();
}
