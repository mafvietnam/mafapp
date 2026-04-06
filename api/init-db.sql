-- Create MAF database and user (runs on first postgres startup)
CREATE DATABASE maf;
CREATE USER maf_user WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE maf TO maf_user;
\c maf
GRANT ALL ON SCHEMA public TO maf_user;
