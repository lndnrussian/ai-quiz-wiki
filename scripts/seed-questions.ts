import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { comprehensiveFallbackQuestions } from '../server/fallbackQuestions';
import { WikiQuestion } from '../src/types';

dotenv.config();

const DATA_FILE = path.join(process.cwd(), 'data', 'generated-questions.json');

// Gemini Model configuration (gemini-2.5-flash-lite has the highest free tier quota)
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Delay between consecutive Gemini API calls to strictly prevent RPM (requests per minute) rate limits
const API_CALL_DELAY_MS = 4500; // 4.5 seconds
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// List of high-value Wikipedia article topics across all 11 categories
const categoriesData: { category: string; questions: Omit<WikiQuestion, 'id'>[] }[] = [
  {
    category: 'Видеоигры',
    questions: [
      {
        question: 'Какая игра-головоломка была создана советским программистом Алексеем Пажитновым в июне 1984 года на компьютере «Электроника-60»?',
        type: 'multiple_choice',
        options: ['Тетрис', 'Косынка', 'Пакман', 'Сапёр'],
        correctAnswer: 'Тетрис',
        acceptableAnswers: ['Тетрис', 'Tetris'],
        explanation: '«Тетрис» был создан Алексеем Пажитновым в Вычислительном центре Академии наук СССР.',
        articleTitle: 'Тетрис',
        articleUrl: 'https://ru.wikipedia.org/wiki/Тетрис',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 45000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~45k просм/мес)',
      },
      {
        question: 'В какой игре 1998 года от Valve главным героем выступает физик-теоретик Гордон Фримен, вооружённый монтировкой?',
        type: 'multiple_choice',
        options: ['Half-Life', 'Doom', 'Quake', 'Duke Nukem 3D'],
        correctAnswer: 'Half-Life',
        acceptableAnswers: ['Half-Life', 'Халф-Лайф'],
        explanation: 'Half-Life произвела революцию в жанре шутеров благодаря непрерывному повествованию.',
        articleTitle: 'Half-Life',
        articleUrl: 'https://ru.wikipedia.org/wiki/Half-Life',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 38000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~38k просм/мес)',
      },
      {
        question: 'Какая игра-песочница Маркуса Перссона («Notch») с процедурно генерируемым кубическим миром стала самой продаваемой видеоигрой в истории?',
        type: 'multiple_choice',
        options: ['Minecraft', 'Terraria', 'Roblox', 'Cube World'],
        correctAnswer: 'Minecraft',
        acceptableAnswers: ['Minecraft', 'Майнкрафт'],
        explanation: 'Minecraft разошлась тиражом более 300 миллионов копий.',
        articleTitle: 'Minecraft',
        articleUrl: 'https://ru.wikipedia.org/wiki/Minecraft',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 75000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~75k просм/мес)',
      },
      {
        question: 'Какой японский геймдизайнер создал серии Metal Gear и Death Stranding?',
        type: 'open_ended',
        options: ['Хидэо Кодзима', 'Синдзи Миками', 'Хидэтака Миядзаки', 'Ёсинори Китасэ'],
        correctAnswer: 'Хидэо Кодзима',
        acceptableAnswers: ['Хидэо Кодзима', 'Кодзима', 'Hideo Kojima', 'Хидео Кодзима'],
        explanation: 'Хидэо Кодзима — автор кинематографичного повествования в видеоиграх.',
        articleTitle: 'Кодзима, Хидэо',
        articleUrl: 'https://ru.wikipedia.org/wiki/Кодзима,_Хидэо',
        difficulty: 'medium',
        category: 'Видеоигры',
        pageviews: 22000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~22k просм/мес)',
      },
      {
        question: 'Как звали ведьмака из Ривии в серии игр по книгам Анджея Сапковского?',
        type: 'open_ended',
        options: ['Геральт', 'Весемир', 'Лютик', 'Эскель'],
        correctAnswer: 'Геральт',
        acceptableAnswers: ['Геральт', 'Геральт из Ривии', 'Geralt'],
        explanation: 'Геральт из Ривии — охотник на монстров и протагонист франшизы «Ведьмак».',
        articleTitle: 'Геральт из Ривии',
        articleUrl: 'https://ru.wikipedia.org/wiki/Геральт_из_Ривии',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 52000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~52k просм/мес)',
      },
      {
        question: 'Кто создал пошаговую стратегическую серию Civilization?',
        type: 'multiple_choice',
        options: ['Сид Мейер', 'Питер Молиньё', 'Уилл Райт', 'Джон Кармак'],
        correctAnswer: 'Сид Мейер',
        acceptableAnswers: ['Сид Мейер', 'Sid Meier'],
        explanation: 'Сид Мейер — основатель студии Firaxis Games.',
        articleTitle: 'Мейер, Сид',
        articleUrl: 'https://ru.wikipedia.org/wiki/Мейер,_Сид',
        difficulty: 'medium',
        category: 'Видеоигры',
        pageviews: 8500,
        popularityTier: 'high',
        popularityLabel: 'Высокая популярность (~9k просм/мес)',
      },
      {
        question: 'Кто написал 3D-движки для культовых шутеров Wolfenstein 3D, Doom и Quake?',
        type: 'open_ended',
        options: ['Джон Кармак', 'Джон Ромеро', 'Гейб Ньюэлл', 'Тим Суини'],
        correctAnswer: 'Джон Кармак',
        acceptableAnswers: ['Джон Кармак', 'Кармак', 'John Carmack'],
        explanation: 'Джон Кармак разработал революционные алгоритмы рендеринга.',
        articleTitle: 'Кармак, Джон',
        articleUrl: 'https://ru.wikipedia.org/wiki/Кармак,_Джон',
        difficulty: 'hard',
        category: 'Видеоигры',
        pageviews: 14000,
        popularityTier: 'high',
        popularityLabel: 'Высокая популярность (~14k просм/мес)',
      },
      {
        question: 'Как называется континент, на котором происходят события The Elder Scrolls: Skyrim и Morrowind?',
        type: 'open_ended',
        options: ['Тамриэль', 'Акавир', 'Альдмери', 'Атмора'],
        correctAnswer: 'Тамриэль',
        acceptableAnswers: ['Тамриэль', 'Tamriel'],
        explanation: 'Тамриэль — центральный континент вселенной The Elder Scrolls.',
        articleTitle: 'The Elder Scrolls',
        articleUrl: 'https://ru.wikipedia.org/wiki/The_Elder_Scrolls',
        difficulty: 'medium',
        category: 'Видеоигры',
        pageviews: 31000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~31k просм/мес)',
      },
      {
        question: 'Какой разработчик создал игру Flappy Bird в 2013 году?',
        type: 'multiple_choice',
        options: ['Донг Нгуен', 'Нотч', 'Тоби Фокс', 'Джонатан Блоу'],
        correctAnswer: 'Донг Нгуен',
        acceptableAnswers: ['Донг Нгуен', 'Dong Nguyen'],
        explanation: 'Вьетнамский программист Донг Нгуен создал вирусный хит Flappy Bird.',
        articleTitle: 'Flappy Bird',
        articleUrl: 'https://ru.wikipedia.org/wiki/Flappy_Bird',
        difficulty: 'hard',
        category: 'Видеоигры',
        pageviews: 12000,
        popularityTier: 'high',
        popularityLabel: 'Высокая популярность (~12k просм/мес)',
      },
      {
        question: 'Кто создал инди-игру Undertale в одиночку, написав весь сюжет и музыку?',
        type: 'open_ended',
        options: ['Тоби Фокс', 'Эдмунд Макмиллен', 'Джонатан Блоу', 'Маркус Перссон'],
        correctAnswer: 'Тоби Фокс',
        acceptableAnswers: ['Тоби Фокс', 'Toby Fox'],
        explanation: 'Тоби Фокс выпустил культовую RPG Undertale в 2015 году.',
        articleTitle: 'Undertale',
        articleUrl: 'https://ru.wikipedia.org/wiki/Undertale',
        difficulty: 'medium',
        category: 'Видеоигры',
        pageviews: 29000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~29k просм/мес)',
      },
      {
        question: 'В каком году вышла легендарная многопользовательская игра World of Warcraft?',
        type: 'multiple_choice',
        options: ['2004 год', '2001 год', '2006 год', '1999 год'],
        correctAnswer: '2004 год',
        acceptableAnswers: ['2004', '2004 год'],
        explanation: 'World of Warcraft вышла в ноябре 2004 года к 10-летию вселенной Warcraft.',
        articleTitle: 'World of Warcraft',
        articleUrl: 'https://ru.wikipedia.org/wiki/World_of_Warcraft',
        difficulty: 'medium',
        category: 'Видеоигры',
        pageviews: 41000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~41k просм/мес)',
      },
      {
        question: 'Как звали брата Марио в зелёном комбинезоне в играх Nintendo?',
        type: 'open_ended',
        options: ['Луиджи', 'Варио', 'Валуиджи', 'Тоад'],
        correctAnswer: 'Луиджи',
        acceptableAnswers: ['Луиджи', 'Luigi'],
        explanation: 'Луиджи впервые появился в аркадной игре Mario Bros. в 1983 году.',
        articleTitle: 'Луиджи',
        articleUrl: 'https://ru.wikipedia.org/wiki/Луиджи',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 31000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~31k просм/мес)',
      },
      {
        question: 'Какая игра в жанре «королевская битва» от Epic Games вышла в 2017 году и завоевала мировую популярность благодаря механике строительства?',
        type: 'multiple_choice',
        options: ['Fortnite', 'PUBG', 'Apex Legends', 'Warzone'],
        correctAnswer: 'Fortnite',
        acceptableAnswers: ['Fortnite', 'Фортнайт'],
        explanation: 'Fortnite Battle Royale стала одной из самых популярных сетевых игр в истории.',
        articleTitle: 'Fortnite',
        articleUrl: 'https://ru.wikipedia.org/wiki/Fortnite',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 62000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~62k просм/мес)',
      },
      {
        question: 'Какая японская компания выпустила портативную консоль Game Boy в 1989 году?',
        type: 'multiple_choice',
        options: ['Nintendo', 'Sega', 'Sony', 'Bandai'],
        correctAnswer: 'Nintendo',
        acceptableAnswers: ['Nintendo', 'Нинтендо'],
        explanation: 'Nintendo разработала Game Boy под руководством Гумпэя Ёкои.',
        articleTitle: 'Game Boy',
        articleUrl: 'https://ru.wikipedia.org/wiki/Game_Boy',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 26000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~26k просм/мес)',
      },
      {
        question: 'Как звали главную героиню серии приключенческих экшенов Tomb Raider?',
        type: 'open_ended',
        options: ['Лара Крофт', 'Самус Аран', 'Джилл Валентайн', 'Элой'],
        correctAnswer: 'Лара Крофт',
        acceptableAnswers: ['Лара Крофт', 'Lara Croft', 'Лара'],
        explanation: 'Археолог Лара Крофт дебютировала в 1996 году на Sega Saturn и PlayStation.',
        articleTitle: 'Лара Крофт',
        articleUrl: 'https://ru.wikipedia.org/wiki/Лара_Крофт',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 43000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~43k просм/мес)',
      },
      {
        question: 'Какой космический экшен 2007 года от BioWare познакомил игроков с капитаном Шепардом и жнецами?',
        type: 'multiple_choice',
        options: ['Mass Effect', 'Dead Space', 'Halo', 'Star Wars: Knights of the Old Republic'],
        correctAnswer: 'Mass Effect',
        acceptableAnswers: ['Mass Effect', 'Масс Эффект'],
        explanation: 'Mass Effect стала признанным шедевром космической научной фантастики.',
        articleTitle: 'Mass Effect',
        articleUrl: 'https://ru.wikipedia.org/wiki/Mass_Effect',
        difficulty: 'medium',
        category: 'Видеоигры',
        pageviews: 33000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~33k просм/мес)',
      },
      {
        question: 'Как звали синего ежа — маскота компании Sega?',
        type: 'open_ended',
        options: ['Соник', 'Майлз «Тейлз» Прауэр', 'Ехидна Наклз', 'Доктор Эггман'],
        correctAnswer: 'Соник',
        acceptableAnswers: ['Соник', 'Sonic', 'Ёж Соник'],
        explanation: 'Ёж Соник был создан в 1991 году художником Наото Осимой.',
        articleTitle: 'Ёж Соник',
        articleUrl: 'https://ru.wikipedia.org/wiki/Ёж_Соник',
        difficulty: 'easy',
        category: 'Видеоигры',
        pageviews: 51000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~51k просм/мес)',
      }
    ]
  },
  {
    category: 'История',
    questions: [
      {
        question: 'В каком году произошло восстание декабристов на Сенатской площади в Санкт-Петербурге?',
        type: 'multiple_choice',
        options: ['1825 год', '1812 год', '1861 год', '1905 год'],
        correctAnswer: '1825 год',
        acceptableAnswers: ['1825', '1825 год'],
        explanation: 'Восстание декабристов произошло 14 (26) декабря 1825 года.',
        articleTitle: 'Восстание декабристов',
        articleUrl: 'https://ru.wikipedia.org/wiki/Восстание_декабристов',
        difficulty: 'easy',
        category: 'История',
        pageviews: 74000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~74k просм/мес)',
      },
      {
        question: 'Какой фараон Древнего Египта построил Великую пирамиду в Гизе?',
        type: 'multiple_choice',
        options: ['Хеопс', 'Рамсес II', 'Тутанхамон', 'Эхнатон'],
        correctAnswer: 'Хеопс',
        acceptableAnswers: ['Хеопс', 'Хуфу'],
        explanation: 'Пирамида Хеопса (Хуфу) — единственное сохранившееся чудо древнего мира.',
        articleTitle: 'Пирамида Хеопса',
        articleUrl: 'https://ru.wikipedia.org/wiki/Пирамида_Хеопса',
        difficulty: 'easy',
        category: 'История',
        pageviews: 88000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~88k просм/мес)',
      },
      {
        question: 'Кто был последним императором Российской империи, отрекшимся от престола в 1917 году?',
        type: 'open_ended',
        options: ['Николай II', 'Александр III', 'Николай I', 'Александр II'],
        correctAnswer: 'Николай II',
        acceptableAnswers: ['Николай II', 'Николай Второй', 'Николай Романов'],
        explanation: 'Николай II отрёкся от престола 2 (15) марта 1917 года в ходе Февральской революции.',
        articleTitle: 'Николай II',
        articleUrl: 'https://ru.wikipedia.org/wiki/Николай_II',
        difficulty: 'easy',
        category: 'История',
        pageviews: 120000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~120k просм/мес)',
      },
      {
        question: 'Какое сражение 1812 года стало генеральной битвой Отечественной войны между армиями Кутузова и Наполеона?',
        type: 'multiple_choice',
        options: ['Бородинское сражение', 'Битва при Малоярославце', 'Смоленское сражение', 'Битва под Аустерлицем'],
        correctAnswer: 'Бородинское сражение',
        acceptableAnswers: ['Бородинское сражение', 'Бородино'],
        explanation: 'Бородинская битва произошла 26 августа (7 сентября) 1812 года у села Бородино.',
        articleTitle: 'Бородинское сражение',
        articleUrl: 'https://ru.wikipedia.org/wiki/Бородинское_сражение',
        difficulty: 'easy',
        category: 'История',
        pageviews: 95000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~95k просм/мес)',
      },
      {
        question: 'Какой средневековый документ 1215 года ограничил власть английского короля Иоанна Безземельного?',
        type: 'open_ended',
        options: ['Великая хартия вольностей', 'Билль о правах', 'Хабеас корпус акт', 'Золотая булла'],
        correctAnswer: 'Великая хартия вольностей',
        acceptableAnswers: ['Великая хартия вольностей', 'Magna Carta', 'Хартия вольностей'],
        explanation: 'Magna Carta стала фундаментом конституционного права Англии.',
        articleTitle: 'Великая хартия вольностей',
        articleUrl: 'https://ru.wikipedia.org/wiki/Великая_хартия_вольностей',
        difficulty: 'medium',
        category: 'История',
        pageviews: 31000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~31k просм/мес)',
      },
      {
        question: 'В каком году пала столица Византийской империи Константинополь под ударами войск султана Мехмеда II?',
        type: 'multiple_choice',
        options: ['1453 год', '1492 год', '1204 год', '1389 год'],
        correctAnswer: '1453 год',
        acceptableAnswers: ['1453', '1453 год'],
        explanation: 'Падение Константинополя 29 мая 1453 года ознаменовало конец Византии.',
        articleTitle: 'Падение Константинополя (1453)',
        articleUrl: 'https://ru.wikipedia.org/wiki/Падение_Константинополя_(1453)',
        difficulty: 'medium',
        category: 'История',
        pageviews: 52000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~52k просм/мес)',
      },
      {
        question: 'Кто был первым президентом Соединённых Штатов Америки?',
        type: 'open_ended',
        options: ['Джордж Вашингтон', 'Томас Джефферсон', 'Джон Адамс', 'Бенджамин Франклин'],
        correctAnswer: 'Джордж Вашингтон',
        acceptableAnswers: ['Джордж Вашингтон', 'Вашингтон', 'George Washington'],
        explanation: 'Джордж Вашингтон занимал пост президента США с 1789 по 1797 год.',
        articleTitle: 'Вашингтон, Джордж',
        articleUrl: 'https://ru.wikipedia.org/wiki/Вашингтон,_Джордж',
        difficulty: 'easy',
        category: 'История',
        pageviews: 73000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~73k просм/мес)',
      },
      {
        question: 'Какая французская героиня Столетней войны сняла осаду с Орлеана в 1429 году?',
        type: 'multiple_choice',
        options: ['Жанна д’Арк', 'Мария Антуанетта', 'Екатерина Медичи', 'Элеонора Аквитанская'],
        correctAnswer: 'Жанна д’Арк',
        acceptableAnswers: ['Жанна д’Арк', 'Жанна д Арк', 'Орлеанская дева'],
        explanation: 'Жанна д’Арк — национальная героиня Франции и святая католической церкви.',
        articleTitle: 'Жанна д’Арк',
        articleUrl: 'https://ru.wikipedia.org/wiki/Жанна_д’Арк',
        difficulty: 'easy',
        category: 'История',
        pageviews: 81000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~81k просм/мес)',
      }
    ]
  },
  {
    category: 'Наука',
    questions: [
      {
        question: 'Какая элементарная частица имеет отрицательный электрический заряд и вращается вокруг ядра атома?',
        type: 'multiple_choice',
        options: ['Электрон', 'Протон', 'Нейтрон', 'Позитрон'],
        correctAnswer: 'Электрон',
        acceptableAnswers: ['Электрон', 'Electron'],
        explanation: 'Электрон был открыт британским физиком Дж. Дж. Томсоном в 1897 году.',
        articleTitle: 'Электрон',
        articleUrl: 'https://ru.wikipedia.org/wiki/Электрон',
        difficulty: 'easy',
        category: 'Наука',
        pageviews: 52000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~52k просм/мес)',
      },
      {
        question: 'Какая температура в градусах Цельсия соответствует абсолютному нулю?',
        type: 'multiple_choice',
        options: ['-273,15 °C', '-200 °C', '-100 °C', '-373,15 °C'],
        correctAnswer: '-273,15 °C',
        acceptableAnswers: ['-273.15', '-273,15', '-273,15 °C', '-273'],
        explanation: 'Абсолютный ноль — минимальный теоретический предел температуры (0 Кельвинов).',
        articleTitle: 'Абсолютный ноль',
        articleUrl: 'https://ru.wikipedia.org/wiki/Абсолютный_ноль',
        difficulty: 'easy',
        category: 'Наука',
        pageviews: 46000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~46k просм/мес)',
      },
      {
        question: 'Какая кислота содержится в желудочном соке человека для расщепления белков?',
        type: 'open_ended',
        options: ['Соляная кислота', 'Серная кислота', 'Азотная кислота', 'Уксусная кислота'],
        correctAnswer: 'Соляная кислота',
        acceptableAnswers: ['Соляная кислота', 'Хлороводородная кислота', 'HCl'],
        explanation: 'Соляная кислота создаёт кислую среду для работы фермента пепсина.',
        articleTitle: 'Соляная кислота',
        articleUrl: 'https://ru.wikipedia.org/wiki/Соляная_кислота',
        difficulty: 'medium',
        category: 'Наука',
        pageviews: 34000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~34k просм/мес)',
      },
      {
        question: 'Какой физический закон утверждает, что сила тока в проводнике прямо пропорциональна напряжению и обратно пропорциональна сопротивлению?',
        type: 'multiple_choice',
        options: ['Закон Ома', 'Закон Кулона', 'Закон Джоуля — Ленца', 'Закон Ампера'],
        correctAnswer: 'Закон Ома',
        acceptableAnswers: ['Закон Ома', 'Ом'],
        explanation: 'Закон Ома был сформулирован Георгом Омом в 1826 году: I = U / R.',
        articleTitle: 'Закон Ома',
        articleUrl: 'https://ru.wikipedia.org/wiki/Закон_Ома',
        difficulty: 'easy',
        category: 'Наука',
        pageviews: 48000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~48k просм/мес)',
      },
      {
        question: 'Какое астрономическое явление доказало общую теорию относительности Эйнштейна во время солнечного затмения 1919 года Артуром Эддингтоном?',
        type: 'open_ended',
        options: ['Гравитационное линзирование', 'Красное смещение', 'Эффект Доплера', 'Реликтовое излучение'],
        correctAnswer: 'Гравитационное линзирование',
        acceptableAnswers: ['Гравитационное линзирование', 'Искривление света', 'Гравитационное отклонение света'],
        explanation: 'Экспедиция Эддингтона зафиксировала отклонение лучей света звёзд гравитационным полем Солнца.',
        articleTitle: 'Гравитационное линзирование',
        articleUrl: 'https://ru.wikipedia.org/wiki/Гравитационное_линзирование',
        difficulty: 'hard',
        category: 'Наука',
        pageviews: 19000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~19k просм/мес)',
      }
    ]
  },
  {
    category: 'География',
    questions: [
      {
        question: 'Какое государство в мире занимает первое место по площади территории?',
        type: 'multiple_choice',
        options: ['Россия', 'Канада', 'Китай', 'США'],
        correctAnswer: 'Россия',
        acceptableAnswers: ['Россия', 'Российская Федерация'],
        explanation: 'Площадь России составляет более 17,1 миллиона квадратных километров.',
        articleTitle: 'Россия',
        articleUrl: 'https://ru.wikipedia.org/wiki/Россия',
        difficulty: 'easy',
        category: 'География',
        pageviews: 220000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~220k просм/мес)',
      },
      {
        question: 'Какая пустыня является крупнейшей жаркой пустыней на Земле?',
        type: 'multiple_choice',
        options: ['Сахара', 'Гоби', 'Калахари', 'Аравийская пустыня'],
        correctAnswer: 'Сахара',
        acceptableAnswers: ['Сахара', 'Sahara'],
        explanation: 'Сахара занимает более 9 миллионов км² на севере Африки.',
        articleTitle: 'Сахара',
        articleUrl: 'https://ru.wikipedia.org/wiki/Сахара',
        difficulty: 'easy',
        category: 'География',
        pageviews: 61000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~61k просм/мес)',
      },
      {
        question: 'Какой пролив отделяет Африку от Пиренейского полуострова Европы?',
        type: 'open_ended',
        options: ['Гибралтарский пролив', 'Босфор', 'Дарданеллы', 'Магелланов пролив'],
        correctAnswer: 'Гибралтарский пролив',
        acceptableAnswers: ['Гибралтарский пролив', 'Гибралтар'],
        explanation: 'Гибралтарский пролив соединяет Атлантический океан со Средиземным морем.',
        articleTitle: 'Гибралтарский пролив',
        articleUrl: 'https://ru.wikipedia.org/wiki/Гибралтарский_пролив',
        difficulty: 'easy',
        category: 'География',
        pageviews: 42000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~42k просм/мес)',
      },
      {
        question: 'Какая высочайшая горная вершина мира имеет высоту 8848 метров над уровнем моря?',
        type: 'open_ended',
        options: ['Джомолунгма', 'К2 (Чогори)', 'Канченджанга', 'Лхоцзе'],
        correctAnswer: 'Джомолунгма',
        acceptableAnswers: ['Джомолунгма', 'Эверест', 'Everest'],
        explanation: 'Джомолунгма (Эверест) расположена в Гималаях на границе Непала и Китая.',
        articleTitle: 'Джомолунгма',
        articleUrl: 'https://ru.wikipedia.org/wiki/Джомолунгма',
        difficulty: 'easy',
        category: 'География',
        pageviews: 110000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~110k просм/мес)',
      },
      {
        question: 'Какой океан является самым маленьким и холодным по площади на Земле?',
        type: 'multiple_choice',
        options: ['Северный Ледовитый океан', 'Индийский океан', 'Атлантический океан', 'Южный океан'],
        correctAnswer: 'Северный Ледовитый океан',
        acceptableAnswers: ['Северный Ледовитый океан', 'Северный Ледовитый'],
        explanation: 'Северный Ледовитый океан расположен полностью в северном полушарии.',
        articleTitle: 'Северный Ледовитый океан',
        articleUrl: 'https://ru.wikipedia.org/wiki/Северный_Ледовитый_океан',
        difficulty: 'easy',
        category: 'География',
        pageviews: 45000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~45k просм/мес)',
      }
    ]
  },
  {
    category: 'Космос',
    questions: [
      {
        question: 'Какая планета Солнечной системы находится ближе всего к Солнцу?',
        type: 'multiple_choice',
        options: ['Меркурий', 'Венера', 'Марс', 'Земля'],
        correctAnswer: 'Меркурий',
        acceptableAnswers: ['Меркурий', 'Mercury'],
        explanation: 'Меркурий обращается вокруг Солнца всего за 88 земных суток.',
        articleTitle: 'Меркурий',
        articleUrl: 'https://ru.wikipedia.org/wiki/Меркурий',
        difficulty: 'easy',
        category: 'Космос',
        pageviews: 65000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~65k просм/мес)',
      },
      {
        question: 'Как называется гигантский потухший щитовой вулкан на Марсе высотой 21,9 км — высочайшая гора в Солнечной системе?',
        type: 'open_ended',
        options: ['Олимп', 'Элизий', 'Арсия', 'Павлинья гора'],
        correctAnswer: 'Олимп',
        acceptableAnswers: ['Олимп', 'Гора Олимп', 'Olympus Mons'],
        explanation: 'Вулкан Олимп на Марсе более чем в два с половиной раза превышает высоту Эвереста.',
        articleTitle: 'Олимп (Марс)',
        articleUrl: 'https://ru.wikipedia.org/wiki/Олимп_(Марс)',
        difficulty: 'medium',
        category: 'Космос',
        pageviews: 38000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~38k просм/мес)',
      },
      {
        question: 'Какой советский космонавт совершил первый в истории человечества выход в открытый космос 18 марта 1965 года?',
        type: 'multiple_choice',
        options: ['Алексей Леонов', 'Юрий Гагарин', 'Герман Титов', 'Валентина Терешкова'],
        correctAnswer: 'Алексей Леонов',
        acceptableAnswers: ['Алексей Леонов', 'Леонов'],
        explanation: 'Алексей Леонов провёл в открытом космическом пространстве 12 минут и 9 секунд.',
        articleTitle: 'Леонов, Алексей Архипович',
        articleUrl: 'https://ru.wikipedia.org/wiki/Леонов,_Алексей_Архипович',
        difficulty: 'easy',
        category: 'Космос',
        pageviews: 59000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~59k просм/мес)',
      },
      {
        question: 'Какая галактика является ближайшей к Млечному Пути крупной спиральной галактикой?',
        type: 'open_ended',
        options: ['Галактика Андромеды', 'Галактика Треугольника', 'Большое Магелланово Облако', 'Галактика Сомбреро'],
        correctAnswer: 'Галактика Андромеды',
        acceptableAnswers: ['Галактика Андромеды', 'Андромеда', 'M31', 'Туманность Андромеды'],
        explanation: 'Галактика Андромеды (M31) находится на расстоянии около 2,5 миллионов световых лет.',
        articleTitle: 'Галактика Андромеды',
        articleUrl: 'https://ru.wikipedia.org/wiki/Галактика_Андромеды',
        difficulty: 'easy',
        category: 'Космос',
        pageviews: 77000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~77k просм/мес)',
      }
    ]
  },
  {
    category: 'Литература',
    questions: [
      {
        question: 'Кто написал трагедию «Гамлет, принц датский»?',
        type: 'multiple_choice',
        options: ['Уильям Шекспир', 'Кристофер Марло', 'Джон Мильтон', 'Джефри Чосер'],
        correctAnswer: 'Уильям Шекспир',
        acceptableAnswers: ['Уильям Шекспир', 'Шекспир'],
        explanation: '«Гамлет» — одна из самых знаменитых пьес Уильяма Шекспира.',
        articleTitle: 'Гамлет',
        articleUrl: 'https://ru.wikipedia.org/wiki/Гамлет',
        difficulty: 'easy',
        category: 'Литература',
        pageviews: 83000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~83k просм/мес)',
      },
      {
        question: 'Какой русский писатель создал роман «Герой нашего времени» с главным персонажем Григорием Печориным?',
        type: 'multiple_choice',
        options: ['Михаил Лермонтов', 'Александр Пушкин', 'Иван Тургенев', 'Николай Гоголь'],
        correctAnswer: 'Михаил Лермонтов',
        acceptableAnswers: ['Михаил Лермонтов', 'Лермонтов'],
        explanation: '«Герой нашего времени» — первый социально-психологический роман в русской литературе.',
        articleTitle: 'Герой нашего времени',
        articleUrl: 'https://ru.wikipedia.org/wiki/Герой_нашего_времени',
        difficulty: 'easy',
        category: 'Литература',
        pageviews: 89000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~89k просм/мес)',
      },
      {
        question: 'Как звали гигантского белого кита в романе Германа Мелвилла?',
        type: 'open_ended',
        options: ['Моби Дик', 'Белый Клык', 'Старик и море', 'Морской волк'],
        correctAnswer: 'Моби Дик',
        acceptableAnswers: ['Моби Дик', 'Moby Dick'],
        explanation: 'Роман Германа Мелвилла «Моби Дик, или Белый кит» опубликован в 1851 году.',
        articleTitle: 'Моби Дик',
        articleUrl: 'https://ru.wikipedia.org/wiki/Моби_Дик',
        difficulty: 'easy',
        category: 'Литература',
        pageviews: 44000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~44k просм/мес)',
      }
    ]
  },
  {
    category: 'Биология',
    questions: [
      {
        question: 'Какая кислота хранит генетическую информацию в клетках большинства живых организмов?',
        type: 'multiple_choice',
        options: ['ДНК', 'РНК', 'АТФ', 'Аминокислота'],
        correctAnswer: 'ДНК',
        acceptableAnswers: ['ДНК', 'Дезоксирибонуклеиновая кислота', 'DNA'],
        explanation: 'Структура двойной спирали ДНК была открыта Уотсоном и Криком в 1953 году.',
        articleTitle: 'ДНК',
        articleUrl: 'https://ru.wikipedia.org/wiki/ДНК',
        difficulty: 'easy',
        category: 'Биология',
        pageviews: 79000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~79k просм/мес)',
      },
      {
        question: 'Как называется кровеносный сосуд, несущий кровь от сердца к органам и тканям?',
        type: 'multiple_choice',
        options: ['Артерия', 'Вена', 'Капилляр', 'Венула'],
        correctAnswer: 'Артерия',
        acceptableAnswers: ['Артерия', 'Артерии'],
        explanation: 'Артерии выдерживают высокое кровяное давление благодаря эластичным стенкам.',
        articleTitle: 'Артерия',
        articleUrl: 'https://ru.wikipedia.org/wiki/Артерия',
        difficulty: 'easy',
        category: 'Биология',
        pageviews: 31000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~31k просм/мес)',
      },
      {
        question: 'Как называется процесс деления соматических клеток эукариот с сохранением числа хромосом?',
        type: 'open_ended',
        options: ['Митоз', 'Мейоз', 'Амитоз', 'Цитокинез'],
        correctAnswer: 'Митоз',
        acceptableAnswers: ['Митоз', 'Mitosis'],
        explanation: 'Митоз обеспечивает бесполое размножение клеток тела и регенерацию тканей.',
        articleTitle: 'Митоз',
        articleUrl: 'https://ru.wikipedia.org/wiki/Митоз',
        difficulty: 'medium',
        category: 'Биология',
        pageviews: 42000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~42k просм/мес)',
      }
    ]
  },
  {
    category: 'Искусство',
    questions: [
      {
        question: 'Кто создал всемирно известную скульптуру «Давид» из цельного куска мрамора в 1504 году?',
        type: 'multiple_choice',
        options: ['Микеланджело Буонарроти', 'Донателло', 'Бернини', 'Леонардо да Винчи'],
        correctAnswer: 'Микеланджело Буонарроти',
        acceptableAnswers: ['Микеланджело', 'Микеланджело Буонарроти'],
        explanation: 'Шедевр Высокого Возрождения «Давид» Микеланджело хранится в Академии изящных искусств во Флоренции.',
        articleTitle: 'Давид (Микеланджело)',
        articleUrl: 'https://ru.wikipedia.org/wiki/Давид_(Микеланджело)',
        difficulty: 'easy',
        category: 'Искусство',
        pageviews: 64000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~64k просм/мес)',
      },
      {
        question: 'Какое художественное направление возглавил Клод Моне своей картиной «Впечатление. Восходящее солнце» (1872)?',
        type: 'open_ended',
        options: ['Импрессионизм', 'Кубизм', 'Сюрреализм', 'Экспрессионизм'],
        correctAnswer: 'Импрессионизм',
        acceptableAnswers: ['Импрессионизм', 'Impressionism'],
        explanation: 'Название стиля «импрессионизм» произошло от французского слова «impression» (впечатление).',
        articleTitle: 'Импрессионизм',
        articleUrl: 'https://ru.wikipedia.org/wiki/Импрессионизм',
        difficulty: 'easy',
        category: 'Искусство',
        pageviews: 58000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~58k просм/мес)',
      },
      {
        question: 'Кто написал картину «Девочка с персиками» (1887) в усадьбе Абрамцево?',
        type: 'multiple_choice',
        options: ['Валентин Серов', 'Илья Репин', 'Исаак Левитан', 'Константин Коровин'],
        correctAnswer: 'Валентин Серов',
        acceptableAnswers: ['Валентин Серов', 'Серов'],
        explanation: 'На картине изображена 11-летняя Вера Мамонтова, дочь мецената Саввы Мамонтова.',
        articleTitle: 'Девочка с персиками',
        articleUrl: 'https://ru.wikipedia.org/wiki/Девочка_с_персиками',
        difficulty: 'easy',
        category: 'Искусство',
        pageviews: 49000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~49k просм/мес)',
      }
    ]
  },
  {
    category: 'Кино',
    questions: [
      {
        question: 'Какой режиссёр снял фильм «Титаник» (1997) и «Аватар» (2009)?',
        type: 'multiple_choice',
        options: ['Джеймс Кэмерон', 'Стивен Спилберг', 'Джордж Лукас', 'Мартин Скорсезе'],
        correctAnswer: 'Джеймс Кэмерон',
        acceptableAnswers: ['Джеймс Кэмерон', 'Кэмерон', 'James Cameron'],
        explanation: 'Джеймс Кэмерон — первый режиссёр в истории, чьи фильмы собрали более 2 миллиардов долларов в прокате.',
        articleTitle: 'Кэмерон, Джеймс',
        articleUrl: 'https://ru.wikipedia.org/wiki/Кэмерон,_Джеймс',
        difficulty: 'easy',
        category: 'Кино',
        pageviews: 65000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~65k просм/мес)',
      },
      {
        question: 'Кто сыграл главную роль Нео в культовой научно-фантастической трилогии «Матрица»?',
        type: 'open_ended',
        options: ['Киану Ривз', 'Хьюго Уивинг', 'Лоренс Фишберн', 'Мэтт Дэймон'],
        correctAnswer: 'Киану Ривз',
        acceptableAnswers: ['Киану Ривз', 'Киану', 'Keanu Reeves'],
        explanation: 'Киану Ривз исполнил роль избранного Томаса Андерсона (Нео) в фильмах сестёр Вачовски.',
        articleTitle: 'Ривз, Киану',
        articleUrl: 'https://ru.wikipedia.org/wiki/Ривз,_Киану',
        difficulty: 'easy',
        category: 'Кино',
        pageviews: 87000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~87k просм/мес)',
      },
      {
        question: 'Какой советский кинорежиссёр снял фильмы «Иваново детство», «Андрей Рублёв», «Солярис» и «Сталкер»?',
        type: 'multiple_choice',
        options: ['Андрей Тарковский', 'Сергей Эйзенштейн', 'Михаил Калатозов', 'Сергей Бондарчук'],
        correctAnswer: 'Андрей Тарковский',
        acceptableAnswers: ['Андрей Тарковский', 'Тарковский'],
        explanation: 'Андрей Тарковский признан одним из величайших мастеров мирового авторского кинематографа.',
        articleTitle: 'Тарковский, Андрей Арсеньевич',
        articleUrl: 'https://ru.wikipedia.org/wiki/Тарковский,_Андрей_Арсеньевич',
        difficulty: 'medium',
        category: 'Кино',
        pageviews: 53000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~53k просм/мес)',
      }
    ]
  },
  {
    category: 'Спорт',
    questions: [
      {
        question: 'Какой аргентинский футболист стал 8-кратным обладателем награды «Золотой мяч» и выиграл Чемпионат мира 2022 года?',
        type: 'multiple_choice',
        options: ['Лионель Месси', 'Криштиану Роналду', 'Диего Марадона', 'Неймар'],
        correctAnswer: 'Лионель Месси',
        acceptableAnswers: ['Лионель Месси', 'Месси', 'Lionel Messi'],
        explanation: 'Лионель Месси — рекордсмен по числу индивидуальных и командных футбольных наград.',
        articleTitle: 'Месси, Лионель',
        articleUrl: 'https://ru.wikipedia.org/wiki/Месси,_Лионель',
        difficulty: 'easy',
        category: 'Спорт',
        pageviews: 135000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~135k просм/мес)',
      },
      {
        question: 'Какой американский пловец завоевал рекордные 23 золотые олимпийские медали в истории спорта?',
        type: 'open_ended',
        options: ['Майкл Фелпс', 'Марк Спитц', 'Иан Торп', 'Райан Лохте'],
        correctAnswer: 'Майкл Фелпс',
        acceptableAnswers: ['Майкл Фелпс', 'Фелпс', 'Michael Phelps'],
        explanation: 'Майкл Фелпс — самый титулованный олимпиец всех времён (28 медалей всего).',
        articleTitle: 'Фелпс, Майкл',
        articleUrl: 'https://ru.wikipedia.org/wiki/Фелпс,_Майкл',
        difficulty: 'easy',
        category: 'Спорт',
        pageviews: 39000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~39k просм/мес)',
      },
      {
        question: 'Какой советский вратарь — единственный голкипер в истории футбола, получивший «Золотой мяч» (1963)?',
        type: 'multiple_choice',
        options: ['Лев Яшин', 'Дино Дзофф', 'Гордон Бэнкс', 'Зепп Майер'],
        correctAnswer: 'Лев Яшин',
        acceptableAnswers: ['Лев Яшин', 'Яшин', 'Чёрная пантера'],
        explanation: 'Лев Иванович Яшин выступал за московское «Динамо» и сборную СССР.',
        articleTitle: 'Яшин, Лев Иванович',
        articleUrl: 'https://ru.wikipedia.org/wiki/Яшин,_Лев_Иванович',
        difficulty: 'easy',
        category: 'Спорт',
        pageviews: 56000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~56k просм/мес)',
      }
    ]
  },
  {
    category: 'Мифология',
    questions: [
      {
        question: 'Какой герой древнегреческих мифов совершил 12 знаменитых подвигов по приказу царя Эврисфея?',
        type: 'multiple_choice',
        options: ['Геракл', 'Тесей', 'Персей', 'Ясон'],
        correctAnswer: 'Геракл',
        acceptableAnswers: ['Геракл', 'Геркулес', 'Hercules'],
        explanation: 'Среди подвигов Геракла: удушение Немейского льва, очистка Авгиевых конюшен и похищение яблок Гесперид.',
        articleTitle: 'Геракл',
        articleUrl: 'https://ru.wikipedia.org/wiki/Геракл',
        difficulty: 'easy',
        category: 'Мифология',
        pageviews: 86000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~86k просм/мес)',
      },
      {
        question: 'Как звали скандинавского верховного бога мудрости и войны, восседавшего на троне Хлидскьяльв с воронами Хугином и Мунином?',
        type: 'open_ended',
        options: ['Один', 'Тор', 'Локи', 'Фрейр'],
        correctAnswer: 'Один',
        acceptableAnswers: ['Один', 'Odin', 'Вотан'],
        explanation: 'Один отдал свой глаз, чтобы испить из источника мудрости Мимира.',
        articleTitle: 'Один (мифология)',
        articleUrl: 'https://ru.wikipedia.org/wiki/Один_(мифология)',
        difficulty: 'easy',
        category: 'Мифология',
        pageviews: 69000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~69k просм/мес)',
      },
      {
        question: 'Какое чудовище с головой быка и телом человека обитало в Критском лабиринте и было побеждено Тесеем?',
        type: 'multiple_choice',
        options: ['Минотавр', 'Кентавр', 'Химера', 'Сфинкс'],
        correctAnswer: 'Минотавр',
        acceptableAnswers: ['Минотавр', 'Minotaur'],
        explanation: 'Тесей выбрался из лабиринта Минотавра с помощью путеводной нити Ариадны.',
        articleTitle: 'Минотавр',
        articleUrl: 'https://ru.wikipedia.org/wiki/Минотавр',
        difficulty: 'easy',
        category: 'Мифология',
        pageviews: 55000,
        popularityTier: 'top_tier',
        popularityLabel: 'Топ-статья Википедии (~55k просм/мес)',
      }
    ]
  }
];

