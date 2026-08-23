import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";

// Social tasks + whether the signed-in fan has completed each.
export async function GET(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const [tasks, done] = await Promise.all([
      db.socialTask.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      db.taskCompletion.findMany({ where: { fanId: auth.fanId }, select: { taskId: true } }),
    ]);
    const doneSet = new Set(done.map((d) => d.taskId));
    return NextResponse.json(
      tasks.map((t) => ({
        key: t.key,
        title: t.title,
        description: t.description,
        points: t.points,
        actionUrl: t.actionUrl,
        icon: t.icon,
        completed: doneSet.has(t.id),
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
