export interface WikiCategoryItem {
  id: string;
  label: string;
  iconName: string;
  description: string;
}

export const DEFAULT_WIKI_CATEGORIES: WikiCategoryItem[] = [
  {
    id: 'all',
    label: 'Случайные темы',
    iconName: 'Sparkles',
    description: 'Вопросы по всей русскоязычной Википедии',
  },
  {
    id: 'Видеоигры',
    label: 'Видеоигры и гейминг',
    iconName: 'Gamepad2',
    description: 'Культовые франшизы, студии, персонажи и история гейминга',
  },
  {
    id: 'История',
    label: 'История и эпохи',
    iconName: 'Landmark',
    description: 'Великие цивилизации, правители, войны и мирные договоры',
  },
  {
    id: 'Наука',
    label: 'Наука и открытия',
    iconName: 'Atom',
    description: 'Физика, химия, математика и великие изобретения',
  },
  {
    id: 'География',
    label: 'География и страны',
    iconName: 'Globe',
    description: 'Города, горы, реки, океаны и столицы мира',
  },
  {
    id: 'Космос',
    label: 'Космос и астрономия',
    iconName: 'Rocket',
    description: 'Планеты, звёзды, чёрные дыры и исследование Вселенной',
  },
  {
    id: 'Литература',
    label: 'Литература и книги',
    iconName: 'BookOpen',
    description: 'Классические и современные произведения, авторы и сюжеты',
  },
  {
    id: 'Биология',
    label: 'Биология и природа',
    iconName: 'Dna',
    description: 'Животные, растения, анатомия человека и эволюция',
  },
  {
    id: 'Искусство',
    label: 'Искусство и культура',
    iconName: 'Palette',
    description: 'Живопись, скульптура, архитектура и шедевры',
  },
  {
    id: 'Кино',
    label: 'Кино и театр',
    iconName: 'Film',
    description: 'Режиссёры, культовые фильмы, премии и постановки',
  },
  {
    id: 'Спорт',
    label: 'Спорт и рекорды',
    iconName: 'Trophy',
    description: 'Олимпийские игры, чемпионы и легендарные матчи',
  },
  {
    id: 'Мифология',
    label: 'Мифы и легенды',
    iconName: 'Scroll',
    description: 'Древние боги, предания и фольклор народов мира',
  },
];
