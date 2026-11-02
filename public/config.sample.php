<?php
/**
 * 設定ファイル サンプル (OpenAI Responses API)
 */

// 使用するモデル gpt-6.1-terra | gpt-6-luna
$model = 'gpt-6.1-terra';

// 推論レベル low | medium | high | xhigh
$reasoningEffort = 'medium';

return [
    // OpenAI API キー (環境変数 OPENAI_API_KEY またはここへ直接記述)
    'api_key' => getenv('OPENAI_API_KEY') ?: 'YOUR_OPENAI_API_KEY_HERE',

    'model' => $model,

    'reasoning_effort' => $reasoningEffort,

    'timeout' => 25,
];
