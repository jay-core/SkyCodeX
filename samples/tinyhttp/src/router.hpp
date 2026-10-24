#pragma once
#include <functional>
#include <string>
#include <string_view>
#include <vector>
#include "http/headers.hpp"

struct Request { std::string path; std::string raw; };
struct Response { int status = 200; std::string body; };
using Handler = std::function<Response(const Request&, const Headers&)>;
struct Route { std::string pattern; Handler handler; };
using Routes = std::vector<Route>;

Handler route(std::string_view path, const Routes& routes);
bool match_path(std::string_view pattern, std::string_view path);
