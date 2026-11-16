import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def check(got, want):
    assert got == want, f"\n  got:  {got}\n  want: {want}"


def part1():
    rules = ["GET /api/users -> users", "POST /api/users -> users-write", "garbage rule"]
    check(m.route(rules, ["GET /api/users", "POST /api/users", "DELETE /api/users",
                          "get /api/users/", "GET /api/user", "GET /api/users?limit=10"]),
          ["users", "users-write", "404", "users", "404", "users"])


RULES = [
    "GET /api/users -> users",
    "POST /api/users -> users-write",
    "GET /api/users/:id -> user-detail",
    "GET /api/* -> api",
    "* /health -> health",
    "GET /* -> web",
    "GET /api/users -> dup",
]


def part2():
    check(m.route(RULES, ["GET /api/users/42", "GET /api/users/42/cards", "GET /api/users",
                          "GET /index.html", "GET /", "PUT /health", "PUT /api/x",
                          "GET /api", "GET /health"]),
          ["user-detail", "api", "users", "web", "web", "health", "404", "api", "health"])
    check(m.route(["* /a/:x -> p", "GET /a/* -> w"], ["GET /a/b", "GET /a/b/c"]), ["p", "w"])


def part3():
    rules = ["GET /pay -> a:3,b:1", "GET /x -> c"]
    check(m.route(rules, ["GET /pay", "GET /x", "GET /pay", "GET /pay", "GET /pay", "GET /pay"]),
          ["a", "c", "a", "a", "b", "a"])


def part4():
    rules = ["GET /pay -> a:2,b:1", "GET /other -> b"]
    lines = ["GET /pay", "DOWN a", "GET /pay", "GET /pay", "UP a", "GET /pay",
             "DOWN a", "DOWN b", "GET /pay", "GET /other", "UP b", "GET /pay", "GET /other"]
    check(m.route(rules, lines), ["a", "b", "b", "a", "503", "503", "b", "b"])


run([part1, part2, part3, part4][0:1])
