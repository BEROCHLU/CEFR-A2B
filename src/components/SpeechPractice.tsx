import { useState, useRef, useEffect } from 'react';
import {
  getSpeechRecognition,
  abortRecognition,
  recognitionErrorMessage,
  comparePhrase,
  type PhraseRecognition,
} from '../utils/speechRecognition';

interface SpeechPracticeProps {
  targetText: string; // お手本の英文
  lang?: string;       // デフォルト: 'en-US'
  onTranscriptChange?: (transcript: string) => void;
  onAnswerSubmit?: (transcript: string, score: number) => void;
}

export default function SpeechPractice({
  targetText,
  lang = 'en-US',
  onTranscriptChange,
  onAnswerSubmit
}: SpeechPracticeProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [matchedWords, setMatchedWords] = useState<{ word: string; isMatched: boolean }[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const recognitionRef = useRef<PhraseRecognition | null>(null);
  const isSpeechSupported = !!getSpeechRecognition();

  // アンマウント時に確実に録音を解放
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      abortRecognition(recognition);
    };
  }, []);

  // お手本テキストが変わったらリセット
  useEffect(() => {
    setTranscript('');
    setScore(null);
    setMatchedWords([]);
    setErrorMessage('');
  }, [targetText]);

  // 録音開始
  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition || recognitionRef.current) return;

    if (!window.isSecureContext) {
      setErrorMessage('音声認識には HTTPS または localhost が必要です。');
      return;
    }

    // スピーカーの読み上げ音をマイクが拾わないよう停止
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setTranscript('');
    setScore(null);
    setMatchedWords([]);
    setErrorMessage('');

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      let latestTranscript = '';

      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return;
        latestTranscript = Array.from(event.results, r => r[0].transcript).join(' ').trim();
        setTranscript(latestTranscript);
        if (onTranscriptChange && latestTranscript) {
          onTranscriptChange(latestTranscript);
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setIsListening(false);

        if (!latestTranscript) {
          setErrorMessage(recognitionErrorMessage('no-speech'));
          return;
        }

        // LCS アルゴリズムで採点・単語ハイライト
        const result = comparePhrase(targetText, latestTranscript);
        setMatchedWords(result.matchedWords);
        setScore(result.score);

        if (onAnswerSubmit) {
          onAnswerSubmit(latestTranscript, result.score);
        }
      };

      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        setIsListening(false);
        setErrorMessage(recognitionErrorMessage(event.error));
        abortRecognition(recognition);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setErrorMessage('音声認識の開始に失敗しました。');
    }
  };

  // 録音停止
  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      abortRecognition(recognition);
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // 円形メーターの計算（半径 23px → 円周 144.5px）
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = score !== null ? circumference * (1 - score / 100) : circumference;

  return (
    <div className="speech-practice-container" style={{ margin: '14px 0', fontFamily: 'inherit', color: '#f8fafc' }}>
      {/* 波形アニメーション CSS */}
      <style>{`
        @keyframes soundWaveBounce {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1); }
        }
        .voice-bar {
          display: inline-block;
          width: 4px;
          height: 20px;
          margin: 0 2px;
          background-color: #f43f5e;
          border-radius: 9999px;
          animation: soundWaveBounce 1.2s ease-in-out infinite;
          transform-origin: bottom;
        }
        .voice-bar:nth-child(2) { animation-delay: 0.15s; }
        .voice-bar:nth-child(3) { animation-delay: 0.3s; }
        .voice-bar:nth-child(4) { animation-delay: 0.45s; }
        .voice-bar:nth-child(5) { animation-delay: 0.6s; }
      `}</style>

      {/* 音声回答カード */}
      <div style={{ backgroundColor: '#1e293b', padding: '16px 20px', borderRadius: '12px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
            🎙️ 音声で回答（発音＆英作文チェック）
          </div>
          {score !== null && (
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
              お手本との一致率: <strong style={{ color: score >= 80 ? '#34d399' : score >= 60 ? '#facc15' : '#fb7185' }}>{score}%</strong>
            </div>
          )}
        </div>

        {/* 単語ハイライト表示（発話後にお手本との合否カラーを表示） */}
        {matchedWords.length > 0 && (
          <div style={{ fontSize: '17px', fontWeight: 600, minHeight: '36px', lineHeight: '1.6', marginBottom: '10px', padding: '8px 12px', backgroundColor: '#0f172a', borderRadius: '8px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>お手本との単語照合:</span>
            {matchedWords.map((item, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-block',
                  marginRight: '6px',
                  color: item.isMatched ? '#34d399' : '#fb7185',
                  textDecoration: item.isMatched ? 'none' : 'underline wavy #f43f5e',
                  fontWeight: item.isMatched ? 700 : 400,
                }}
              >
                {item.word}
              </span>
            ))}
          </div>
        )}

        {/* コントロール（マイクボタン ＆ 波形） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {isSpeechSupported ? (
            <button
              type="button"
              onClick={toggleListening}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.92rem',
                color: '#fff',
                backgroundColor: isListening ? '#e11d48' : '#009966',
                boxShadow: isListening ? '0 0 12px rgba(225, 29, 72, 0.5)' : '0 2px 6px rgba(0,0,0,0.2)',
                transition: '0.2s',
              }}
            >
              {isListening ? (
                <>
                  <span>🛑 発話を終了</span>
                </>
              ) : (
                <>
                  <span>🎤 声で回答する</span>
                </>
              )}
            </button>
          ) : (
            <div style={{ color: '#fb7185', fontSize: '13px' }}>
              ⚠️ お使いのブラウザは音声認識に対応していません（Chrome / Edge / Safari をご利用ください）。
            </div>
          )}

          {/* 録音中の波形バー */}
          {isListening && (
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '22px' }}>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <div className="voice-bar"></div>
              <span style={{ fontSize: '13px', color: '#fda4af', marginLeft: '8px' }}>聞いています…話してください</span>
            </div>
          )}

          {/* 円形メーター（スコア表示） */}
          {score !== null && !isListening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <div style={{ width: '42px', height: '42px', transform: 'rotate(-90deg)' }}>
                <svg width="42" height="42" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r={radius} stroke="#334155" strokeWidth="4" fill="none" />
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    stroke={score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : '#f43f5e'}
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                  />
                </svg>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: score >= 80 ? '#34d399' : score >= 60 ? '#facc15' : '#fb7185' }}>
                {score}%
              </div>
            </div>
          )}
        </div>

        {/* エラー表示 */}
        {errorMessage && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.12)', color: '#fda4af', fontSize: '13px' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 認識されたテキスト */}
        {(isListening || transcript) && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>認識された音声:</div>
            <div style={{ backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px', marginTop: '4px', fontStyle: 'italic', color: '#cbd5e1', fontSize: '0.95rem' }}>
              {transcript || '聞いています…話してください'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
