import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import type { Lesson, Teacher } from "@/lib/database.types";
import { ScheduleEditor } from "./ScheduleEditor";

export default async function TeacherSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .single();

  if (!teacher) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("teacher_id", id)
    .order("weekday")
    .order("period");

  return (
    <Page>
      <div className="mb-2">
        <Link href="/laerere" className="text-sm text-muted hover:text-ink">
          ← Tilbake til lærere
        </Link>
      </div>
      <PageHeader
        title={teacher.name}
        description="Klikk på en celle i timeplanen for å legge til eller endre en time."
      />
      <ScheduleEditor
        teacher={teacher as Teacher}
        lessons={(lessons ?? []) as Lesson[]}
      />
    </Page>
  );
}