// Flat items
const categoryGenerated: WikiQuestion[] = [];
let catIdx = 0;
for (const cat of categoriesData) {
  for (const q of cat.questions) {
    catIdx++;
    categoryGenerated.push({
      ...q,
      id: `gen-cat-${catIdx}`,
    });
  }
}

/**
 * Optional AI batch generator for Russian Wikipedia articles
 * Uses gemini-2.5-flash-lite and inserts a 4.5 second delay before each call to avoid rate limits
 */
export async function generateQuestionWithAI(
  ai: GoogleGenAI,
  topic: string,
  category: string
): Promise<WikiQuestion | null> {
  console.log(`[Rate-Limit Guard] Waiting ${API_CALL_DELAY_MS}ms before requesting Gemini for "${topic}"...`);
  await delay(API_CALL_DELAY_MS);

  try {
    const prompt = `Ты — эксперт-энциклопедист русскоязычной Википедии. Создай 1 качественный вопрос по теме статьи «${topic}» (категория: ${category}).

Требования:
1. Вопрос должен иметь ровно ОДИН бесспорный и однозначный правильный ответ.
2. Ни в коем случае не упоминай правильный ответ («${topic}» или его части) в тексте самого вопроса.
3. 4 варианта ответа (1 правильный и 3 правдоподобных дистрактора из той же области).
4. Укажи explanation (1-2 предложения), difficulty ('easy', 'medium' или 'hard'), articleTitle, articleUrl.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['multiple_choice'] },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            acceptableAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
            articleTitle: { type: Type.STRING },
            articleUrl: { type: Type.STRING },
          },
          required: ['question', 'type', 'options', 'correctAnswer', 'explanation', 'difficulty', 'articleTitle', 'articleUrl'],
        },
      },
    });

    const text = response.text?.trim();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      id: `ai-gen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category,
      pageviews: 40000,
      popularityTier: 'top_tier',
      popularityLabel: 'Топ-статья Википедии',
      ...parsed,
    };
  } catch (err) {
    console.error(`Failed to generate question for topic "${topic}":`, err);
    return null;
  }
}

