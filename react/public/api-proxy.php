<?php
/**
 * PHP reverse proxy to Django (Gunicorn on 127.0.0.1:8001).
 * Use when Nginx /api/ proxy is not available (no root / Virtualmin UI).
 * Production frontend: VITE_API_BASE_URL=/api-proxy.php
 *
 * Important: php://input is empty for multipart/form-data (PHP consumes it).
 * In that case we rebuild the multipart body from $_POST + $_FILES.
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
$contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');

/**
 * @param array<string, mixed> $post
 * @param array<string, mixed> $files
 */
function build_multipart_body(array $post, array $files, string $boundary): string
{
    $body = '';

    $appendField = static function (string $name, string $value) use (&$body, $boundary): void {
        $body .= "--{$boundary}\r\n";
        $body .= 'Content-Disposition: form-data; name="' . $name . "\"\r\n\r\n";
        $body .= $value . "\r\n";
    };

    $walkPost = static function ($data, string $prefix = '') use (&$walkPost, $appendField): void {
        if (!is_array($data)) {
            $appendField($prefix, (string) $data);
            return;
        }
        foreach ($data as $key => $value) {
            $name = $prefix === '' ? (string) $key : $prefix . '[' . $key . ']';
            if (is_array($value)) {
                $walkPost($value, $name);
            } else {
                $appendField($name, (string) $value);
            }
        }
    };
    $walkPost($post);

    foreach ($files as $field => $file) {
        if (!is_array($file) || !isset($file['tmp_name'])) {
            continue;
        }
        // Single file
        if (!is_array($file['tmp_name'])) {
            if (!is_uploaded_file($file['tmp_name']) && !is_file($file['tmp_name'])) {
                continue;
            }
            $filename = $file['name'] ?? 'file';
            $mime = $file['type'] ?? 'application/octet-stream';
            $contents = file_get_contents($file['tmp_name']);
            if ($contents === false) {
                continue;
            }
            $body .= "--{$boundary}\r\n";
            $body .= 'Content-Disposition: form-data; name="' . $field . '"; filename="' . $filename . "\"\r\n";
            $body .= 'Content-Type: ' . $mime . "\r\n\r\n";
            $body .= $contents . "\r\n";
            continue;
        }
        // Multiple files under same field (not used today, but safe)
        foreach ($file['tmp_name'] as $index => $tmpName) {
            if (!is_uploaded_file($tmpName) && !is_file($tmpName)) {
                continue;
            }
            $filename = $file['name'][$index] ?? 'file';
            $mime = $file['type'][$index] ?? 'application/octet-stream';
            $contents = file_get_contents($tmpName);
            if ($contents === false) {
                continue;
            }
            $body .= "--{$boundary}\r\n";
            $body .= 'Content-Disposition: form-data; name="' . $field . '"; filename="' . $filename . "\"\r\n";
            $body .= 'Content-Type: ' . $mime . "\r\n\r\n";
            $body .= $contents . "\r\n";
        }
    }

    $body .= "--{$boundary}--\r\n";
    return $body;
}

$forwardHeaders = [];
$hasContentType = false;
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        $lower = strtolower($name);
        if (in_array($lower, ['host', 'connection', 'content-length', 'content-type'], true)) {
            // Content-Type is set explicitly below for rebuilt bodies.
            if ($lower === 'content-type') {
                $hasContentType = true;
            }
            continue;
        }
        $forwardHeaders[] = $name . ': ' . $value;
    }
}

$body = null;
if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
    $isMultipart = stripos($contentType, 'multipart/form-data') !== false;

    if ($isMultipart) {
        // php://input is unavailable for multipart — rebuild from PHP's parsed data.
        $boundary = '----GestionCongeProxy' . bin2hex(random_bytes(8));
        $body = build_multipart_body($_POST, $_FILES, $boundary);
        $forwardHeaders[] = 'Content-Type: multipart/form-data; boundary=' . $boundary;
        $forwardHeaders[] = 'Content-Length: ' . strlen($body);
    } else {
        $body = file_get_contents('php://input');
        if ($body !== '' && $body !== false) {
            if ($hasContentType && $contentType !== '') {
                $forwardHeaders[] = 'Content-Type: ' . $contentType;
            } else {
                $forwardHeaders[] = 'Content-Type: application/json';
            }
            $forwardHeaders[] = 'Content-Length: ' . strlen($body);
        } elseif ($body === '' || $body === false) {
            // Fallback: urlencoded form posts sometimes land in $_POST only.
            if (!empty($_POST)) {
                $body = http_build_query($_POST);
                $forwardHeaders[] = 'Content-Type: application/x-www-form-urlencoded';
                $forwardHeaders[] = 'Content-Length: ' . strlen($body);
            }
        }
    }
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
