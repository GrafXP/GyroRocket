<?php
declare(strict_types=1);

function authenticate(PDO $db, array $config, bool $allowBanned = false): array
{
    rate_limit($db, $config, 'auth');
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/\ABearer ([a-fA-F0-9]{64})\z/', $header, $match)) {
        header('WWW-Authenticate: Bearer');
        throw new ApiError(401, 'Use your player code to sign in.');
    }
    $player = query($db, 'SELECT * FROM players WHERE token_hash = ?', [hash('sha256', strtolower($match[1]))])->fetch();
    if (!$player) throw new ApiError(401, 'This player code is not recognised.');
    if ($player['banned'] && !$allowBanned) throw new ApiError(403, 'This player cannot use the community.');
    // Avoid a database write on every profile read.
    query($db, 'UPDATE players SET last_seen_at = UTC_TIMESTAMP() WHERE id = ? AND last_seen_at < UTC_TIMESTAMP() - INTERVAL 1 HOUR', [$player['id']]);
    return $player;
}

function public_player(array $player): array
{
    return [
        'id' => (string)$player['id'],
        'name' => $player['name'],
        'role' => $player['role'],
        'created' => str_replace(' ', 'T', $player['created_at']) . 'Z',
    ];
}

function create_player(PDO $db, array $config, stdClass $data): array
{
    fields($data, []);
    rate_limit($db, $config, 'players');
    $token = bin2hex(random_bytes(32));
    query($db, 'INSERT INTO players (token_hash) VALUES (?)', [hash('sha256', $token)]);
    $player = query($db, 'SELECT * FROM players WHERE id = ?', [$db->lastInsertId()])->fetch();
    return ['token' => $token, 'player' => public_player($player)];
}

function rename_player(PDO $db, array $config, array $player, stdClass $data): array
{
    fields($data, ['name'], ['name']);
    rate_limit($db, $config, 'name', (int)$player['id']);
    if (!is_string($data->name)) throw new ApiError(400, 'A name must be text.');
    $name = trim($data->name, ' ');
    if (!preg_match('/\A[A-Za-z0-9 _-]{3,16}\z/', $name) || !preg_match('/[A-Za-z0-9]/', $name)) {
        throw new ApiError(400, 'Use 3–16 letters, digits, spaces, - or _ for your name.');
    }
    try {
        query($db, 'UPDATE players SET name = ? WHERE id = ?', [$name, $player['id']]);
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? null) === 1062) throw new ApiError(409, 'That name is already taken.');
        throw $e;
    }
    $player['name'] = $name;
    return ['player' => public_player($player)];
}

function player_data(PDO $db, array $config, array $player): array
{
    rate_limit($db, $config, 'data', (int)$player['id']);
    // Explicit columns: never export token hashes, IP buckets or another player's
    // data. Reports/checks on a deleted level also disappear via foreign keys.
    $db->beginTransaction();
    try {
        $data = ['player' => public_player($player) + [
            'lastSeen' => str_replace(' ', 'T', $player['last_seen_at']) . 'Z',
            'banned' => (bool)$player['banned'], 'strikes' => (int)$player['strikes'],
        ]];
        $data['levels'] = query($db, 'SELECT id, code, hash, name, look, par, route, play, state, hidden, listed, replacement_id, plays, created_at FROM levels WHERE player_id = ? ORDER BY id', [$player['id']])->fetchAll();
        $data['scores'] = query($db, 'SELECT id, level_id, hash, sim, ticks, crystals, restarts, replay, fingerprint, state, created_at FROM scores WHERE player_id = ? ORDER BY id', [$player['id']])->fetchAll();
        $data['ratings'] = query($db, 'SELECT level_id, quality, difficulty, fun, updated_at FROM ratings WHERE player_id = ? ORDER BY level_id', [$player['id']])->fetchAll();
        $data['plays'] = query($db, 'SELECT level_id, created_at FROM plays WHERE player_id = ? ORDER BY level_id', [$player['id']])->fetchAll();
        $data['reports'] = query($db, 'SELECT level_id, reason, created_at FROM reports WHERE player_id = ? ORDER BY level_id', [$player['id']])->fetchAll();
        $data['checks'] = query($db, 'SELECT id, score_id, expires_at, report, created_at, reported_at FROM checks WHERE player_id = ? ORDER BY id', [$player['id']])->fetchAll();
        $db->commit();
        return $data;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function delete_player(PDO $db, array $config, array $player, stdClass $data): array
{
    fields($data, []);
    rate_limit($db, $config, 'delete', (int)$player['id']);
    $db->beginTransaction();
    try {
        // All owned content and references to it cascade in the same transaction.
        query($db, 'DELETE FROM players WHERE id = ?', [$player['id']]);
        query($db, 'DELETE FROM hits WHERE subject = ?', ['p:' . $player['id']]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    return ['forgotten' => true];
}
