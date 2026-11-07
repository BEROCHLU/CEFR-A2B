<?php
/**
 * CEFR A2-B 英作文アプリ 設定ファイル (OpenAI Responses API)
 * API キーは環境変数 OPENAI_API_KEY から読み込みます。
 */

// 使用するモデル gpt-6.1-terra | gpt-6-luna
$model = 'gpt-6.1-terra';

// 推論レベル low | medium | high | xhigh
$reasoningEffort = 'low';
$askReasoningEffort = 'medium';

$apiKey = getenv('OPENAI_API_KEY');
if ($apiKey === false || $apiKey === '') {
    $apiKey = $_SERVER['OPENAI_API_KEY']
        ?? $_ENV['OPENAI_API_KEY']
        ?? $_SERVER['REDIRECT_OPENAI_API_KEY']
        ?? '';
}

return [
    'api_key' => $apiKey,
    'model' => $model,
    'reasoning_effort' => $reasoningEffort,
    'ask_reasoning_effort' => $askReasoningEffort,
    'timeout' => 30,
];
