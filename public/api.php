<?php
/**
 * CEFR A2-B 英作文アプリ OpenAI Responses API 中継バックエンド (PHP 8.5)
 * モデル: gpt-6.1-terra
 * エンドポイント: https://api.openai.com/v1/responses
 */

header('Content-Type: application/json; charset=utf-8');

// CORS対応 (ローカルテストや別ポートからの検証用)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    }
    exit(0);
}

// POST リクエストのみ受け付ける
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// 設定ファイルの読み込み
$configFile = __DIR__ . '/config.openai.php';

if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => '設定ファイルが見つかりません。']);
    exit;
}

$config = require $configFile;
$apiKey = $config['api_key'] ?? '';
$model = $config['model'] ?? 'gpt-6.1-terra';
$reasoningEffort = $config['reasoning_effort'] ?? null;
$askReasoningEffort = array_key_exists('ask_reasoning_effort', $config)
    ? $config['ask_reasoning_effort']
    : $reasoningEffort;
$timeout = $config['timeout'] ?? 25;

$allowedReasoningEfforts = ['low', 'medium', 'high', 'xhigh'];
if (
    !in_array($reasoningEffort, $allowedReasoningEfforts, true)
    || !in_array($askReasoningEffort, $allowedReasoningEfforts, true)
) {
    http_response_code(500);
    echo json_encode([
        'error' => '推論レベルの設定が不正です。low | medium | high | xhigh のいずれかを指定してください。'
    ]);
    exit;
}

if (empty($apiKey)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'OpenAI APIキーが設定されていません。環境変数 OPENAI_API_KEY を設定してください。'
    ]);
    exit;
}

// 入力JSONの受け取り
$inputRaw = file_get_contents('php://input');
$input = json_decode($inputRaw, true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => '無効なJSONリクエストです。']);
    exit;
}

$action = $input['action'] ?? 'evaluate';

// ========================================================
// 1. 添削モード (evaluate)
// ========================================================
if ($action === 'evaluate') {
    $japanese = trim($input['japanese'] ?? '');
    $modelAnswer = trim($input['model_answer'] ?? '');
    $english = trim($input['english'] ?? '');

    if ($japanese === '' || $english === '') {
        http_response_code(400);
        echo json_encode(['error' => '出題文または回答英文が空です。']);
        exit;
    }

    $promptPath = (realpath(__DIR__) ?: __DIR__) . '/../prompt/system.md';
    if (!file_exists($promptPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'システムプロンプトファイル (prompt/system.md) が見つかりません。']);
        exit;
    }
    $systemInstruction = trim(file_get_contents($promptPath));

    $userPrompt = "日本語の例文: {$japanese}\n";
    if ($modelAnswer !== '') {
        $userPrompt .= "模範解答: {$modelAnswer}\n";
    }
    $userPrompt .= "ユーザーの英文: {$english}";

    $payload = [
        'model' => $model,
        'instructions' => $systemInstruction,
        'input' => $userPrompt,
        'text' => [
            'format' => [
                'type' => 'json_schema',
                'name' => 'evaluation_result',
                'strict' => true,
                'schema' => [
                    'type' => 'object',
                    'properties' => [
                        'status' => [
                            'type' => 'string',
                            'enum' => ['pass', 'close', 'fail']
                        ],
                        'feedback' => [
                            'type' => 'string'
                        ],
                        'alternative_answer' => [
                            'type' => 'string'
                        ]
                    ],
                    'required' => ['status', 'feedback', 'alternative_answer'],
                    'additionalProperties' => false
                ]
            ]
        ],
        'reasoning' => [
            'effort' => $reasoningEffort
        ]
    ];

    $response = callOpenAiResponsesApi($apiKey, $payload, $timeout);
    $text = extractResponseText($response);
    $parsed = json_decode($text, true);

    if (!$parsed || !isset($parsed['status'])) {
        // パース失敗時のフォールバック
        echo json_encode([
            'status' => 'close',
            'feedback' => '判定の解析に失敗しました。もう一度入力してみてください。',
            'model_answer' => '',
            'alternative_answer' => '',
            'model' => $model,
            'thinking_level' => $reasoningEffort,
            'raw' => $text
        ]);
        exit;
    }

    // 不合格時は二重の安全策として模範解答をクリア
    if ($parsed['status'] !== 'pass') {
        $parsed['model_answer'] = '';
        $parsed['alternative_answer'] = '';
    } elseif ($modelAnswer !== '') {
        $parsed['model_answer'] = $modelAnswer;
        // 模範解答と別解の重複防止（ピリオドや大文字小文字の違いを無視して比較）
        $normModel = strtolower(rtrim(trim($parsed['model_answer']), '.?!'));
        $normAlt = strtolower(rtrim(trim($parsed['alternative_answer'] ?? ''), '.?!'));
        if ($normModel === $normAlt) {
            $parsed['alternative_answer'] = '';
        }
    }

    $parsed['model'] = $model;
    $parsed['thinking_level'] = $reasoningEffort;

    echo json_encode($parsed);
    exit;
}

