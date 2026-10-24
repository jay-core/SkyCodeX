#include "config.hpp"
#include "server.hpp"

int main() {
    Config config = load_config();
    Server server(config);
    server.start();
    server.stop();
    return 0;
}
