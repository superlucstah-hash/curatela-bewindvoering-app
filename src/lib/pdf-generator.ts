import { CRBP_CATEGORIES, DossierRecord } from "./db";

function escapePdfText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " ");
}

function buildPageStream(lines: string[], titleBanner: string, subtitleBanner: string): string {
  const commands: string[] = [];

  // Header box (dark slate navy bar)
  commands.push("0.09 0.16 0.28 rg");
  commands.push("36 765 523 48 re f");

  // White header text
  commands.push("BT");
  commands.push("1 1 1 rg");
  commands.push("/F2 12 Tf");
  commands.push(`48 793 Td (${escapePdfText(titleBanner)}) Tj`);
  commands.push("/F1 9 Tf");
  commands.push(`0 -15 Td (${escapePdfText(subtitleBanner)}) Tj`);
  commands.push("ET");

  // Body text (dark charcoal)
  commands.push("BT");
  commands.push("0.12 0.14 0.18 rg");
  commands.push("/F1 9.2 Tf");
  commands.push("42 742 Td");
  commands.push("13.2 TL");

  for (const line of lines) {
    if (line.startsWith("## ")) {
      commands.push("/F2 9.8 Tf");
      commands.push(`(${escapePdfText(line.slice(3))}) Tj T*`);
      commands.push("/F1 9.2 Tf");
    } else {
      commands.push(`(${escapePdfText(line)}) Tj T*`);
    }
  }

  commands.push("ET");
  return commands.join("\n");
}

