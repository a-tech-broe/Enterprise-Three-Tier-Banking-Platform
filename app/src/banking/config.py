"""Application settings.

Database credentials are resolved in priority order:
  1. DATABASE_URL (used directly — local dev / tests).
  2. DB_SECRET_ARN (fetched from AWS Secrets Manager — the RDS secret Terraform
     creates) combined with DB_NAME to build the connection URL.
"""
from __future__ import annotations

import json
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    app_name: str = "banking-platform-api"
    environment: str = Field(default="dev", alias="ENVIRONMENT")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8081, alias="PORT")
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    db_secret_arn: str | None = Field(default=None, alias="DB_SECRET_ARN")
    db_name: str = Field(default="banking", alias="DB_NAME")
    aws_region: str = Field(default="us-east-1", alias="AWS_REGION")

    # Comma-separated allowed origins for the web UI. Default "*" for the demo.
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    # Auth. jwt_secret MUST be set (and shared across instances) in real
    # deployments; the default is for local dev/tests only. Tokens signed with a
    # per-process random secret would be rejected across a multi-instance ALB.
    jwt_secret: str = Field(
        default="dev-insecure-change-me-set-JWT_SECRET-in-prod", alias="JWT_SECRET"
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=720, alias="JWT_EXPIRE_MINUTES")
    reset_token_expire_minutes: int = Field(default=30, alias="RESET_TOKEN_EXPIRE_MINUTES")

    # Comma-separated emails treated as admins (in addition to any user whose
    # stored role is 'admin'). Lets you grant back-office access without a DB edit.
    admin_emails: str = Field(default="", alias="ADMIN_EMAILS")

    # Demo convenience: return the password-reset token in the forgot-password
    # response. Once email delivery is live and out of the SES sandbox, set this
    # false so the token is only ever emailed.
    expose_reset_token: bool = Field(default=True, alias="EXPOSE_RESET_TOKEN")

    # Email delivery (Amazon SES). email_from empty => email disabled. app_base_url
    # is the public origin used to build links in emails (e.g. https://skybroe.com).
    email_from: str = Field(default="", alias="EMAIL_FROM")
    app_base_url: str = Field(default="", alias="APP_BASE_URL")

    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolve_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        if self.db_secret_arn:
            return _url_from_secret(self.db_secret_arn, self.aws_region, self.db_name)
        # Safe default for local runs without any DB configured.
        return "sqlite+pysqlite:///:memory:"


def _url_from_secret(secret_arn: str, region: str, db_name: str) -> str:
    import boto3  # imported lazily so tests never need AWS

    client = boto3.client("secretsmanager", region_name=region)
    secret = json.loads(client.get_secret_value(SecretId=secret_arn)["SecretString"])
    user = secret["username"]
    password = secret["password"]
    host = secret["host"]
    port = secret.get("port", 5432)
    name = secret.get("dbname", db_name)
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
