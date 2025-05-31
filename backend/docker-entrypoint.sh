#!/bin/sh
set -e

# Function to check if postgres is ready
wait_for_postgres() {
    echo "Waiting for postgres..."
    for i in $(seq 1 30); do
        if nc -z postgres 5432; then
            echo "PostgreSQL is ready!"
            return 0
        fi
        echo "Attempt $i: PostgreSQL not ready yet..."
        sleep 2
    done
    echo "PostgreSQL did not become ready in time"
    return 1
}

# Wait for postgres
wait_for_postgres

# Run schema.sql
echo "Running schema.sql..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -f /app/src/db/schema.sql

# Start the application
echo "Starting application..."
exec "$@" 