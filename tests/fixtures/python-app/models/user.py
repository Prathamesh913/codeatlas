"""User model."""
from dataclasses import dataclass


@dataclass
class User:
    id: int
    email: str
    name: str
    is_active: bool = True

    def deactivate(self):
        self.is_active = False
