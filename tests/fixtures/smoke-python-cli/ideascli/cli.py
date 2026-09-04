"""Idea CLI."""
import sys
from .store import add_idea, list_ideas

def main(argv=None):
    argv = argv or sys.argv[1:]
    if argv and argv[0] == "add":
        add_idea(" ".join(argv[1:]))
        print("Idea added")
    else:
        for idea in list_ideas():
            print(idea)
