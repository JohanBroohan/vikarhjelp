// Hand-written row types mirroring the SQL migrations in /supabase/migrations.
// Kept in sync with the schema by hand (the dataset is small and stable).
//
// NOTE: these MUST be `type` aliases (object-literal types), not `interface`s.
// supabase-js requires each table's Row/Insert/Update to be assignable to
// `Record<string, unknown>`; an `interface` lacks an index signature and would
// make the typed client collapse to `never`.

import type { CoverageStatus } from "./constants";

export type Teacher = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  role: string; // slug, see EMPLOYEE_ROLES (default "laerer")
  created_at: string;
};

export type Vikar = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  /** Weekdays (Mon=1..Fri=5) the vikar CANNOT work. Empty = available all days. */
  unavailable_weekdays: number[];
  created_at: string;
};

export type Lesson = {
  id: string;
  teacher_id: string;
  weekday: number; // 1..5
  period: number; // 1..PERIOD_COUNT — canonical scheduling slot
  start_time: string | null;
  end_time: string | null;
  subject: string | null;
  class_group: string | null;
  room: string | null;
  created_at: string;
};

export type Absence = {
  id: string;
  teacher_id: string;
  date: string; // ISO date (YYYY-MM-DD)
  reason: string | null;
  absence_type: string; // slug, see ABSENCE_TYPES (default "egenmelding")
  start_time: string | null; // "HH:MM"; null = whole day
  end_time: string | null; // "HH:MM"; null = whole day
  created_at: string;
};

export type CoverageAssignment = {
  id: string;
  date: string; // ISO date
  lesson_id: string;
  absent_teacher_id: string;
  covering_teacher_id: string | null;
  covering_vikar_id: string | null;
  status: CoverageStatus;
  is_settled: boolean;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
};

// Insert helpers (DB fills id/created_at/defaults).
export type TeacherInsert = Omit<Teacher, "id" | "created_at">;
export type VikarInsert = Omit<Vikar, "id" | "created_at">;
export type LessonInsert = Omit<Lesson, "id" | "created_at">;
export type AbsenceInsert = Omit<Absence, "id" | "created_at">;

/**
 * Database type for the typed Supabase client. We type the rows we read most;
 * inserts/updates are loosely typed (`Partial`) because mutations go through
 * server actions that validate input explicitly.
 */
export type Database = {
  public: {
    Tables: {
      teachers: { Row: Teacher; Insert: Partial<Teacher>; Update: Partial<Teacher>; Relationships: [] };
      vikars: { Row: Vikar; Insert: Partial<Vikar>; Update: Partial<Vikar>; Relationships: [] };
      lessons: { Row: Lesson; Insert: Partial<Lesson>; Update: Partial<Lesson>; Relationships: [] };
      absences: { Row: Absence; Insert: Partial<Absence>; Update: Partial<Absence>; Relationships: [] };
      coverage_assignments: {
        Row: CoverageAssignment;
        Insert: Partial<CoverageAssignment>;
        Update: Partial<CoverageAssignment>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { coverage_status: CoverageStatus };
    CompositeTypes: Record<string, never>;
  };
};
