// Local fallback type to avoid missing import during build
export interface WheelTemplate {
  id: string
  name: string
  description?: string
  type?: string
  options?: string[]
  icon?: string
  color?: string
}

interface WheelSlice {
  id: string
  text: string
  color: string
  emoji?: string
}

export interface WheelType {
  id: string
  name: string
  description: string
  generateSlices: () => WheelSlice[]
  defaultName: string
  themeOverrides?: {
    primary?: string
    secondary?: string
    background?: string
    surface?: string
    text?: string
    textSecondary?: string
    error?: string
    success?: string
    border?: string
  }
}

export const predefinedColors = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Light Blue
  "#96CEB4", // Mint Green
  "#FFEAA7", // Light Yellow
  "#DDA0DD", // Plum
  "#FFB6C1", // Light Pink
  "#98D8C8", // Seafoam Green
  "#F7DC6F", // Gold
  "#BB8FCE", // Lavender
  "#85C1E9", // Sky Blue
  "#82E0AA", // Light Green
  "#FF9F1C", // Orange
  "#2EC4B6", // Dark Teal
  "#E71D36", // Crimson
  "#F7B801", // Amber
  "#A9E5BB", // Pale Green
  "#5D5D81", // Dark Purple
]

export const wheelTemplates: WheelTemplate[] = [
  {
    id: "basic-decision",
    name: "Basic Decision Maker",
    description: "A simple wheel for making quick decisions.",
    type: "decision",
    options: ["Yes", "No", "Maybe"],
    icon: "questionmark.circle.fill",
    color: "#4CAF50",
  },
  {
    id: "food-picker",
    name: "What to Eat?",
    description: "Can't decide what to eat? Let the wheel decide!",
    type: "food",
    options: ["Pizza", "Burgers", "Sushi", "Tacos", "Pasta", "Salad"],
    icon: "fork.knife",
    color: "#FFC107",
  },
  {
    id: "movie-genre",
    name: "Movie Genre Picker",
    description: "Pick a movie genre for tonight.",
    type: "entertainment",
    options: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Romance"],
    icon: "film.fill",
    color: "#2196F3",
  },
  {
    id: "team-picker",
    name: "Team Picker Wheel",
    description: "Randomly assign people to teams.",
    type: "team",
    options: ["Team A", "Team B", "Team C", "Team D"],
    icon: "person.3.fill",
    color: "#9C27B0",
  },
  {
    id: "truth-or-dare",
    name: "Truth or Dare",
    description: "A classic party game.",
    type: "game",
    options: ["Truth", "Dare"],
    icon: "sparkles",
    color: "#E91E63",
  },
  {
    id: "workout-roulette",
    name: "Workout Roulette",
    description: "Randomly select your next exercise.",
    type: "fitness",
    options: ["Push-ups", "Squats", "Plank", "Lunges", "Jumping Jacks", "Burpees"],
    icon: "dumbbell.fill",
    color: "#795548",
  },
  {
    id: "chores-assigner",
    name: "Chores Assigner",
    description: "Who's doing the dishes tonight?",
    type: "household",
    options: ["Dishes", "Laundry", "Vacuum", "Take out trash", "Clean bathroom"],
    icon: "house.fill",
    color: "#607D8B",
  },
  {
    id: "study-subject",
    name: "Study Subject Picker",
    description: "Can't decide what to study?",
    type: "education",
    options: ["Math", "Science", "History", "Literature", "Coding"],
    icon: "book.closed.fill",
    color: "#009688",
  },
]

