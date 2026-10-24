#include "router.hpp"
#include "util/strings.hpp"

static Response not_found(const Request&, const Headers&) {
    return Response{404, "not found"};
}

bool match_path(std::string_view pattern, std::string_view path) {
    auto p = split(pattern, "/");
    auto q = split(path, "/");
    if (p.size() != q.size()) return false;
    for (size_t i = 0; i < p.size(); ++i)
        if (p[i] != "*" && p[i] != q[i]) return false;
    return true;
}

Handler route(std::string_view path, const Routes& routes) {
    for (const auto& r : routes)
        if (match_path(r.pattern, path))
            return r.handler;
    return not_found;
}
