"""Domain errors mapped to HTTP responses in main.py."""
from __future__ import annotations


class BankingError(Exception):
    status_code = 400
    code = "banking_error"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class AccountNotFound(BankingError):
    status_code = 404
    code = "account_not_found"


class AccountNotActive(BankingError):
    status_code = 409
    code = "account_not_active"


class InsufficientFunds(BankingError):
    status_code = 422
    code = "insufficient_funds"


class CurrencyMismatch(BankingError):
    status_code = 422
    code = "currency_mismatch"


class InvalidOperation(BankingError):
    status_code = 400
    code = "invalid_operation"


class EmailAlreadyRegistered(BankingError):
    status_code = 409
    code = "email_taken"


class InvalidCredentials(BankingError):
    status_code = 401
    code = "invalid_credentials"


class NotAuthenticated(BankingError):
    status_code = 401
    code = "not_authenticated"