export function generateCrbpPdfBuffer(dossier: DossierRecord): Buffer {
  const totalIncome = dossier.annualIncomes.reduce((s, x) => s + x.amount, 0);
  const legalFeeForfait = totalIncome * 0.03;
  const baseExpenses = dossier.annualExpenses.reduce((s, x) => s + x.amount, 0);
  const totalExpenses = baseExpenses + legalFeeForfait;
  const netResult = totalIncome - totalExpenses;
  const totalDocs =
    dossier.annualIncomes.reduce((s, x) => s + x.docsCount, 0) +
    dossier.annualExpenses.reduce((s, x) => s + x.docsCount, 0);

  const page1Lines: string[] = [
    `## 1. IDENTIFICATIE VAN HET BEWIND & BEVOEGD VREDEGERECHT`,
    `Bevoegde Rechtbank  : ${dossier.canton}`,
    `CRBP Dossiernummer  : ${dossier.crbpRef}`,
    `Beschermde Persoon  : ${dossier.name} (Geboren op ${dossier.birthDate} - RRN: ${dossier.rrnMasked})`,
    `Verblijfplaats      : ${dossier.livingSituation}`,
    `Zorgprofiel & Ziekenf: ${dossier.katzScale} | ${dossier.mutuality}`,
    `Aanstelling         : Beschikking d.d. ${dossier.appointmentDate} (${dossier.scope})`,
    `Bewindvoerder       : Mr. Jan De Smet, Advocaat (Kantoor De Smet & Partners)`,
    `--------------------------------------------------------------------------------`,
    `## 2. VERSLAG BESCHERMING VAN DE PERSOON (ART. 498/3 & 499/14 BW)`,
    `De beschermde persoon verblijft in ${dossier.livingSituation}.`,
    `De directe zorg en medische opvolging worden uitgevoerd door erkende zorgverleners`,
    `ter plaatse. Het wekelijks leefgeld bedraagt EUR ${dossier.weeklyAllowance.toFixed(2)} en wordt via een`,
    `periodieke opdracht met saldobewaking gestort op rekening ${dossier.accounts.allowance.iban}.`,
    `--------------------------------------------------------------------------------`,
    `## 3. DEEL I - OVERZICHT ONTVANGSTEN PER WETTELIJKE CRBP-RUBRIEK`,
    ...dossier.annualIncomes.map(
      (inc) =>
        `[${inc.code}] ${inc.description.slice(0, 44).padEnd(44, " ")} (${String(inc.docsCount).padStart(2, " ")} st.) : EUR ${inc.amount.toFixed(2).padStart(10, " ")}`
    ),
    `TOTAAL GEINDE INKOMSTEN                                           : EUR ${totalIncome.toFixed(2).padStart(10, " ")}`,
    `--------------------------------------------------------------------------------`,
    `## 4. DEEL II - OVERZICHT UITGAVEN PER WETTELIJKE CRBP-RUBRIEK`,
    ...dossier.annualExpenses.map(
      (exp) =>
        `[${exp.code}] ${exp.description.slice(0, 44).padEnd(44, " ")} (${String(exp.docsCount).padStart(2, " ")} st.) : EUR ${exp.amount.toFixed(2).padStart(10, " ")}`
    ),
    `[UIT-05] Ereloon & Kosten Bewindvoerder (3% forfait Art. 497/5 BW) : EUR ${legalFeeForfait.toFixed(2).padStart(10, " ")}`,
    `TOTAAL UITGAVEN (INCL. ERELOON)                                   : EUR ${totalExpenses.toFixed(2).padStart(10, " ")}`,
    `NETTO JAAROVERSCHOT / -TEKORT                                     : EUR ${netResult.toFixed(2).padStart(10, " ")}`,
    `--------------------------------------------------------------------------------`,
    `## 5. DEEL III - ACTUELE VERMOGENSTOESTAND OP DATUM VERSLAG`,
    `Beheerrekening (${dossier.accounts.management.iban}) - ${dossier.accounts.management.bank.slice(0, 22).padEnd(22, " ")} : EUR ${dossier.accounts.management.balance.toFixed(2).padStart(10, " ")}`,
    `Leefgeldrekening (${dossier.accounts.allowance.iban}) - Zakgeldrekening       : EUR ${dossier.accounts.allowance.balance.toFixed(2).padStart(10, " ")}`,
    `Spaarrekening (${dossier.accounts.savings.iban}) - Reserve/Geblokkeerd     : EUR ${dossier.accounts.savings.balance.toFixed(2).padStart(10, " ")}`,
    ...dossier.assets.map(
      (a) =>
        `Patrimonium: ${a.name.slice(0, 38).padEnd(38, " ")} (${a.category.slice(0, 12)}) : EUR ${a.estimatedValue.toFixed(2).padStart(10, " ")}`
    ),
    `--------------------------------------------------------------------------------`,
    `Pagina 1/2 - Vervolg op pagina 2 (Inventaris Stavingsstukken & Ondertekening)`
  ];

  const page2Lines: string[] = [
    `## 6. BIJLAGE A - INVENTARIS VAN GEKOPPELDE FACTUREN & STAVINGSSTUKKEN (${totalDocs} STUKS)`,
    `Alle facturen werden gecontroleerd op Modulo-97 OGM en gekoppeld aan hun CRBP-rubriek:`,
    ...dossier.invoices.map(
      (inv, idx) =>
        `Stuk #${idx + 1}: [${inv.crbpCode}] ${inv.supplier.slice(0, 32).padEnd(32, " ")} | OGM ${inv.ogm} | EUR ${inv.amount.toFixed(2)} (${inv.status})`
    ),
    `--------------------------------------------------------------------------------`,
    `## 7. BIJLAGE B - GOEDGEKEURDE ZORGAANVRAGEN & BIJZONDERE MACHTIGINGEN`,
    ...(dossier.careRequests.length > 0
      ? dossier.careRequests.map(
          (cr) =>
            `Zorgaanvraag [${cr.status}]: ${cr.title.slice(0, 36).padEnd(36, " ")} | ${cr.requesterName} | EUR ${cr.amount.toFixed(2)}`
        )
      : ["Geen afzonderlijke zorgaanvragen ingediend tijdens deze periode."]),
    `--------------------------------------------------------------------------------`,
    `## 8. BIJLAGE C - OVERZICHT OPGEZEGDE CONTRACTEN & PATRIMONIUMBEHEER`,
    ...dossier.assets.map(
      (as) => `Boedelitem: ${as.name} (${as.location}) - ${as.judicialAuthRef}`
    ),
    ...(dossier.contracts.length > 0
      ? dossier.contracts.map(
          (ct) =>
            `Contract [${ct.status}]: ${ct.provider.slice(0, 35).padEnd(35, " ")} | Nr. ${ct.contractNr} | EUR ${ct.monthlyCost.toFixed(2)}/m`
        )
      : ["Geen lopende thuiscontracten meer actief."]),
    `--------------------------------------------------------------------------------`,
    `## 9. VERZOEK TOT BEGROTING STAAT VAN KOSTEN EN ERELOON (ART. 497/5 BW)`,
    `Grondslag periodieke inkomsten : EUR ${totalIncome.toFixed(2)}`,
    `Wettelijk forfait (3%)         : EUR ${legalFeeForfait.toFixed(2)}`,
    `Status externe koppelingen     : Bankkoppeling Inactief | Just-on-Web Inactief (PDF Export)`,
    `--------------------------------------------------------------------------------`,
    `## 10. VERKLARING VAN OPRECHTHEID & HANDTEKENING`,
    `Ondergetekende, Mr. Jan De Smet, verklaart dat dit periodiek verslag voor het`,
    `${dossier.canton} oprecht en volledig werd opgesteld overeenkomstig`,
    `artikel 498/3 en 499/14 van het Burgerlijk Wetboek.`,
    ` `,
    `Opgemaakt op ${new Date().toLocaleDateString("nl-BE")} voor neerlegging ter griffie / CRBP.`,
    ` `,
    `Handtekening Bewindvoerder: ___________________________ (Mr. Jan De Smet)`,
    `Pagina 2/2 - Einde van het CRBP Verslag (${dossier.crbpRef})`
  ];

  const stream1 = buildPageStream(
    page1Lines,
    `PERIODIEK VERSLAG BEWINDVOERING - ${dossier.canton.toUpperCase()}`,
    `Model CRBP (Art. 498/3 & 499/14 BW) | Referentie: ${dossier.crbpRef} | Beschermde persoon: ${dossier.name}`
  );

  const stream2 = buildPageStream(
    page2Lines,
    `BIJLAGEN & STAVINGSSTUKKEN CRBP - ${dossier.crbpRef}`,
    `Dossier ${dossier.name} | ${dossier.canton} | Pagina 2 van 2`
  );

  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n",
    `7 0 obj\n<< /Length ${Buffer.byteLength(stream1, "ascii")} >>\nstream\n${stream1}\nendstream\nendobj\n`,
    `8 0 obj\n<< /Length ${Buffer.byteLength(stream2, "ascii")} >>\nstream\n${stream2}\nendstream\nendobj\n`
  ];

  let pdfContent = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdfContent, "ascii"));
    pdfContent += obj;
  }

  const xrefOffset = Buffer.byteLength(pdfContent, "ascii");
  pdfContent += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdfContent += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdfContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfContent, "ascii");
}
