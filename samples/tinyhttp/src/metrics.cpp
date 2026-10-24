#include "metrics.hpp"
#include <chrono>
#include <cstdio>
#include <thread>

static char g_report[16384];

void Metrics::record(const std::string& path, int status) {
    counters_[path] += 1;
    if (status >= 500) counters_["errors"] += 1;
}

void Metrics::flush() {
    int n = 0;
    for (const auto& [path, count] : counters_)
        n += std::snprintf(g_report + n, sizeof g_report - n, "%s %d\n", path.c_str(), count);
    std::snprintf(log_buffer_, sizeof log_buffer_, "%d bytes", n);
}

void Metrics::run(const std::atomic<bool>& running) {
    while (running) {
        flush();
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}
