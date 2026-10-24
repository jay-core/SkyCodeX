#pragma once
#include <string>
#include <string_view>
#include <vector>

using sv = std::string_view;
using Parts = std::vector<sv>;

Parts split(sv s, sv delim);
sv trim(sv s);
std::string to_lower(sv s);
