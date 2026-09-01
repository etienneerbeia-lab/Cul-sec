import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { applyQuizDistribution } from "@/lib/quiz/engine";
import { getGame, setGame } from "@/lib/store";

interface TargetInput {
  slug: string;
  amount: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const session = await requireSession(req, code);
  if (!session) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const game = await getGame(code);
  if (!game || game.phase !== "quiz" || !game.quiz || game.quiz.status !== "distributing") {
    return NextResponse.json({ error: "Ce n'est pas le moment." }, { status: 409 });
  }

  const activeSlug = game.playersPublic[game.quiz.playerIdx].slug;
  if (session.slug !== activeSlug) {
    return NextResponse.json({ error: "Ce n'est pas ton tour." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rawTargets = Array.isArray(body?.targets) ? (body.targets as unknown[]) : null;
  if (!rawTargets) {
    return NextResponse.json({ error: "Cibles invalides." }, { status: 400 });
  }

  const validSlugs = new Set(game.playersPublic.map((p) => p.slug));
  const seen = new Set<string>();
  const targets: TargetInput[] = [];
  for (const raw of rawTargets) {
    const t = raw as Partial<TargetInput>;
    if (typeof t.slug !== "string" || typeof t.amount !== "number") {
      return NextResponse.json({ error: "Cibles invalides." }, { status: 400 });
    }
    if (t.slug === activeSlug) {
      return NextResponse.json({ error: "Tu ne peux pas te faire boire toi-même." }, { status: 400 });
    }
    if (!validSlugs.has(t.slug) || seen.has(t.slug)) {
      return NextResponse.json({ error: "Cibles invalides." }, { status: 400 });
    }
    if (!Number.isInteger(t.amount) || t.amount <= 0) {
      return NextResponse.json({ error: "Quantités invalides." }, { status: 400 });
    }
    seen.add(t.slug);
    targets.push({ slug: t.slug, amount: t.amount });
  }

  const total = targets.reduce((sum, t) => sum + t.amount, 0);
  if (total !== 2) {
    return NextResponse.json({ error: "Il faut distribuer exactement 2 gorgées." }, { status: 400 });
  }

  applyQuizDistribution(game, targets);
  await setGame(code, game);
  return NextResponse.json({ ok: true });
}
