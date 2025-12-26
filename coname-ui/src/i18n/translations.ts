/**
 * TRANSLATIONS
 * ============
 * 
 * Internationalization support for English and Hebrew
 */

export type Language = 'en' | 'he';

export const translations = {
  en: {
    // App
    appName: 'CoName',
    appTagline: 'Your AI Teammate for Codenames',
    
    // Welcome Page
    welcome: 'Welcome',
    startNewGame: 'Start New Game',
    continueGame: 'Continue Game',
    createProfile: 'Create Profile',
    editProfile: 'Edit Profile',
    selectRole: 'Select Your Role',
    spymaster: 'Spymaster',
    guesser: 'Guesser',
    spymasterDesc: 'Give clues to help your AI teammate guess',
    guesserDesc: 'Guess words based on your AI teammate\'s clues',
    howToPlay: 'How to Play',
    
    // Profile Page
    profileTitle: 'Player Profile',
    profileSubtitle: 'Help your AI teammate understand you better',
    age: 'Age Range',
    occupation: 'Occupation',
    occupationPlaceholder: 'e.g., Software Engineer, Student, Teacher',
    interests: 'Interests',
    interestsPlaceholder: 'e.g., Movies, Sports, Science, Music',
    thinkingStyle: 'Problem Solving Approach',
    systematic: 'Systematic',
    creative: 'Creative',
    both: 'Both',
    additionalNotes: 'Additional Notes',
    additionalNotesPlaceholder: 'Any other info that might help your AI teammate understand your clue style...',
    saveProfile: 'Save Profile',
    skip: 'Skip',
    
    // Game Page
    yourTurn: 'Your Turn',
    aiTurn: 'AI\'s Turn',
    rivalTurn: 'Rival Team\'s Turn',
    cluePhase: 'Clue Phase',
    guessPhase: 'Guess Phase',
    enterClue: 'Enter your clue',
    cluePlaceholder: 'One word clue...',
    clueNumber: 'Number',
    submitClue: 'Submit Clue',
    getAIClue: 'Get Clue from AI',
    aiThinking: 'AI is thinking...',
    currentClue: 'Current Clue',
    guessesRemaining: 'Guesses Remaining',
    endGuessing: 'End Guessing',
    passToRival: 'Pass Turn',
    
    // Score Panel
    score: 'Score',
    yourTeam: 'Your Team',
    rivalTeam: 'Rival Team',
    wordsRemaining: 'words remaining',
    
    // Game Over
    gameOver: 'Game Over',
    youWin: 'You Win! 🎉',
    youLose: 'You Lose',
    assassinHit: 'Assassin Hit!',
    playAgain: 'Play Again',
    backToMenu: 'Back to Menu',
    
    // Word Categories
    teamWord: 'Team',
    rivalWord: 'Rival',
    neutral: 'Neutral',
    assassin: 'Assassin',
    
    // Validation
    invalidClue: 'Invalid clue',
    clueMatchesBoard: 'Clue matches a word on the board',
    clueRequired: 'Please enter a clue',
    
    // General
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    settings: 'Settings',
    language: 'Language',
    english: 'English',
    hebrew: 'עברית',
    
    // Rules Tooltip
    rulesTitle: 'Codenames Rules',
    rulesContent: `
      • Find all your team's words before the rival team
      • Spymaster gives a one-word clue and a number
      • Number indicates how many words relate to the clue
      • Avoid neutral words (end turn) and rival words (help opponents)
      • Never guess the Assassin - instant loss!
    `,
    
    // Turn History
    turnHistory: 'Turn History',
    noTurnsYet: 'No turns yet',
    
    // Micro Survey
    howWasClue: 'How was this clue?',
    tooEasy: 'Too Easy',
    justRight: 'Just Right',
    tooHard: 'Too Hard',
    confusing: 'Confusing',
  },
  
  he: {
    // App
    appName: 'קונֵיים',
    appTagline: 'שותף ה-AI שלך לקודניימס',
    
    // Welcome Page
    welcome: 'ברוכים הבאים',
    startNewGame: 'משחק חדש',
    continueGame: 'המשך משחק',
    createProfile: 'צור פרופיל',
    editProfile: 'ערוך פרופיל',
    selectRole: 'בחר תפקיד',
    spymaster: 'מנהל מרגלים',
    guesser: 'מנחש',
    spymasterDesc: 'תן רמזים לעזור לשותף ה-AI שלך לנחש',
    guesserDesc: 'נחש מילים לפי הרמזים של שותף ה-AI שלך',
    howToPlay: 'איך משחקים',
    
    // Profile Page
    profileTitle: 'פרופיל שחקן',
    profileSubtitle: 'עזור לשותף ה-AI שלך להבין אותך טוב יותר',
    age: 'טווח גילאים',
    occupation: 'עיסוק',
    occupationPlaceholder: 'לדוגמה: מהנדס תוכנה, סטודנט, מורה',
    interests: 'תחומי עניין',
    interestsPlaceholder: 'לדוגמה: סרטים, ספורט, מדע, מוזיקה',
    thinkingStyle: 'גישת פתרון בעיות',
    systematic: 'שיטתי',
    creative: 'יצירתי',
    both: 'שניהם',
    additionalNotes: 'הערות נוספות',
    additionalNotesPlaceholder: 'מידע נוסף שיכול לעזור לשותף ה-AI להבין את סגנון הרמזים שלך...',
    saveProfile: 'שמור פרופיל',
    skip: 'דלג',
    
    // Game Page
    yourTurn: 'התור שלך',
    aiTurn: 'תור ה-AI',
    rivalTurn: 'תור הקבוצה היריבה',
    cluePhase: 'שלב הרמז',
    guessPhase: 'שלב הניחושים',
    enterClue: 'הכנס רמז',
    cluePlaceholder: 'רמז במילה אחת...',
    clueNumber: 'מספר',
    submitClue: 'שלח רמז',
    getAIClue: 'קבל רמז מה-AI',
    aiThinking: 'ה-AI חושב...',
    currentClue: 'הרמז הנוכחי',
    guessesRemaining: 'ניחושים נותרו',
    endGuessing: 'סיים ניחושים',
    passToRival: 'העבר תור',
    
    // Score Panel
    score: 'ניקוד',
    yourTeam: 'הקבוצה שלך',
    rivalTeam: 'קבוצה יריבה',
    wordsRemaining: 'מילים נותרו',
    
    // Game Over
    gameOver: 'המשחק נגמר',
    youWin: 'ניצחת! 🎉',
    youLose: 'הפסדת',
    assassinHit: 'פגיעה במתנקש!',
    playAgain: 'שחק שוב',
    backToMenu: 'חזרה לתפריט',
    
    // Word Categories
    teamWord: 'קבוצה',
    rivalWord: 'יריב',
    neutral: 'ניטרלי',
    assassin: 'מתנקש',
    
    // Validation
    invalidClue: 'רמז לא תקין',
    clueMatchesBoard: 'הרמז תואם למילה על הלוח',
    clueRequired: 'אנא הכנס רמז',
    
    // General
    loading: 'טוען...',
    error: 'שגיאה',
    retry: 'נסה שוב',
    cancel: 'ביטול',
    confirm: 'אישור',
    settings: 'הגדרות',
    language: 'שפה',
    english: 'English',
    hebrew: 'עברית',
    
    // Rules Tooltip
    rulesTitle: 'חוקי קודניימס',
    rulesContent: `
      • מצא את כל המילים של הקבוצה שלך לפני הקבוצה היריבה
      • מנהל המרגלים נותן רמז במילה אחת ומספר
      • המספר מציין כמה מילים קשורות לרמז
      • הימנע ממילים ניטרליות (מסיימות תור) ומילות יריב (עוזרות ליריב)
      • לעולם אל תנחש את המתנקש - הפסד מיידי!
    `,
    
    // Turn History
    turnHistory: 'היסטוריית תורות',
    noTurnsYet: 'אין תורות עדיין',
    
    // Micro Survey
    howWasClue: 'איך היה הרמז?',
    tooEasy: 'קל מדי',
    justRight: 'בדיוק נכון',
    tooHard: 'קשה מדי',
    confusing: 'מבלבל',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getTranslation(lang: Language, key: TranslationKey): string {
  return translations[lang][key] || translations.en[key] || key;
}


