#include "headers.hpp"
#include "../util/strings.hpp"

Headers parse_headers(std::string_view raw) {
    Headers out;
    for (auto line : split(raw, "\r\n")) {
        auto colon = line.find(':');
        if (colon == sv::npos) continue;
        out.emplace(std::string(trim(line.substr(0, colon))),
                    std::string(trim(line.substr(colon + 1))));
    }
    return out;
}

bool keep_alive(const Headers& h) {
    auto it = h.find("Connection");
    return it != h.end() && to_lower(it->second) == "keep-alive";
}
