-- MariaDB 10.6+ / MySQL 8. Run in phpMyAdmin on a NEW, empty database.
-- DDL is not transactional. The version is recorded LAST; incomplete installs
-- remain unavailable. The web user needs only SELECT, INSERT, UPDATE, DELETE.
SET NAMES utf8mb4;

CREATE TABLE schema_migrations (
    version INT UNSIGNED NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE players (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    name VARCHAR(16) CHARACTER SET ascii COLLATE ascii_general_ci NULL UNIQUE,
    role ENUM('player', 'trusted') NOT NULL DEFAULT 'player',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    banned BOOLEAN NOT NULL DEFAULT FALSE,
    strikes INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE levels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code CHAR(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    player_id BIGINT UNSIGNED NOT NULL,
    hash CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    name VARCHAR(40) NOT NULL,
    look TINYINT UNSIGNED NOT NULL,
    par DOUBLE NOT NULL,
    route TEXT NULL,
    play MEDIUMTEXT NOT NULL,
    thumbnail TEXT NOT NULL,
    width SMALLINT UNSIGNED NOT NULL,
    height SMALLINT UNSIGNED NOT NULL,
    state ENUM('pending', 'passed', 'failed', 'disputed') NOT NULL DEFAULT 'pending',
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    listed BOOLEAN NOT NULL DEFAULT TRUE,
    replacement_id BIGINT UNSIGNED NULL,
    plays INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (replacement_id) REFERENCES levels(id) ON DELETE SET NULL,
    INDEX browse (state, hidden, listed, created_at),
    INDEX author (player_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE scores (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    player_id BIGINT UNSIGNED NOT NULL,
    level_id BIGINT UNSIGNED NULL,
    hash CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sim INT UNSIGNED NOT NULL,
    ticks INT UNSIGNED NOT NULL,
    crystals INT UNSIGNED NOT NULL,
    restarts INT UNSIGNED NOT NULL,
    replay MEDIUMTEXT NOT NULL,
    fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    state ENUM('pending', 'passed', 'failed', 'disputed') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
    UNIQUE best (player_id, hash, sim),
    INDEX leaderboard (hash, sim, state, ticks)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    score_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    expires_at DATETIME NOT NULL,
    report TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reported_at DATETIME NULL,
    FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE task (score_id, player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ratings (
    level_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    quality TINYINT UNSIGNED NOT NULL CHECK (quality BETWEEN 1 AND 5),
    difficulty TINYINT UNSIGNED NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    fun TINYINT UNSIGNED NOT NULL CHECK (fun BETWEEN 1 AND 5),
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (level_id, player_id),
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE plays (
    level_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (level_id, player_id),
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reports (
    level_id BIGINT UNSIGNED NOT NULL,
    player_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(200) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (level_id, player_id),
    FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hits (
    action VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    window_start BIGINT UNSIGNED NOT NULL,
    count INT UNSIGNED NOT NULL DEFAULT 1,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (action, subject, window_start),
    INDEX expiry (expires_at)
) ENGINE=InnoDB;

INSERT INTO schema_migrations (version) VALUES (1);
