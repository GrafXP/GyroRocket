<?php
declare(strict_types=1);

// Local php -S router: never expose private files or fall back to static API
// source files. Vite serves the game; this server only handles /api/... .
require __DIR__ . '/public/api/index.php';
