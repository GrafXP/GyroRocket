<?php
declare(strict_types=1);

const SCHEMA_VERSION = 1;

function connect_db(array $config): PDO
{
    $db = new PDO($config['dsn'], $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_STRINGIFY_FETCHES => false,
        PDO::ATTR_TIMEOUT => 3,
    ]);
    $db->exec("SET time_zone = '+00:00'");
    $db->exec('SET NAMES utf8mb4');
    try {
        $version = (int)$db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn();
    } catch (PDOException) {
        throw new ApiError(503, 'The server is being updated. Try again later.');
    }
    if ($version !== SCHEMA_VERSION) throw new ApiError(503, 'The server is being updated. Try again later.');
    return $db;
}

function query(PDO $db, string $sql, array $args = []): PDOStatement
{
    $statement = $db->prepare($sql);
    $statement->execute($args);
    return $statement;
}
