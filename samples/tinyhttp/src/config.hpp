#pragma once
#include <string>

struct Config { int port = 8080; std::string root = "."; };

Config load_config();
