-- Create update check history table
CREATE TABLE IF NOT EXISTS update_check_history (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    total_containers INTEGER NOT NULL DEFAULT 0,
    up_to_date INTEGER NOT NULL DEFAULT 0,
    updates_available INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 