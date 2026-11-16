import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)
f = m.parse_accept_language


def part1():
    assert f("en-US, fr-CA, fr-FR", ["fr-FR", "en-US"]) == ["en-US", "fr-FR"]
    assert f("fr-CA, fr-FR", ["en-US", "fr-FR"]) == ["fr-FR"]
    assert f("en-US", ["en-US", "fr-CA"]) == ["en-US"]
    assert f("ja-JP", ["en-US"]) == []
    assert f("  EN-us ,fr-FR", ["en-US", "fr-FR"]) == ["en-US", "fr-FR"]


def part2():
    assert f("en", ["en-US", "fr-CA", "fr-FR"]) == ["en-US"]
    assert f("fr", ["en-US", "fr-CA", "fr-FR"]) == ["fr-CA", "fr-FR"]
    assert f("fr-FR, fr", ["en-US", "fr-CA", "fr-FR"]) == ["fr-FR", "fr-CA"]
    assert f("en-US, fr", ["fr-CA", "en-US", "fr-FR"]) == ["en-US", "fr-CA", "fr-FR"]
    assert f("en", ["eng-XX", "en-GB"]) == ["en-GB"]


def part3():
    assert f("en-US, *", ["en-US", "fr-CA", "fr-FR"]) == ["en-US", "fr-CA", "fr-FR"]
    assert f("fr-FR, fr, *", ["en-US", "fr-CA", "fr-FR"]) == ["fr-FR", "fr-CA", "en-US"]
    assert f("*", ["a-A", "b-B"]) == ["a-A", "b-B"]


def part4():
    assert f("fr-FR;q=1, fr-CA;q=0, fr;q=0.5", ["fr-FR", "fr-CA", "fr-BG"]) == ["fr-FR", "fr-BG"]
    assert f("fr-FR;q=1, fr-CA;q=0, *;q=0.5", ["fr-FR", "fr-CA", "fr-BG", "en-US"]) == ["fr-FR", "fr-BG", "en-US"]
    assert f("fr;q=0.2, en-US;q=0.9", ["fr-FR", "en-US"]) == ["en-US", "fr-FR"]
    assert f("fr-FR;q=0.5, fr-CA", ["fr-FR", "fr-CA"]) == ["fr-CA", "fr-FR"]
    assert f("*;q=0", ["en-US"]) == []


run([part1, part2, part3, part4])
