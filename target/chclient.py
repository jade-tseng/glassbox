"""Shared ClickHouse client for the target (local Docker, see docker-compose.yml)."""

import os

import clickhouse_connect


def client(database: str = "default"):
    return clickhouse_connect.get_client(
        host=os.environ.get("CH_HOST", "127.0.0.1"),
        port=int(os.environ.get("CH_PORT", "8123")),
        username=os.environ.get("CH_USER", "glassbox"),
        password=os.environ.get("CH_PASSWORD", "glassbox"),
        database=database,
        settings={"max_threads": 4},
    )
