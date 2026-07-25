export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type TaskCategory = 'school' | 'homework' | 'sport' | 'hobby' | 'chore' | 'meal' | 'sleep' | 'free' | 'other';
export type PdfBasis = 'daily' | 'weekly' | 'monthly' | 'template' | 'grid';

export interface KidsTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  days: DayOfWeek[];
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  emoji: string;
  color: string;
  childName: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

export interface KidsPdfOptions {
  basis: PdfBasis;
  childName: string;
  selectedMonth: number;   // 0-11
  selectedYear: number;
  weekStartDate: string;   // ISO date string
}

export const CATEGORY_META: Record<TaskCategory, { label: string; emoji: string; color: string }> = {
  school:   { label: 'School',    emoji: '🏫', color: '#4A90D9' },
  homework: { label: 'Homework',  emoji: '📚', color: '#7B68EE' },
  sport:    { label: 'Sport',     emoji: '⚽', color: '#50C878' },
  hobby:    { label: 'Hobby',     emoji: '🎨', color: '#FF8C94' },
  chore:    { label: 'Chore',     emoji: '🧹', color: '#FFB347' },
  meal:     { label: 'Meal',      emoji: '🍽️', color: '#FF6B6B' },
  sleep:    { label: 'Sleep',     emoji: '😴', color: '#87CEEB' },
  free:     { label: 'Free Time', emoji: '🎮', color: '#98FB98' },
  other:    { label: 'Other',     emoji: '⭐', color: '#DDA0DD' },
};

export const DAYS: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
