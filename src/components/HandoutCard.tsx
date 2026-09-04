import React, { useState } from 'react';
import { HandoutData } from '../types';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  X,
  RotateCcw,
  FileText,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface HandoutCardProps {
  handout: HandoutData;
  onSwapQuestion?: () => void;
  tournamentUrl?: string;
}

export const HandoutCard: React.FC<HandoutCardProps> = ({
  handout,
  onSwapQuestion,
  tournamentUrl,
}) => {
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (!handout.hasHandout || handout.type === 'none') {
    return null;
  }

  const handleCopyLink = (url: string) => {
    sound.playClick();
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleCopyText = (text: string) => {
    sound.playClick();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleImageError = (url: string) => {
    setFailedImages((prev) => ({ ...prev, [url]: true }));
  };

  const openLightbox = (url: string) => {
    sound.playClick();
    setActiveModalImage(url);
    setZoomLevel(1);
  };

  const closeLightbox = () => {
    setActiveModalImage(null);
    setZoomLevel(1);
  };

  return (
    <div
      id="question-handout-container"
      className="w-full my-5 bg-[#F9F7F2] border-2 border-[#1A1A1A] p-4 sm:p-5 select-text animate-fadeIn shadow-[2px_2px_0px_#1A1A1A]"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1A1A1A]/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1A1A1A]"></span>
          <span className="font-bold font-mono text-xs uppercase tracking-widest text-[#1A1A1A]">
            Раздаточный материал
          </span>
          <span className="text-[10px] px-2 py-0.5 border border-[#1A1A1A]/40 bg-[#1A1A1A]/5 font-mono uppercase tracking-wider text-[#1A1A1A]/80">
            {handout.type === 'image'
              ? 'Изображение'
              : handout.type === 'text'
              ? 'Текстовый фрагмент'
              : handout.type === 'mixed'
              ? 'Текст и иллюстрация'
              : 'Физическая раздатка'}
          </span>
        </div>

        {/* Quick action buttons in header */}
        <div className="flex items-center gap-2">
          {handout.textHandout && (
            <button
              onClick={() => handleCopyText(handout.textHandout!)}
              className="px-2.5 py-1 border border-[#1A1A1A] bg-transparent hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] text-[11px] font-mono tracking-wider flex items-center gap-1.5 transition-colors"
              title="Скопировать текст раздаточного материала"
            >
              {copiedText ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedText ? 'Скопировано!' : 'Копировать раздатку'}</span>
            </button>
          )}

          {onSwapQuestion && (
            <button
              onClick={() => {
                sound.playClick();
                onSwapQuestion();
              }}
              className="px-2.5 py-1 border border-[#1A1A1A]/50 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A] hover:text-[#F9F7F2] text-[#1A1A1A] text-[11px] font-mono tracking-wider flex items-center gap-1.5 transition-colors"
              title="Заменить вопрос без штрафа (если раздатка непонятна или не загружается)"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Заменить вопрос</span>
              <span className="sm:hidden">Заменить</span>
            </button>
          )}
        </div>
      </div>

      {/* Reader note if present (e.g. [чтецу: пауза]) */}
      {handout.readerNote && (
        <div className="mt-2.5 text-[11px] font-mono italic text-[#1A1A1A]/70 flex items-center gap-1.5">
          <span className="font-semibold not-italic">Ремарка ведущего:</span>
          <span>{handout.readerNote}</span>
        </div>
      )}

      {/* 1. Image Handouts */}
      {handout.images.length > 0 && (
        <div className="mt-4 space-y-4">
          {handout.images.map((imgUrl, idx) => {
            const isFailed = failedImages[imgUrl];

            return (
              <div
                key={idx}
                className="border border-[#1A1A1A] bg-white p-3 sm:p-4 flex flex-col items-center"
              >
                {!isFailed ? (
                  <div className="relative group w-full flex flex-col items-center">
                    {/* Handout Image */}
                    <div
                      onClick={() => openLightbox(imgUrl)}
                      className="cursor-zoom-in relative max-h-[380px] w-full flex items-center justify-center overflow-hidden bg-[#F9F7F2] border border-[#1A1A1A]/20"
                    >
                      <img
                        src={imgUrl}
                        alt={`Раздаточный материал к вопросу ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={() => handleImageError(imgUrl)}
                        className="max-h-[360px] w-auto object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
                      />

                      {/* Hover Overlay Hint */}
                      <div className="absolute inset-0 bg-[#1A1A1A]/0 group-hover:bg-[#1A1A1A]/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <span className="bg-[#1A1A1A] text-[#F9F7F2] text-xs font-mono px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Нажмите, чтобы увеличить</span>
                        </span>
                      </div>
                    </div>

                    {/* Image Action Toolbar */}
                    <div className="w-full mt-3 pt-2.5 border-t border-[#1A1A1A]/15 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-[#1A1A1A]/60 text-[11px] truncate max-w-[200px] sm:max-w-[300px]">
                        {imgUrl}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openLightbox(imgUrl)}
                          className="px-2.5 py-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors flex items-center gap-1.5 text-[11px]"
                          title="Открыть полноэкранный просмотр с увеличением"
                        >
                          <ZoomIn className="w-3 h-3" />
                          <span>Увеличить</span>
                        </button>

                        <a
                          href={imgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors flex items-center gap-1.5 text-[11px]"
                          title="Открыть изображение напрямую в новой вкладке"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Открыть в новой вкладке</span>
                        </a>

                        <button
                          onClick={() => handleCopyLink(imgUrl)}
                          className="px-2.5 py-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F7F2] transition-colors flex items-center gap-1.5 text-[11px]"
                          title="Скопировать прямую ссылку на изображение"
                        >
                          {copiedLink === imgUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink === imgUrl ? 'Ссылка скопирована' : 'Копировать ссылку'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Fallback if external image hosting is blocked / failed */
                  <div className="w-full p-4 border border-dashed border-[#1A1A1A]/40 bg-[#1A1A1A]/5 text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#1A1A1A]">
                      <AlertTriangle className="w-4 h-4 text-[#1A1A1A]" />
                      <span>Изображение не смогло загрузиться напрямую</span>
                    </div>
                    <p className="text-xs text-[#1A1A1A]/80 max-w-lg mx-auto font-sans">
                      Внешний фотохостинг (например, imgur) может блокировать прямые запросы или быть недоступен у вашего интернет-провайдера.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1 font-mono text-xs">
                      <a
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#1A1A1A] text-[#F9F7F2] border border-[#1A1A1A] hover:bg-transparent hover:text-[#1A1A1A] flex items-center gap-1.5 font-bold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Открыть оригинал по ссылке</span>
                      </a>
                      <button
                        onClick={() => handleCopyLink(imgUrl)}
                        className="px-3 py-1.5 border border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-[#F9F7F2] flex items-center gap-1.5 transition-colors"
                      >
                        {copiedLink === imgUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Скопировать ссылку</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Text Handout */}
      {handout.textHandout && (
        <div className="mt-4 border border-[#1A1A1A] bg-white p-4 sm:p-6 relative">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#1A1A1A]/50 mb-2">
            Текст раздаточного листа для команд
          </div>
          <blockquote className="font-serif text-lg sm:text-xl md:text-2xl leading-relaxed text-[#1A1A1A] italic whitespace-pre-wrap select-text">
            {handout.textHandout}
          </blockquote>
        </div>
      )}

      {/* 3. Missing Physical Handout Notice */}
      {handout.type === 'missing' && (
        <div className="mt-3 p-4 border border-[#1A1A1A]/30 bg-[#1A1A1A]/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1A1A1A] uppercase tracking-wider font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>В вопросе предполагалась бумажная раздатка турнира</span>
          </div>
          <p className="text-xs text-[#1A1A1A]/80 font-sans leading-normal">
            В исходном пакете этот вопрос сопровождался карточкой или фотографией, не оцифрованной в базу db.chgk.info.
            Вы можете попытаться ответить по логике текста, либо нажать «Заменить вопрос» выше без потери очков.
          </p>
          {tournamentUrl && (
            <div className="pt-1">
              <a
                href={tournamentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#1A1A1A] underline underline-offset-2 hover:opacity-75"
              >
                <span>Смотреть страницу турнира в db.chgk.info</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {activeModalImage && (
        <div
          id="handout-lightbox-modal"
          className="fixed inset-0 z-50 bg-[#1A1A1A]/85 backdrop-blur-xs flex flex-col p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={closeLightbox}
        >
          {/* Top Lightbox Navigation Bar */}
          <div
            className="flex items-center justify-between text-[#F9F7F2] pb-3 border-b border-white/20 select-none shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-widest font-bold">
                Раздаточный материал (Просмотр)
              </span>
              <span className="text-xs opacity-60 font-mono hidden sm:inline">
                Масштаб: {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
                className="p-1.5 border border-white/40 hover:bg-white/20 text-[#F9F7F2] transition-colors"
                title="Уменьшить"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
                className="p-1.5 border border-white/40 hover:bg-white/20 text-[#F9F7F2] transition-colors"
                title="Увеличить"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 border border-white/40 hover:bg-white/20 text-[#F9F7F2] transition-colors"
                title="Сбросить масштаб (100%)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <a
                href={activeModalImage}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 border border-white/40 hover:bg-white/20 text-[#F9F7F2] transition-colors"
                title="Открыть в новой вкладке"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={closeLightbox}
                className="p-1.5 bg-white text-[#1A1A1A] hover:bg-white/80 transition-colors ml-2"
                title="Закрыть (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Canvas Area */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onClick={(e) => {
              // Click inside image area shouldn't close unless background clicked
              if (e.target === e.currentTarget) closeLightbox();
            }}
          >
            <img
              src={activeModalImage}
              alt="Увеличенный раздаточный материал"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-[85vh] max-w-[90vw] object-contain cursor-grab active:cursor-grabbing border border-white/30 shadow-2xl bg-white select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom info hint */}
          <div className="text-center text-[11px] font-mono text-white/60 pt-2 select-none shrink-0">
            Нажмите <kbd className="px-1.5 py-0.5 border border-white/30 bg-black/40 text-white">Esc</kbd> или кликните вне картинки, чтобы закрыть окно
          </div>
        </div>
      )}
    </div>
  );
};
