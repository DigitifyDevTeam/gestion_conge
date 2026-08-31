<?php
/**
 * PHP reverse proxy to Django (Gunicorn on 127.0.0.1:8001).
 * Use when Nginx /api/ proxy is not available (no root / Virtualmin UI).
 * Production frontend: VITE_API_BASE_URL=/api-proxy.php
 */
declare(strict_types=1);

$backendBase = getenv('DJANGO_BACKEND_URL') ?: 'http://127.0.0.1:8001/api';
$prefix = '/api-proxy.php';

$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (strpos($uriPath, $prefix) !== 0) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['detail' => 'Not found']);
    exit;
}

$apiPath = substr($uriPath, strlen($prefix));
if ($apiPath === '' || $apiPath === false) {
    $apiPath = '/';
}

$url = rtrim($backendBase, '/') . $apiPath;
$query = $_SERVER['QUERY_STRING'] ?? '';
if ($query !== '') {
    $url .= '?' . $query;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$forwardHeaders = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        $lower = strtolower($name);
        if (in_array($lower, ['host', 'connection', 'content-length'], true)) {
            continue;
        }
        $forwardHeaders[] = $name . ': ' . $value;
    }
}

$body = null;
if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
    $body = file_get_contents('php://input');
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_TIMEOUT => 120,
]);

if ($method === 'HEAD') {
    curl_setopt($ch, CURLOPT_NOBODY, true);
}

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['detail' => 'Backend unavailable']);
    curl_close($ch);
    exit;
}

$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

http_response_code($status);

$allowedResponseHeaders = [
    'content-type',
    'content-length',
    'cache-control',
    'etag',
    'last-modified',
];

foreach (explode("\r\n", $rawHeaders) as $line) {
    if (strpos($line, ':') === false) {
        continue;
    }
    [$name, $value] = explode(':', $line, 2);
    $lower = strtolower(trim($name));
    if (in_array($lower, $allowedResponseHeaders, true)) {
        header(trim($name) . ': ' . trim($value), $lower === 'content-type');
    }
}

echo $body;
