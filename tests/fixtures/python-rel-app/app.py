"""Fixture app exercising relative import forms (R1A, R1B, R1C, R1G, R1J)."""
import os

from . import actions
from . import discovery, search
from .actions import run_action
from .actions import run_action as action_runner
from . import config as cfg
from abslib.util import load


def boot():
    return run_action(), load(), os.environ.get("X", "")
