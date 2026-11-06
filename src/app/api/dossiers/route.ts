import { NextRequest, NextResponse } from "next/server";
import { CRBP_CATEGORIES, readDb, writeDb } from "@/lib/db";

export async function GET() {
  const db = readDb();
  return NextResponse.json({
    dossiers: db.dossiers,
    categories: CRBP_CATEGORIES
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dossierId, action, payload } = body;

  const db = readDb();
  const dossier = db.dossiers.find((d) => d.id === dossierId);

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

  switch (action) {
    case "UPDATE_ALLOWANCE": {
      const amount = Number(payload.weeklyAllowance);
      if (!isNaN(amount) && amount >= 20) {
        dossier.weeklyAllowance = amount;
        dossier.auditTrail.unshift({
          id: "aud-" + Date.now(),
          timestamp: nowStr,
          actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
          action: `Wekelijks leefgeld aangepast naar EUR ${amount.toFixed(2)} met automatische saldobewaking.`
        });
      }
      break;
    }

    case "TOGGLE_INVOICE": {
      const inv = dossier.invoices.find((i) => i.id === payload.invoiceId);
      if (inv && inv.status === "READY") {
        inv.selected = Boolean(payload.selected);
      }
      break;
    }

    case "UPDATE_INVOICE_CATEGORY": {
      const inv = dossier.invoices.find((i) => i.id === payload.invoiceId);
      if (inv && CRBP_CATEGORIES[payload.crbpCode]) {
        inv.crbpCode = payload.crbpCode;
        dossier.auditTrail.unshift({
          id: "aud-" + Date.now(),
          timestamp: nowStr,
          actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
          action: `Factuur "${inv.supplier}" geherclassificeerd naar CRBP-rubriek ${payload.crbpCode}.`
        });
      }
      break;
    }

    case "SIMULATE_OCR_INVOICE": {
      const samples = [
        {
          supplier: "CM Zorgwinkel (Verhuur Hoog-Laagbed & Matras)",
          iban: "BE61 0682 4099 1182",
          amount: 78.50,
          ogm: "+++210/4829/19073+++",
          crbpCode: "UIT-02",
          source: "OCR PDF Mailbox"
        },
        {
          supplier: "Fluvius / Engie Eindafrekening",
          iban: "BE49 2100 0008 8921",
          amount: 134.90,
          ogm: "+++609/1145/20856+++",
          crbpCode: "UIT-04",
          source: "Peppol e-Invoicing"
        },
        {
          supplier: "Ambulancedienst & Ziekenvervoer",
          iban: "BE22 7310 4491 0082",
          amount: 92.40,
          ogm: "+++390/8112/64021+++",
          crbpCode: "UIT-02",
          source: "Doccle / eBox"
        }
      ];
      const pick = samples[dossier.invoices.length % samples.length];
      dossier.invoices.unshift({
        id: "inv-" + Date.now(),
        supplier: pick.supplier,
        iban: pick.iban,
        amount: pick.amount,
        ogm: pick.ogm,
        ogmValid: true,
        dueDate: "30/11/2026",
        crbpCode: pick.crbpCode,
        source: pick.source,
        confidence: 99,
        status: "READY",
        selected: true
      });
      dossier.auditTrail.unshift({
        id: "aud-" + Date.now(),
        timestamp: nowStr,
        actor: "OCR & Document AI Pipeline",
        action: `Factuur "${pick.supplier}" (EUR ${pick.amount.toFixed(2)}, OGM ${pick.ogm}) gescand en gekoppeld aan ${pick.crbpCode}.`
      });
      break;
    }

    case "EXECUTE_SEPA_BATCH": {
      const selected = dossier.invoices.filter((i) => i.status === "READY" && i.selected);
      let total = 0;
      for (const inv of selected) {
        inv.status = "PAID";
        inv.selected = false;
        total += inv.amount;
        const existingCat = dossier.annualExpenses.find((e) => e.code === inv.crbpCode);
        if (existingCat) {
          existingCat.amount = Number((existingCat.amount + inv.amount).toFixed(2));
          existingCat.docsCount += 1;
        } else {
          dossier.annualExpenses.push({
            code: inv.crbpCode,
            description: CRBP_CATEGORIES[inv.crbpCode]?.label || inv.crbpCode,
            amount: inv.amount,
            docsCount: 1
          });
        }
      }
      dossier.accounts.management.balance = Number((dossier.accounts.management.balance - total).toFixed(2));
      dossier.auditTrail.unshift({
        id: "aud-" + Date.now(),
        timestamp: nowStr,
        actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
        action: `SEPA pain.001.001.03 betaalbatch (${selected.length} facturen, EUR ${total.toFixed(2)}) gegenereerd en afgeboekt.`
      });
      break;
    }

    case "SUBMIT_CARE_REQUEST": {
      const newReq = {
        id: "cr-" + Date.now(),
        requesterOrg: dossier.livingSituation.split("(")[0].trim(),
        requesterName: payload.requesterName || "Zorgverlener WZC Portaal",
        title: String(payload.title || "").trim(),
        justification: String(payload.justification || "").trim(),
        amount: Number(payload.amount || 0),
        crbpCode: payload.crbpCode || "UIT-03",
        date: new Date().toLocaleDateString("nl-BE"),
        status: "PENDING" as const
      };
      dossier.careRequests.unshift(newReq);
      dossier.auditTrail.unshift({
        id: "aud-" + Date.now(),
        timestamp: nowStr,
        actor: newReq.requesterName,
        action: `Zorgaanvraag "${newReq.title}" (EUR ${newReq.amount.toFixed(2)}) ingediend via WZC Zorgportaal.`
      });
      break;
    }

    case "DECIDE_CARE_REQUEST": {
      const reqItem = dossier.careRequests.find((r) => r.id === payload.requestId);
      if (reqItem && reqItem.status === "PENDING") {
        reqItem.status = payload.decision === "APPROVED" ? "APPROVED" : "REJECTED";
        if (reqItem.status === "APPROVED") {
          dossier.invoices.unshift({
            id: "inv-care-" + Date.now(),
            supplier: `Zorgaanvraag WZC: ${reqItem.title}`,
            iban: dossier.accounts.allowance.iban,
            amount: reqItem.amount,
            ogm: "+++000/0000/00097+++",
            ogmValid: true,
            dueDate: "20/11/2026",
            crbpCode: reqItem.crbpCode,
            source: "Goedgekeurd Zorgportaal",
            confidence: 100,
            status: "READY",
            selected: true
          });
        }
        dossier.auditTrail.unshift({
          id: "aud-" + Date.now(),
          timestamp: nowStr,
          actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
          action: `Zorgaanvraag "${reqItem.title}" (EUR ${reqItem.amount.toFixed(2)}) ${
            reqItem.status === "APPROVED" ? "goedgekeurd en klaargezet voor betaling" : "afgewezen"
          }.`
        });
      }
      break;
    }

    case "SEND_NOTIFICATION": {
      const key = payload.key as keyof typeof dossier.notificationsSent;
      if (key in dossier.notificationsSent) {
        dossier.notificationsSent[key] = true;
        dossier.auditTrail.unshift({
          id: "aud-" + Date.now(),
          timestamp: nowStr,
          actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
          action: `Officiele kennisgeving van bewindvoering (Art. 492/1 BW) gegenereerd voor ${payload.title}.`
        });
      }
      break;
    }

    case "ADD_ASSET": {
      dossier.assets.push({
        id: "as-" + Date.now(),
        name: payload.name || "Waardevol roerend boedelstuk (Plaatsbeschrijving)",
        location: payload.location || dossier.livingSituation,
        estimatedValue: Number(payload.estimatedValue || 1200),
        category: payload.category || "Roerend goed (Plaatsbeschrijving)",
        judicialAuthRequired: Boolean(payload.judicialAuthRequired),
        judicialAuthRef:
          payload.judicialAuthRef || "Toegevoegd aan plaatsbeschrijving & CRBP vermogensoverzicht",
        photoCount: Number(payload.photoCount || 4),
        status: "Geregistreerd met tijdstempel"
      });
      dossier.auditTrail.unshift({
        id: "aud-" + Date.now(),
        timestamp: nowStr,
        actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
        action: `Boedelitem "${payload.name}" (EUR ${Number(payload.estimatedValue || 1200).toFixed(2)}) toegevoegd aan inventaris.`
      });
      break;
    }

    case "TERMINATE_CONTRACT": {
      const ct = dossier.contracts.find((c) => c.id === payload.contractId);
      if (ct && ct.status === "ACTIVE") {
        ct.status = "TERMINATED";
        dossier.auditTrail.unshift({
          id: "aud-" + Date.now(),
          timestamp: nowStr,
          actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
          action: `Opzegbrief verzonden naar ${ct.provider} (${ct.contractNr}) wegens opname WZC (besparing EUR ${(
            ct.monthlyCost * 12
          ).toFixed(2)}/jaar).`
        });
      }
      break;
    }

    case "TERMINATE_ALL_CONTRACTS": {
      let yearlySaved = 0;
      for (const ct of dossier.contracts) {
        if (ct.status === "ACTIVE") {
          ct.status = "TERMINATED";
          yearlySaved += ct.monthlyCost * 12;
        }
      }
      dossier.auditTrail.unshift({
        id: "aud-" + Date.now(),
        timestamp: nowStr,
        actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
        action: `Alle lopende thuiscontracten opgezegd wegens opname WZC (totale besparing EUR ${yearlySaved.toFixed(
          2
        )}/jaar).`
      });
      break;
    }
  }

  writeDb(db);
  return NextResponse.json({
    dossiers: db.dossiers,
    categories: CRBP_CATEGORIES
  });
}
