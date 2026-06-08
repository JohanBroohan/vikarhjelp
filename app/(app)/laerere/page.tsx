import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import type { Teacher } from "@/lib/database.types";
import { TeachersManager } from "./TeachersManager";

export default async function TeachersPage() {
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  // Lesson counts per teacher, for an at-a-glance "timer i uka" column.
  const { data: lessons } = await supabase.from("lessons").select("teacher_id");
  const lessonCounts = new Map<string, number>();
  for (const l of lessons ?? []) {
    lessonCounts.set(l.teacher_id, (lessonCounts.get(l.teacher_id) ?? 0) + 1);
  }

  return (
    <Page>
      <PageHeader
        title="Lærere"
        description="Administrer lærerne og deres ukentlige timeplan."
      />
      <TeachersManager
        teachers={(teachers ?? []) as Teacher[]}
        lessonCounts={Object.fromEntries(lessonCounts)}
      />
    </Page>
  );
}
