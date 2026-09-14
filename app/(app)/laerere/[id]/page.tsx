import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page } from "@/components/ui";
import type { Lesson, Teacher } from "@/lib/database.types";
import { TeacherTimeline } from "./TeacherTimeline";

export default async function TeacherSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromOversikt = from === "oversikt";
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
        <Link
          href={fromOversikt ? "/" : "/laerere"}
          className="text-sm text-muted hover:text-ink"
        >
          {fromOversikt ? "← Tilbake til oversikt" : "← Tilbake til lærere"}
        </Link>
      </div>
      <TeacherTimeline
        teacher={teacher as Teacher}
        lessons={(lessons ?? []) as Lesson[]}
      />
    </Page>
  );
}
