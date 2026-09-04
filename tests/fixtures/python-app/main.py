"""Fixture: A minimal Python application for testing evidence collection."""
import os
import sys

from models.user import User
from services.auth_service import AuthService
from utils.helpers import format_date, validate_email


API_URL = os.environ.get("APP_API_URL", "https://api.example.com")
DEBUG = os.environ.get("APP_DEBUG", "false")


class Application:
    def __init__(self):
        self.auth = AuthService()
        self.user = None

    def login(self, email, password):
        if not validate_email(email):
            raise ValueError("Invalid email")
        self.user = self.auth.authenticate(email, password)
        return self.user

    def get_current_user(self):
        return self.user


def create_app():
    app = Application()
    return app


if __name__ == "__main__":
    app = create_app()
    print(f"Starting app with API: {API_URL}")
