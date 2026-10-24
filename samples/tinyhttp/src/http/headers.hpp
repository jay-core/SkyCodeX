#pragma once
#include <map>
#include <string>
#include <string_view>

using Headers = std::map<std::string, std::string>;

Headers parse_headers(std::string_view raw);
bool keep_alive(const Headers& h);
