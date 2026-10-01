-- Creates the isolated test database and lets the app user create shadow databases
-- (required by `prisma migrate dev`). Runs only on first container start.
CREATE DATABASE IF NOT EXISTS jobtrack_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON *.* TO 'jobtrack'@'%';
FLUSH PRIVILEGES;
