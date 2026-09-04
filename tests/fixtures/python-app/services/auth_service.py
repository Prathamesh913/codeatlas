"""Authentication service."""
import requests

from models.user import User


class AuthService:
    def __init__(self):
        self.base_url = "https://api.example.com"

    def authenticate(self, email, password):
        # Placeholder
        return User(id=1, email=email, name="Test User")

    def logout(self):
        pass