// Text normalization helper for similarity checking
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»""''„“`.,\/#!$%\^&\*;:{}=\-_`~()?—–\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWordTokens(text: string): Set<string> {
  const words = normalizeText(text).split(' ').filter((w) => w.length > 2);
  return new Set(words);
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function bigramDiceSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const [bg, count1] of b1) {
    if (b2.has(bg)) {
      intersection += Math.min(count1, b2.get(bg)!);
    }
  }
  const total = (s1.length - 1) + (s2.length - 1);
  return (2 * intersection) / total;
}

function findSimilarQuestion(
  targetQ: WikiQuestion,
  existingList: WikiQuestion[]
): { isSimilar: boolean; match?: WikiQuestion; reason?: string } {
  const normTargetQ = normalizeText(targetQ.question);
  const targetTokens = getWordTokens(targetQ.question);
  const normTargetAns = normalizeText(targetQ.correctAnswer || '');

  for (const item of existingList) {
    const normItemQ = normalizeText(item.question);

    if (normTargetQ === normItemQ) {
      return { isSimilar: true, match: item, reason: 'Exact question match' };
    }

    const dice = bigramDiceSimilarity(targetQ.question, item.question);
    if (dice >= 0.72) {
      return { isSimilar: true, match: item, reason: `High text similarity (${Math.round(dice * 100)}%)` };
    }

    const itemTokens = getWordTokens(item.question);
    const jaccard = jaccardSimilarity(targetTokens, itemTokens);
    if (jaccard >= 0.65) {
      return { isSimilar: true, match: item, reason: `High word overlap (${Math.round(jaccard * 100)}%)` };
    }

    const normItemAns = normalizeText(item.correctAnswer || '');
    if (normTargetAns && normItemAns && normTargetAns === normItemAns) {
      if (jaccard >= 0.45 || dice >= 0.50) {
        return {
          isSimilar: true,
          match: item,
          reason: `Same answer with question overlap (${Math.round((jaccard || dice) * 100)}%)`,
        };
      }
    }
  }

  return { isSimilar: false };
}

