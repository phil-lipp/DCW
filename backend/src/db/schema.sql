-- Create containers table
CREATE TABLE IF NOT EXISTS containers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    current_version VARCHAR(255),
    latest_version VARCHAR(255),
    latest BOOLEAN DEFAULT false,
    new BOOLEAN DEFAULT false,
    error BOOLEAN DEFAULT false,
    error_message TEXT,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create update_check_history table
CREATE TABLE IF NOT EXISTS update_check_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_containers INTEGER NOT NULL,
    up_to_date INTEGER NOT NULL,
    updates_available INTEGER NOT NULL,
    errors INTEGER NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_containers_host ON containers(host);
CREATE INDEX IF NOT EXISTS idx_containers_name ON containers(name);
CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(latest, new, error);
CREATE INDEX IF NOT EXISTS idx_update_check_history_timestamp ON update_check_history(timestamp);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_containers_updated_at
    BEFORE UPDATE ON containers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 