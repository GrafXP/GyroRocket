<?php
declare(strict_types=1);

// The address is never stored, and forwarded headers cannot choose a new bucket.
// A different HMAC each UTC day prevents linking addresses across days.
function ip_hash(array $config): string
{
    return hash_hmac('sha256', gmdate('Y-m-d') . "\0" . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $config['ip_secret']);
}

function rate_limit(PDO $db, array $config, string $action, ?int $player = null): void
{
    $limit = $config['limits'][$action];
    $now = time();
    $seconds = $limit['seconds'];
    $start = intdiv($now, $seconds) * $seconds;
    $end = $start + $seconds;
    $buckets = [['i:' . ip_hash($config), $limit['ip'], min($end, strtotime('tomorrow UTC'))]];
    if ($player !== null && isset($limit['player'])) $buckets[] = ['p:' . $player, $limit['player'], $end];
    $exceeded = false;
    $db->beginTransaction();
    try {
        // Bounded opportunistic cleanup; no cron, and no pruning a live bucket.
        $db->exec('DELETE FROM hits WHERE expires_at <= UTC_TIMESTAMP() LIMIT 200');
        foreach ($buckets as [$subject, $max, $expires]) {
            query($db, 'INSERT INTO hits (action, subject, window_start, expires_at) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE count = count + 1', [$action, $subject, $start, gmdate('Y-m-d H:i:s', $expires)]);
            $count = query($db, 'SELECT count FROM hits WHERE action = ? AND subject = ? AND window_start = ?', [$action, $subject, $start])->fetchColumn();
            if ((int)$count > $max) $exceeded = true;
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    if ($exceeded) {
        header('Retry-After: ' . ($end - $now));
        throw new ApiError(429, 'Too many requests. Try again later.');
    }
}
