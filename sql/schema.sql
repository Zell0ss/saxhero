CREATE DATABASE IF NOT EXISTS saxhero_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Note: DB user is managed externally (josem has ALL PRIVILEGES on seb01)

USE saxhero_db;

CREATE TABLE IF NOT EXISTS songs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  bpm           SMALLINT NOT NULL DEFAULT 100,
  beats_per_bar TINYINT  NOT NULL DEFAULT 4,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS song_events (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  song_id        INT NOT NULL,
  position       INT NOT NULL,
  kind           ENUM('note','rest') NOT NULL,
  pitch          CHAR(1) NULL,
  accidental     ENUM('sharp','flat') NULL,
  octave         TINYINT NULL,
  duration_beats DECIMAL(5,3) NOT NULL DEFAULT 1,
  CONSTRAINT fk_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  UNIQUE KEY uq_song_position (song_id, position)
);
