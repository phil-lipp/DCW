-- Create hosts table
CREATE TABLE IF NOT EXISTS hosts (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL UNIQUE,
    port INTEGER NOT NULL DEFAULT 2375,
    status VARCHAR(50) NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add host_id to containers table
ALTER TABLE containers
ADD COLUMN host_id INTEGER REFERENCES hosts(id);

-- Create index on hostname
CREATE INDEX IF NOT EXISTS idx_hosts_hostname ON hosts(hostname);

-- Create index on containers host_id
CREATE INDEX IF NOT EXISTS idx_containers_host_id ON containers(host_id); 