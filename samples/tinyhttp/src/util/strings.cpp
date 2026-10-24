#include "strings.hpp"
#include <cctype>

static bool is_space(char c) {
    return c == ' ' || c == '\t' || c == '\r' || c == '\n';
}

Parts split(sv s, sv delim) {
    Parts out;
    size_t at = 0, nx;
    while ((nx = s.find(delim, at)) != sv::npos) {
        out.push_back(s.substr(at, nx - at));
        at = nx + delim.size();
    }
    out.push_back(s.substr(at));
    return out;
}

sv trim(sv s) {
    while (!s.empty() && is_space(s.front()))
        s.remove_prefix(1);
    while (!s.empty() && is_space(s.back()))
        s.remove_suffix(1);
    return s;
}

std::string to_lower(sv s) {
    std::string out(s);
    for (char& c : out) c = static_cast<char>(std::tolower(c));
    return out;
}