export const wheelTypes: WheelType[] = [
  {
    id: "picker-wheel",
    name: "Picker Wheel",
    description: "A random picker wheel which will spin and make a decision for you.",
    generateSlices: () => [
      { id: "1", text: "Option A", color: predefinedColors[0] },
      { id: "2", text: "Option B", color: predefinedColors[1] },
      { id: "3", text: "Option C", color: predefinedColors[2] },
      { id: "4", text: "Option D", color: predefinedColors[3] },
    ],
    defaultName: "My Decision Wheel",
    themeOverrides: {
      primary: "#4ECDC4", // Teal
      background: "#F0F2F5",
      surface: "#FFFFFF",
      text: "#333333",
      textSecondary: "#666666",
    },
  },
  {
    id: "team-picker-wheel",
    name: "Team Picker Wheel",
    description: "This is a random team generator which will do grouping from a list of names.",
    generateSlices: () => {
      const slices: WheelSlice[] = []
      // Add group1, group2, group3
      for (let i = 1; i <= 3; i++) {
        slices.push({ id: `group${i}`, text: `group${i}`, color: predefinedColors[(i - 1) % predefinedColors.length] })
      }
      // Add Team 4 to Team 13
      for (let i = 4; i <= 13; i++) {
        slices.push({ id: `team${i}`, text: `Team ${i}`, color: predefinedColors[(i - 1) % predefinedColors.length] })
      }
      return slices
    },
    defaultName: "Team Generator",
    themeOverrides: {
      primary: "#0077B6", // Strong Blue
      background: "#E0F2F7",
      surface: "#FFFFFF",
      text: "#2C3E50",
      textSecondary: "#7F8C8D",
    },
  },
  {
    id: "yes-no-picker-wheel",
    name: "Yes No Picker Wheel",
    description: "This is a random yes or no wheel which will help you to make a yes no decision.",
    generateSlices: () => [
      { id: "1", text: "YES", color: "#28A745", emoji: "✅" }, // Green
      { id: "2", text: "NO", color: "#DC3545", emoji: "❌" }, // Red
      { id: "3", text: "MAYBE", color: "#FFC107", emoji: "🤔" }, // Yellow
    ],
    defaultName: "Yes/No Decision",
    themeOverrides: {
      primary: "#28A745", // Green
      background: "#F8F9FA",
      surface: "#FFFFFF",
      text: "#343A40",
      textSecondary: "#6C757D",
    },
  },
  {
    id: "number-picker-wheel",
    name: "Number Picker Wheel",
    description: "This is a rng tool which will help you to pick a number randomly.",
    generateSlices: () => [
      { id: "1", text: "1", color: "#6C757D" },
      { id: "2", text: "2", color: "#495057" },
      { id: "3", text: "3", color: "#343A40" },
      { id: "4", text: "4", color: "#212529" },
      { id: "5", text: "5", color: "#6C757D" },
      { id: "6", text: "6", color: "#495057" },
      { id: "7", text: "7", color: "#343A40" },
      { id: "8", text: "8", color: "#212529" },
    ],
    defaultName: "Random Number",
    themeOverrides: {
      primary: "#495057", // Dark Gray
      background: "#E9ECEF",
      surface: "#F8F9FA",
      text: "#212529",
      textSecondary: "#6C757D",
    },
  },
  {
    id: "letter-picker-wheel",
    name: "Letter Picker Wheel",
    description: "This is a random letter generator which helps to pick a random alphabet.",
    generateSlices: () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: String(i + 1),
        text: String.fromCharCode(65 + i),
        color: predefinedColors[i % predefinedColors.length],
      })),
    defaultName: "Random Letter",
    themeOverrides: {
      primary: "#BB8FCE", // Lavender
      background: "#F4F0F8",
      surface: "#FFFFFF",
      text: "#4A235A",
      textSecondary: "#8E44AD",
    },
  },
  {
    id: "country-picker-wheel",
    name: "Country Picker Wheel",
    description: "This is a random country generator which helps to pick a random country.",
    generateSlices: () => [
      { id: "1", text: "USA", color: "#3498DB" },
      { id: "2", text: "Canada", color: "#E74C3C" },
      { id: "3", text: "Mexico", color: "#2ECC71" },
      { id: "4", text: "Brazil", color: "#F1C40F" },
      { id: "5", text: "UK", color: "#9B59B6" },
      { id: "6", text: "France", color: "#1ABC9C" },
      { id: "7", text: "Germany", color: "#D35400" },
      { id: "8", text: "Japan", color: "#C0392B" },
      { id: "9", text: "Australia", color: "#2980B9" },
    ],
    defaultName: "Random Country",
    themeOverrides: {
      primary: "#27AE60", // Emerald Green
      background: "#ECF0F1",
      surface: "#FFFFFF",
      text: "#2C3E50",
      textSecondary: "#7F8C8D",
    },
  },
  {
    id: "color-picker-wheel",
    name: "Color Picker Wheel",
    description: "This is a random color wheel which helps to pick a random color.",
    generateSlices: () => [
      { id: "1", text: "Red", color: "#FF0000" },
      { id: "2", text: "Green", color: "#00FF00" },
      { id: "3", text: "Blue", color: "#0000FF" },
      { id: "4", text: "Yellow", color: "#FFFF00" },
      { id: "5", text: "Purple", color: "#800080" },
      { id: "6", text: "Orange", color: "#FFA500" },
    ],
    defaultName: "Random Color",
    themeOverrides: {
      primary: "#FF6B6B", // Red
      background: "#FFF0F0",
      surface: "#FFFFFF",
      text: "#333333",
      textSecondary: "#666666",
    },
  },
  {
    id: "image-picker-wheel",
    name: "Image Picker Wheel",
    description:
      "A random image generator which picks a random picture from pictures provided. (Text placeholders for now)",
    generateSlices: () => [
      { id: "1", text: "Image 1", color: predefinedColors[0] },
      { id: "2", text: "Image 2", color: predefinedColors[1] },
      { id: "3", text: "Image 3", color: predefinedColors[2] },
    ],
    defaultName: "Random Image",
    themeOverrides: {
      primary: "#45B7D1", // Light Blue
      background: "#EBF5FB",
      surface: "#FFFFFF",
      text: "#333333",
      textSecondary: "#666666",
    },
  },
  {
    id: "date-picker-wheel",
    name: "Date Picker Wheel",
    description: "This is a random date generator which helps to pick a random date.",
    generateSlices: () => {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      const dayAfter = new Date(today)
      dayAfter.setDate(today.getDate() + 2)
      return [
        { id: "1", text: today.toLocaleDateString(), color: predefinedColors[3] },
        { id: "2", text: tomorrow.toLocaleDateString(), color: predefinedColors[4] },
        { id: "3", text: dayAfter.toLocaleDateString(), color: predefinedColors[5] },
      ]
    },
    defaultName: "Random Date",
    themeOverrides: {
      primary: "#96CEB4", // Mint Green
      background: "#F0FFF0",
      surface: "#FFFFFF",
      text: "#333333",
      textSecondary: "#666666",
    },
  },
  {
    id: "instagram-comment-picker-wheel",
    name: "Instagram Comment Picker Wheel",
    description: "This is an Instagram giveaway generator. (Template only, no API integration)",
    generateSlices: () => [
      { id: "1", text: "Commenter A", color: "#C13584" }, // Instagram Purple
      { id: "2", text: "Commenter B", color: "#FCAF45" }, // Instagram Orange
      { id: "3", text: "Commenter C", color: "#5851DB" }, // Instagram Blue
    ],
    defaultName: "Instagram Giveaway",
    themeOverrides: {
      primary: "#C13584", // Instagram Purple
      background: "#FAFAFA",
      surface: "#FFFFFF",
      text: "#262626",
      textSecondary: "#8E8E8E",
    },
  },
  {
    id: "mlb-picker-wheel",
    name: "MLB Picker Wheel",
    description: "This is a MLB team wheel which helps to pick a random MLB team.",
    generateSlices: () => [
      { id: "1", text: "Yankees", color: "#0C2340" },
      { id: "2", text: "Dodgers", color: "#005A9C" },
      { id: "3", text: "Red Sox", color: "#BD3039" },
      { id: "4", text: "Cubs", color: "#0E3386" },
    ],
    defaultName: "MLB Team Picker",
    themeOverrides: {
      primary: "#002D62", // MLB Blue
      background: "#F0F8FF",
      surface: "#FFFFFF",
      text: "#1A1A1A",
      textSecondary: "#666666",
    },
  },
  {
    id: "nba-picker-wheel",
    name: "NBA Picker Wheel",
    description: "This is a NBA team wheel which helps to pick a random NBA team.",
    generateSlices: () => [
      { id: "1", text: "Lakers", color: "#552583" },
      { id: "2", text: "Warriors", color: "#FDB927" },
      { id: "3", text: "Celtics", color: "#007A33" },
      { id: "4", text: "Bulls", color: "#CE1141" },
    ],
    defaultName: "NBA Team Picker",
    themeOverrides: {
      primary: "#C8102E", // NBA Red
      background: "#F5F5F5",
      surface: "#FFFFFF",
      text: "#1A1A1A",
      textSecondary: "#666666",
    },
  },
  {
    id: "nfl-picker-wheel",
    name: "NFL Picker Wheel",
    description: "This is a NFL team wheel which helps to pick a random NFL team.",
    generateSlices: () => [
      { id: "1", text: "Cowboys", color: "#041E42" },
      { id: "2", text: "Patriots", color: "#002244" },
      { id: "3", text: "Packers", color: "#203731" },
      { id: "4", text: "Chiefs", color: "#E31837" },
    ],
    defaultName: "NFL Team Picker",
    themeOverrides: {
      primary: "#013369", // NFL Blue
      background: "#F0F0F0",
      surface: "#FFFFFF",
      text: "#1A1A1A",
      textSecondary: "#666666",
    },
  },
]
