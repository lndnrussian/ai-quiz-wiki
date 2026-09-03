import React, { useEffect } from 'react';
import { WikiQuestion } from '../types';
import { MultipleChoiceOptions } from './MultipleChoiceOptions';
import { OpenAnswerInput } from './OpenAnswerInput';
import { WikiSourceCard } from './WikiSourceCard';
import { ArrowRight, BookOpen, CheckSquare, MessageSquare, Loader2 } from 'lucide-react';
import { sound } from '../utils/sound';

interface QuizCardProps {
  question: WikiQuestion;
  questionNumber: number;
  isAnswered: boolean;
  selectedOption: string | null;
  onSelectOption: (option: string) => void;
  onSubmitOpenAnswer: (answer: string) => void;
  onOverrideOpenResult?: (isCorrect: boolean) => void;
  isEvaluatingOpen: boolean;
  openEvaluationResult?: { isCorrect: boolean; feedback: string; similarity: number } | null;
  onNextQuestion: () => void;
  isLoadingNext: boolean;
  isFavorite: boolean;
  onToggleFavorite: (q: WikiQuestion) => void;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  question,
  questionNumber,
  isAnswered,
  selectedOption,
  onSelectOption,
  onSubmitOpenAnswer,
  onOverrideOpenResult,
  isEvaluatingOpen,
  openEvaluationResult,
  onNextQuestion,
  isLoadingNext,
  isFavorite,
  onToggleFavorite,
}) => {
  const difficultyLabels: Record<string, string> = {
    easy: 'Лёгкий уровень',
    medium: 'Средний уровень',
    hard: 'Сложный уровень',
    expert: 'Уровень Эксперт',
  };

  const formattedNum = String(questionNumber).padStart(2, '0');

  // Keyboard shortcut (Space / Enter) for next question when answered
  useEffect(() => {
    if (!isAnswered || isLoadingNext) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        sound.playClick();
        onNextQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, isLoadingNext, onNextQuestion]);

  return (
    <div
      id="main-quiz-card"
      className="w-full bg-[#F9F7F2] border border-[#1A1A1A] p-6 sm:p-10 relative select-none"
    >
      {/* Editorial Header Row: Category Badge & Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#1A1A1A]/15">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Pill */}
          <span className="inline-block bg-[#1A1A1A] text-[#F9F7F2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]">
            {question.sourceSystem === 'chgk' ? '🦉 Что? Где? Когда?' : question.category || 'Энциклопедия'}
          </span>

          {/* Difficulty / Source Label */}
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 border border-[#1A1A1A]/30 px-2.5 py-0.5">
            {question.sourceSystem === 'chgk' ? 'db.chgk.info' : difficultyLabels[question.difficulty] || 'Сложность'}
          </span>

          {/* Source Indicator */}
          {question.popularityLabel && (
            <span
              title={question.popularityLabel}
              className="text-[10px] font-medium tracking-wide text-[#1A1A1A]/80 bg-[#1A1A1A]/5 border border-[#1A1A1A]/15 px-2.5 py-0.5 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]/60"></span>
              {question.sourceSystem === 'chgk'
                ? 'Турнирный вопрос ЧГК'
                : question.popularityTier === 'top_tier'
                ? 'Топ-статья Вики'
                : question.popularityTier === 'high'
                ? 'Популярная статья'
                : question.popularityTier === 'medium'
                ? 'Средняя известность'
                : question.popularityTier === 'niche'
                ? 'Специализированная'
                : 'Википедия'}
            </span>
          )}
        </div>

        {/* Question Counter & Type Indicator */}
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-[#1A1A1A]/60">
          <span>Вопрос {formattedNum}</span>
          <span className="opacity-30">•</span>
          <span>{question.sourceSystem === 'chgk' ? 'Ввод знатоков' : question.type === 'multiple_choice' ? 'Тест с вариантами' : 'Открытый вопрос'}</span>
        </div>
      </div>

      {/* Main Question Display Area */}
      <div className="my-8 flex flex-col md:flex-row gap-6 items-start">
        {/* Large Decorative Number for Editorial Balance */}
        <div className="hidden md:flex flex-col items-center justify-start border-r border-[#1A1A1A]/20 pr-6 pt-2 shrink-0 select-none">
          <span className="text-6xl font-black font-mono opacity-15 leading-none text-[#1A1A1A]">
            {formattedNum}
          </span>
          <div
            style={{ writingMode: 'vertical-rl' }}
            className="rotate-180 uppercase tracking-[0.4em] text-[9px] font-bold opacity-40 mt-4"
          >
            Вопрос
          </div>
        </div>

        {/* Question Headline Text */}
        <div className="flex-1">
          <h2
            id="question-text"
            className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-serif leading-[1.2] font-normal italic text-[#1A1A1A] tracking-tight selection:bg-[#1A1A1A] selection:text-[#F9F7F2]"
          >
            {question.question}
          </h2>

          <div className="h-px bg-[#1A1A1A] w-20 opacity-20 my-6"></div>

          {/* Answer Section */}
          {question.type === 'multiple_choice' && question.options ? (
            <MultipleChoiceOptions
              options={question.options}
              correctAnswer={question.correctAnswer}
              selectedAnswer={selectedOption}
              onSelectOption={onSelectOption}
              isAnswered={isAnswered}
              disabled={isLoadingNext}
            />
          ) : (
            <OpenAnswerInput
              correctAnswer={question.correctAnswer}
              acceptableAnswers={question.acceptableAnswers}
              isAnswered={isAnswered}
              isEvaluating={isEvaluatingOpen}
              onSubmitAnswer={onSubmitOpenAnswer}
              onOverrideResult={onOverrideOpenResult}
              evaluationResult={openEvaluationResult}
              disabled={isLoadingNext}
            />
          )}

          {/* Wikipedia Insight & Fact Block */}
          {isAnswered && (
            <WikiSourceCard
              question={question}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
            />
          )}

          {/* Bottom Next Question CTA */}
          {isAnswered && (
            <div className="mt-8 pt-6 border-t border-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/50 hidden sm:block">
                Нажмите <kbd className="px-2 py-0.5 border border-[#1A1A1A] bg-[#F9F7F2] font-mono text-[#1A1A1A] text-[9px]">Пробел</kbd> для перехода
              </div>

              <button
                id="next-question-btn"
                onClick={() => {
                  sound.playClick();
                  onNextQuestion();
                }}
                disabled={isLoadingNext}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#1A1A1A] text-[#F9F7F2] border border-[#1A1A1A] hover:bg-[#F9F7F2] hover:text-[#1A1A1A] font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all"
              >
                {isLoadingNext ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Формирование вопроса...</span>
                  </>
                ) : (
                  <>
                    <span>Следующий вопрос</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
