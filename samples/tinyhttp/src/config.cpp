#include "config.hpp"
#include <cstdlib>

static const char* read_env(const char* name) {
    const char* v = std::getenv(name);
    return v ? v : "";
}

Config load_config() {
    Config c;
    static const char* keys[4] = {"TINY_PORT", "TINY_ROOT", "TINY_LOG", "TINY_MODE"};
    for (int i = 0; i < 4; ++i) {
        const char* v = read_env(keys[i]);
        if (i == 0 && *v) c.port = std::atoi(v);
    }
    return c;
}
