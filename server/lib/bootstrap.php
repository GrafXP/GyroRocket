<?php
declare(strict_types=1);

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/limits.php';
require_once __DIR__ . '/players.php';

function load_config(): array
{
    // An override is useful for a scratch test DB, never taken from a request.
    $path = getenv('GYRO_CONFIG') ?: dirname(__DIR__) . '/config.php';
    if (!is_file($path)) throw new ApiError(503, 'The community server is not set up yet.');
    $config = require $path;
    if (!is_array($config) || !isset($config['db'], $config['ip_secret'], $config['limits'])
        || !is_string($config['ip_secret']) || !preg_match('/\A[a-fA-F0-9]{64}\z/', $config['ip_secret'])) {
        throw new ApiError(503, 'The community server is not set up yet.');
    }
    foreach (['auth', 'players', 'name', 'delete', 'data'] as $action) {
        $limit = $config['limits'][$action] ?? [];
        foreach (['ip', 'seconds'] as $key) {
            if (!isset($limit[$key]) || !is_int($limit[$key]) || $limit[$key] < 1) throw new ApiError(503, 'The server limits are not set up yet.');
        }
        if ($limit['seconds'] > 86400) throw new ApiError(503, 'Rate-limit windows cannot exceed a day.');
        if (in_array($action, ['name', 'delete', 'data'], true) && !isset($limit['player'])) throw new ApiError(503, 'Player limits are not set up yet.');
        if (isset($limit['player']) && (!is_int($limit['player']) || $limit['player'] < 1)) throw new ApiError(503, 'The server limits are not set up yet.');
    }
    return $config;
}

function dispatch(): never
{
    api_headers();
    check_request();
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'];
    $routes = [
        '/api/health' => ['GET'],
        '/api/players' => ['POST'],
        '/api/players/me' => ['GET', 'PATCH', 'DELETE'],
        '/api/players/me/data' => ['GET'],
    ];
    if (!isset($routes[$path])) throw new ApiError(404, 'No such endpoint.');
    allow_method($method, $routes[$path]);
    // Validate JSON before connecting, including when the server is unavailable.
    $data = in_array($method, ['POST', 'PATCH', 'DELETE'], true) ? read_json() : null;
    $config = load_config();
    $db = connect_db($config['db']);
    if ($path === '/api/health') {
        $version = json_decode(file_get_contents(dirname(__DIR__) . '/data/version.json'), true, 8, JSON_THROW_ON_ERROR);
        respond(['api' => 1, 'sim' => $version['sim'], 'schema' => SCHEMA_VERSION]);
    }
    if ($path === '/api/players') respond(create_player($db, $config, $data), 201);
    // Banning community participation must still permit saving/deleting one's
    // own data. Both remain authenticated and rate limited.
    $player = authenticate($db, $config, $path === '/api/players/me/data' || $method === 'DELETE');
    if ($path === '/api/players/me/data') respond(player_data($db, $config, $player));
    if ($method === 'GET') respond(['player' => public_player($player)]);
    if ($method === 'PATCH') respond(rename_player($db, $config, $player, $data));
    respond(delete_player($db, $config, $player, $data));
}
