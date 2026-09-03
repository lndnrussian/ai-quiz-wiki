import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Database, Zap, RefreshCw, CheckCircle, AlertCircle, Info, ExternalLink, Trash2, History, RotateCcw } from 'lucide-react';
import { getUserApiKey, saveUserApiKey, clearUserApiKey, resetSeenHistory } from '../utils/storage';
import { UserProfile } from '../types';
import { sound } from '../utils/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile?: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
}

interface QuotaStatus {
  dailyCount: number;
  maxDaily: number;
  date: string;
  remaining: number;
  isBankActive: boolean;
  bankQuestionCount: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, activeProfile, onUpdateProfile }) => {
  const [userApiKey, setUserApiKeyState] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [historyResetSuccess, setHistoryResetSuccess] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUserApiKeyState(getUserApiKey());
      setIsSaved(false);
      fetchQuotaStatus();
    }
  }, [isOpen]);

  const fetchQuotaStatus = async () => {
    setIsLoadingQuota(true);
    try {
      const res = await fetch('/api/quiz/quota-status');
      if (res.ok) {
        const data = await res.json();
        setQuotaStatus(data);
      }
    } catch (e) {
      console.error('Failed to load quota status:', e);
    } finally {
      setIsLoadingQuota(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = userApiKey.trim();
    saveUserApiKey(trimmed);
    setUserApiKeyState(trimmed);
    setIsSaved(true);
    sound.playClick();
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleClear = () => {
    clearUserApiKey();
    setUserApiKeyState('');
    setIsSaved(true);
    sound.playClick();
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div
      id="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#F9F7F2] border-2 border-[#1A1A1A] w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1A1A1A] text-[#F9F7F2] p-4 flex justify-between items-center border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-[#F9F7F2]" />
            <div>
              <h2 className="font-serif font-black text-base uppercase tracking-wider text-[#F9F7F2]">
                Настройки и Ключ API
              </h2>
              <p className="text-[10px] text-[#F9F7F2]/70 font-mono">
                Управление квотами и автономным банком вопросов
              </p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1 hover:bg-[#F9F7F2]/20 transition-colors text-[#F9F7F2]"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#1A1A1A]">
          {/* Question Bank & Server Quota Status */}
          <div className="border border-[#1A1A1A] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#1A1A1A]" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Офлайн-банк вопросов (Wikipedia)
                </span>
              </div>
              <button
                onClick={fetchQuotaStatus}
                disabled={isLoadingQuota}
                className="text-[10px] font-mono font-bold flex items-center gap-1 hover:underline text-[#1A1A1A]/70"
                title="Обновить статус"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingQuota ? 'animate-spin' : ''}`} />
                Обновить
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-[#F9F7F2] border border-[#1A1A1A]/30">
                <div className="text-[10px] text-[#1A1A1A]/70 uppercase">Вопросов в банке</div>
                <div className="text-base font-bold text-[#1A1A1A] mt-0.5">
                  {quotaStatus ? `${quotaStatus.bankQuestionCount} шт.` : '206+ шт.'}
                </div>
                <div className="text-[9px] text-[#1A1A1A]/60 mt-0.5">
                  100% экономия AI-токенов
                </div>
              </div>

              <div className="p-2.5 bg-[#F9F7F2] border border-[#1A1A1A]/30">
                <div className="text-[10px] text-[#1A1A1A]/70 uppercase">Дневной лимит AI-судьи</div>
                <div className="text-base font-bold text-[#1A1A1A] mt-0.5">
                  {quotaStatus ? `${quotaStatus.remaining} / ${quotaStatus.maxDaily}` : '700 / 700'}
                </div>
                <div className="text-[9px] text-[#1A1A1A]/60 mt-0.5">
                  Сброс в 00:00 (Pacific Time)
                </div>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[#1A1A1A]/80 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#1A1A1A]/70" />
              <span>
                Генерация викторины использует живой поиск в русской Википедии и офлайн-банк энциклопедии. 
                Модель <strong>gemini-2.5-flash-lite</strong> используется для создания уникальных вопросов и проверки открытых ответов.
              </span>
            </p>
          </div>

          {/* Question Variety & Anti-Repetition History */}
          <div className="border border-[#1A1A1A] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1A1A1A]" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Разнообразие и защита от повторов
                </span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold border border-emerald-300">
                Активно
              </span>
            </div>

            <p className="text-xs text-[#1A1A1A]/80 leading-relaxed">
              Приложение сохраняет заголовки встреченных статей энциклопедии в вашем профиле (до 1500 тем), чтобы исключить повторение одних и тех же вопросов изо дня в день.
            </p>

            <div className="flex items-center justify-between p-2.5 bg-[#F9F7F2] border border-[#1A1A1A]/30 font-mono text-xs">
              <div>
                <div className="text-[10px] text-[#1A1A1A]/70 uppercase">Уникальных тем пройдено</div>
                <div className="text-base font-bold text-[#1A1A1A] mt-0.5">
                  {activeProfile?.stats.seenArticleTitles?.length || 0} статей
                </div>
              </div>

              {activeProfile && (activeProfile.stats.seenArticleTitles?.length || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const { profile: updatedP } = resetSeenHistory(activeProfile.id);
                    if (onUpdateProfile) onUpdateProfile(updatedP);
                    setHistoryResetSuccess(true);
                    sound.playClick();
                    setTimeout(() => setHistoryResetSuccess(false), 3000);
                  }}
                  className="px-2.5 py-1.5 border border-[#1A1A1A] text-[11px] font-bold uppercase tracking-wider hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors flex items-center gap-1 cursor-pointer bg-white"
                  title="Сбросить историю просмотренных вопросов"
                >
                  <RotateCcw className="w-3 h-3" />
                  Сбросить историю
                </button>
              )}
            </div>

            {historyResetSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 p-2 border border-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>История повторов сброшена. Темы начнут изучаться заново!</span>
              </div>
            )}
          </div>

          {/* BYOK (Bring Your Own Key) Section */}
          <div className="border border-[#1A1A1A] bg-white p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1A1A1A]" />
              <h3 className="font-bold text-xs uppercase tracking-wider">
                Свой ключ Gemini API (Опционально)
              </h3>
            </div>

            <p className="text-xs text-[#1A1A1A]/80 leading-relaxed">
              Вы можете подключить собственный бесплатный ключ Gemini API от Google AI Studio. 
              Ключ хранится <strong>исключительно в памяти вашего браузера (localStorage)</strong> и передаётся только в заголовке ваших собственных запросов.
            </p>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase mb-1">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    id="user-api-key-input"
                    type={showKey ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={userApiKey}
                    onChange={(e) => setUserApiKeyState(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1A1A1A] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] bg-white pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#1A1A1A]/60 hover:text-[#1A1A1A] px-1.5 py-0.5 border border-transparent hover:border-[#1A1A1A]/30"
                  >
                    {showKey ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
              </div>

              {isSaved && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 p-2 border border-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Настройки ключа успешно сохранены в браузере!</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 gap-2">
                <button
                  type="submit"
                  id="save-api-key-btn"
                  className="px-4 py-2 bg-[#1A1A1A] text-[#F9F7F2] font-bold text-xs uppercase tracking-wider hover:bg-[#1A1A1A]/90 transition-all cursor-pointer"
                >
                  Сохранить ключ
                </button>

                {userApiKey && (
                  <button
                    type="button"
                    onClick={handleClear}
                    id="clear-api-key-btn"
                    className="px-3 py-2 border border-rose-800 text-rose-800 font-bold text-xs uppercase tracking-wider hover:bg-rose-50 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Очистить
                  </button>
                )}
              </div>
            </form>

            <div className="pt-2 border-t border-[#1A1A1A]/10">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#1A1A1A] hover:underline inline-flex items-center gap-1"
              >
                <span>Получить бесплатный ключ в Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#EFECE6] p-3 flex justify-end border-t border-[#1A1A1A]">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-[#1A1A1A] font-bold text-xs uppercase tracking-wider bg-white hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
