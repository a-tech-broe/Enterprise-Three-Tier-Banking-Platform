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