// Read existing generated questions bank first to append without overwriting
let existingFile: WikiQuestion[] = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      existingFile = parsed;
    }
  } catch (err) {
    console.warn('⚠️ Could not parse existing generated-questions.json, starting with clean list:', err);
  }
}

// Preserve all existing file questions, then append categorized seed & fallback questions
const combinedList: WikiQuestion[] = [...existingFile];
const map = new Map<string, WikiQuestion>();
const initialCount = existingFile.length;

// 1. Keep all existing questions already saved
existingFile.forEach((q) => {
  const norm = q.question.toLowerCase().trim();
  if (norm && !map.has(norm)) {
    map.set(norm, q);
  }
});

// 2. Append new questions from seed categories and fallbacks with similarity checks
let skippedSimilar = 0;
[...categoryGenerated, ...comprehensiveFallbackQuestions].forEach((q, i) => {
  const norm = q.question.toLowerCase().trim();
  if (!norm) return;

  const simCheck = findSimilarQuestion(q, combinedList);
  if (simCheck.isSimilar) {
    skippedSimilar++;
    return;
  }

  if (!map.has(norm)) {
    const item: WikiQuestion = {
      ...q,
      id: q.id || `bank-q-${i + 1}`,
      pageviews: q.pageviews || 35000,
      popularityTier: q.popularityTier || 'top_tier',
      popularityLabel: q.popularityLabel || 'Популярная статья Википедии',
    };
    map.set(norm, item);
    combinedList.push(item);
  }
});

const finalBank = Array.from(map.values());
fs.writeFileSync(DATA_FILE, JSON.stringify(finalBank, null, 2), 'utf-8');
console.log(`[Question Bank Seeder] Initial existing questions: ${initialCount}`);
console.log(`[Question Bank Seeder] Appended items total: ${finalBank.length} questions in ${DATA_FILE} (skipped ${skippedSimilar} similar)`);
console.log(`[Question Bank Seeder] Model configured: ${GEMINI_MODEL}`);
console.log(`[Question Bank Seeder] Inter-call rate-limiting delay: ${API_CALL_DELAY_MS}ms (4.5s)`);
