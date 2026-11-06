import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { generateCrbpPdfBuffer } from "@/lib/pdf-generator";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = readDb();
  const dossier = db.dossiers.find((d) => d.id === id);

  if (!dossier) {
    return NextResponse.json({ error: "Dossier niet gevonden" }, { status: 404 });
  }

  const nowStr = new Date().toLocaleString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  dossier.auditTrail.unshift({
    id: "aud-" + Date.now(),
    timestamp: nowStr,
    actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
    action: `Officieel CRBP Jaarverslag PDF gegenereerd voor ${dossier.canton} (${dossier.crbpRef}). Rechtstreekse Just-on-Web integratie staat op inactief.`
  });
  writeDb(db);

  const pdfBuffer = generateCrbpPdfBuffer(dossier);
  const safeFilename = `CRBP_Jaarverslag_${dossier.crbpRef.replace(/\//g, "_")}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store"
    }
  });
}
