#!/bin/sh
set -e

# Wait for PostgreSQL to be available
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
  echo "Waiting for postgres..."
  sleep 2
done

# Run schema.sql to ensure tables exist
psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB" -f /app/src/db/schema.sql || true

# Start the backend
exec "$@" 