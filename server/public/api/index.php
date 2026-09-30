<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Deployment rewrites this expression relative to the website root.
$serverRoot = /* deploy:server-root */ dirname(__DIR__, 2);
try {
    require $serverRoot . '/lib/bootstrap.php';
    dispatch();
} catch (Throwable $e) {
    header_remove('X-Powered-By');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    if ($e instanceof ApiError) {
        respond(['error' => $e->getMessage()], $e->status);
    }
    // Detailed diagnostics go only to the host's error log.
    error_log('Gyro API: ' . $e->getMessage());
    http_response_code(503);
    echo '{"error":"The community server is unavailable. Try again later."}';
}
