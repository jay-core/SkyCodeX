// Old CGI entry point, no longer built into tinyhttp.
#include <cstdio>

int cgi_main() {
    std::puts("Content-Type: text/plain\r\n\r\nhello");
    return 0;
}
