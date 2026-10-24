#pragma once
#include <atomic>
#include <map>
#include <string>

class Metrics {
public:
    void record(const std::string& path, int status);
    void run(const std::atomic<bool>& running);
    void flush();
private:
    std::map<std::string, int> counters_;
    char log_buffer_[8192] = {};
};
