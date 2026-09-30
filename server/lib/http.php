<?php
declare(strict_types=1);

const MAX_BODY = 131072;

final class ApiError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

function api_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header_remove('X-Powered-By');
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    exit;
}

// Check size BEFORE opening php://input, including on unsupported routes.
function check_request(): void
{
    if (isset($_SERVER['CONTENT_LENGTH'])) {
        $length = $_SERVER['CONTENT_LENGTH'];
        if (!ctype_digit($length) || strlen($length) > 9 || (int)$length > MAX_BODY) {
            throw new ApiError(413, 'The request is too large.');
        }
    }
    if (!empty($_SERVER['QUERY_STRING'])) {
        throw new ApiError(400, 'This endpoint does not accept query parameters.');
    }
    // No cookies or CORS. Also reject cross-site writes from browser fetches.
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site'
        && !in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'OPTIONS'], true)) {
        throw new ApiError(403, 'Use this site to make changes.');
    }
}

function read_json(): stdClass
{
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        throw new ApiError(415, 'Send a JSON object.');
    }
    $input = fopen('php://input', 'rb');
    if ($input === false) throw new ApiError(400, 'The request could not be read.');
    $text = stream_get_contents($input, MAX_BODY + 1);
    fclose($input);
    if ($text === false) throw new ApiError(400, 'The request could not be read.');
    if (strlen($text) > MAX_BODY) throw new ApiError(413, 'The request is too large.');
    try {
        $data = json_decode($text, false, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiError(400, 'The JSON is malformed or too deeply nested.');
    }
    if (!$data instanceof stdClass) throw new ApiError(400, 'Send a JSON object.');
    return $data;
}

function fields(stdClass $data, array $allowed, array $required = []): void
{
    foreach (array_keys(get_object_vars($data)) as $key) {
        if (!in_array($key, $allowed, true)) throw new ApiError(400, 'An unknown field was sent.');
    }
    foreach ($required as $key) {
        if (!property_exists($data, $key)) throw new ApiError(400, 'A required field is missing.');
    }
}

function allow_method(string $method, array $allowed): void
{
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        throw new ApiError(405, 'This method is not allowed.');
    }
}
