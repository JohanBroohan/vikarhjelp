// Downloadable CSV template so the principal knows the exact import format.
// Opens cleanly in Excel and Numbers.

const TEMPLATE = `teacher_name,weekday,period,subject,class_group,room
Anna Berg,man,1,Matematikk,8A,R12
Anna Berg,tir,3,Naturfag,9A,Nat1
Bjørn Dahl,man,2,Norsk,8A,R14
`;

export async function GET() {
  // BOM so Excel reads UTF-8 (æ/ø/å) correctly.
  const body = "﻿" + TEMPLATE;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="timeplan-mal.csv"',
    },
  });
}
