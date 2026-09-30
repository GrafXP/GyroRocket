<?php
declare(strict_types=1);

// Copy to config.php on the server. Never upload or commit a real config.
return [
    'db' => [
        'dsn' => 'mysql:host=127.0.0.1;dbname=gyrorocket;charset=utf8mb4',
        'user' => 'gyrorocket',
        'password' => '',
    ],
    // Generate once: php -r 'echo bin2hex(random_bytes(32)), "\n";'
    'ip_secret' => 'REPLACE_WITH_64_RANDOM_HEX_CHARACTERS',
    // Counts in a fixed window, per IP and (where applicable) per player.
    'limits' => [
        'auth' => ['ip' => 120, 'seconds' => 60],
        'players' => ['ip' => 20, 'seconds' => 86400],
        'name' => ['ip' => 40, 'player' => 10, 'seconds' => 3600],
        'delete' => ['ip' => 10, 'player' => 3, 'seconds' => 3600],
        'data' => ['ip' => 20, 'player' => 5, 'seconds' => 3600],
    ],
];
