import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";

// Mark a social task complete and award its points. The unique (fanId, taskId)
// constraint makes this idempotent — a task can only ever pay out once per fan.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const taskKey = String(body?.taskKey ?? "").trim();
  if (!taskKey) return NextResponse.json({ error: "missing_task" }, { status: 400 });

  try {
    const task = await db.socialTask.findUnique({ where: { key: taskKey } });
    if (!task || !task.active) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

    const already = await db.taskCompletion.findUnique({
      where: { fanId_taskId: { fanId: auth.fanId, taskId: task.id } },
    });
    if (already) return NextResponse.json({ error: "already_completed" }, { status: 409 });

    const [, , fan] = await db.$transaction([
      db.taskCompletion.create({ data: { fanId: auth.fanId, taskId: task.id } }),
      db.loyaltyTransaction.create({ data: { fanId: auth.fanId, delta: task.points, reason: `task:${task.key}` } }),
      db.fan.update({ where: { id: auth.fanId }, data: { points: { increment: task.points } }, select: { points: true } }),
    ]);

    return NextResponse.json({ ok: true, awarded: task.points, points: fan.points });
  } catch (e: any) {
    // Unique violation → concurrent double-complete.
    if (e?.code === "P2002") return NextResponse.json({ error: "already_completed" }, { status: 409 });
    return NextResponse.json({ error: "task_failed" }, { status: 500 });
  }
}