// ========================================================
// 2. 質問モード (ask)
// ========================================================
if ($action === 'ask') {
    $japanese = is_string($input['japanese'] ?? null) ? trim($input['japanese']) : '';
    $modelAnswer = is_string($input['model_answer'] ?? null) ? trim($input['model_answer']) : '';
    $english = is_string($input['english'] ?? null) ? trim($input['english']) : '';
    $evalContext = is_string($input['eval_context'] ?? null) ? $input['eval_context'] : '';
    $question = is_string($input['question'] ?? null) ? trim($input['question']) : '';

    if ($question === '') {
        http_response_code(400);
        echo json_encode(['error' => '質問内容が空です。']);
        exit;
    }

    if (mb_strlen($question) > 500) {
        http_response_code(400);
        echo json_encode(['error' => '質問は500文字以内で入力してください。']);
        exit;
    }

    $promptPath = (realpath(__DIR__) ?: __DIR__) . '/../prompt/system-ask.md';
    if (!file_exists($promptPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'システムプロンプトファイル (prompt/system-ask.md) が見つかりません。']);
        exit;
    }
    $systemInstruction = trim(file_get_contents($promptPath));

    // 問題の情報は履歴の上限に左右されない共通コンテキストとして保持する。
    $systemInstruction .= "\n\n【日本語の例文】\n{$japanese}\n\n【基準の模範解答】\n{$modelAnswer}";

    $previousResponseId = is_string($input['previous_response_id'] ?? null) ? trim($input['previous_response_id']) : '';

    $payload = [
        'model' => $model,
        'max_output_tokens' => 1500,
        'context_management' => [
            [
                'type' => 'compaction',
                'compact_threshold' => 30000
            ]
        ],
        'reasoning' => [
            'effort' => $askReasoningEffort
        ]
    ];

    if ($previousResponseId !== '') {
        // 直前のレスポンスIDを指定して会話文脈と推論コンテキストを引き継ぐ
        $payload['previous_response_id'] = $previousResponseId;
        $payload['input'] = $question;
    } else {
        // 初回質問：システム指示と出題・回答コンテキストを含めて送信
        $userPrompt = "【現在のユーザーが書いた英文】\n{$english}{$evalContext}\n\n【質問】\n{$question}";
        $payload['instructions'] = $systemInstruction;
        $payload['input'] = $userPrompt;
    }

    $response = callOpenAiResponsesApi($apiKey, $payload, $timeout);
    $answerText = extractResponseText($response);
    if ($answerText === '') {
        $answerText = '回答を取得できませんでした。';
    }

    echo json_encode([
        'answer' => $answerText,
        'response_id' => $response['id'] ?? null,
        'model' => $model,
        'thinking_level' => $askReasoningEffort
    ]);
    exit;
}

// 未対応のアクション
http_response_code(400);
echo json_encode(['error' => '未知のアクションです。']);
exit;


// ========================================================
// OpenAI Responses API 呼び出し関数
// ========================================================
function callOpenAiResponsesApi(string $apiKey, array $payload, int $timeout): array
{
    $url = 'https://api.openai.com/v1/responses';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ],
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4, // IPv4を優先してWindowsの接続遅延を防止
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $responseBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        http_response_code(502);
        echo json_encode(['error' => '通信エラーが発生しました: ' . $curlError]);
        exit;
    }

    $decoded = json_decode($responseBody, true);

    if ($httpCode !== 200) {
        http_response_code($httpCode >= 400 && $httpCode < 600 ? $httpCode : 500);
        $message = $decoded['error']['message'] ?? ('OpenAI APIリクエストに失敗しました (HTTP ' . $httpCode . ')');
        echo json_encode(['error' => $message, 'details' => $decoded]);
        exit;
    }

    if (!is_array($decoded)) {
        http_response_code(502);
        echo json_encode(['error' => 'OpenAI APIから無効なレスポンスが返されました。']);
        exit;
    }

    return $decoded;
}

// ========================================================
// Responses API 出力テキスト抽出関数
// ========================================================
function extractResponseText(array $response): string
{
    // 1. トップレベルの output_text プロパティ
    if (isset($response['output_text']) && is_string($response['output_text']) && trim($response['output_text']) !== '') {
        return trim($response['output_text']);
    }

    // 2. output 配列から message -> content -> output_text を抽出
    if (isset($response['output']) && is_array($response['output'])) {
        $texts = [];
        foreach ($response['output'] as $item) {
            if (($item['type'] ?? '') === 'message' && isset($item['content']) && is_array($item['content'])) {
                foreach ($item['content'] as $contentPart) {
                    $type = $contentPart['type'] ?? '';
                    if (($type === 'output_text' || $type === 'text') && isset($contentPart['text'])) {
                        $texts[] = $contentPart['text'];
                    }
                }
            }
        }
        if (!empty($texts)) {
            return trim(implode("\n", $texts));
        }
    }

    return '';
}
