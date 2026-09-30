<?php
declare(strict_types=1);

// Integration-test access only. No route loads this file or takes SQL from HTTP.
$config = require getenv('GYRO_TEST_CONFIG');
$db = new PDO($config['db']['dsn'], $config['db']['user'], $config['db']['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
if (!preg_match('/\Agyro_test(?:_|\z)/', $db->query('SELECT DATABASE()')->fetchColumn())) {
    throw new RuntimeException('Integration DB must have a gyro_test name. Never use production.');
}
$db->exec("SET time_zone = '+00:00'");
$input = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
if (($input['op'] ?? '') === 'limits') {
    echo json_encode($config['limits'], JSON_THROW_ON_ERROR);
} else {
    $statement = $db->prepare($input['sql']);
    $statement->execute($input['args'] ?? []);
    echo json_encode($statement->columnCount() ? $statement->fetchAll() : [], JSON_THROW_ON_ERROR);
}
