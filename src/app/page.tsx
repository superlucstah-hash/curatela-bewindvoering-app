"use client";

import React, { useEffect, useState } from "react";
import type { CrbpCategoryMeta, DossierRecord } from "@/lib/db";

function formatEUR(amount: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function CuratelaPlatformPage() {
  const [dossiers, setDossiers] = useState<DossierRecord[]>([]);
  const [categories, setCategories] = useState<Record<string, CrbpCategoryMeta>>({});
  const [activeDossierId, setActiveDossierId] = useState<string>("dos-1");
  const [activeTab, setActiveTab] = useState<"financial" | "crbp" | "care" | "estate">("financial");
  const [roleMode, setRoleMode] = useState<"admin" | "care">("admin");
  const [allowanceDraft, setAllowanceDraft] = useState<string>("85");
  const [careTitle, setCareTitle] = useState<string>("");
  const [careAmount, setCareAmount] = useState<string>("");
  const [careJustification, setCareJustification] = useState<string>("");
  const [assetName, setAssetName] = useState<string>("");
  const [assetValue, setAssetValue] = useState<string>("");
  const [assetAuthRef, setAssetAuthRef] = useState<string>("");
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    subtitle: string;
    type: "sepa" | "crbp-preview" | "letter";
    content?: string;
    letterKey?: string;
    letterTitle?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/dossiers")
      .then((r) => r.json())
      .then((data) => {
        setDossiers(data.dossiers || []);
        setCategories(data.categories || {});
        if (data.dossiers?.length > 0) {
          setAllowanceDraft(String(data.dossiers[0].weeklyAllowance));
        }
      });
  }, []);

  const activeDossier = dossiers.find((d) => d.id === activeDossierId) || dossiers[0];

  function notify(title: string, message: string) {
    setToast({ title, message });
    setTimeout(() => {
      setToast((prev) => (prev?.title === title ? null : prev));
    }, 4200);
  }

  async function dispatchAction(action: string, payload: Record<string, unknown> = {}) {
    if (!activeDossier) return;
    const res = await fetch("/api/dossiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dossierId: activeDossier.id,
        action,
        payload
      })
    });
    if (res.ok) {
      const data = await res.json();
      setDossiers(data.dossiers);
    }
  }

  if (!activeDossier) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <p>Curatela Bewindvoeringsplatform laden...</p>
      </div>
    );
  }

  const readyInvoices = activeDossier.invoices.filter((i) => i.status === "READY");
  const selectedInvoices = readyInvoices.filter((i) => i.selected);
  const batchTotal = selectedInvoices.reduce((acc, i) => acc + i.amount, 0);
  const projectedBalance = activeDossier.accounts.management.balance - batchTotal;
  const bufferHealthy = projectedBalance >= activeDossier.minBuffer;

  const totalIncome = activeDossier.annualIncomes.reduce((s, x) => s + x.amount, 0);
  const legalFeeForfait = totalIncome * 0.03;
  const baseExpenses = activeDossier.annualExpenses.reduce((s, x) => s + x.amount, 0);
  const totalExpensesWithFee = baseExpenses + legalFeeForfait;
  const netAnnualResult = totalIncome - totalExpensesWithFee;
  const totalLiquidAssets =
    activeDossier.accounts.management.balance +
    activeDossier.accounts.allowance.balance +
    activeDossier.accounts.savings.balance;
  const totalRealEstate = activeDossier.assets.reduce((s, a) => s + a.estimatedValue, 0);

  const pendingCareCount = activeDossier.careRequests.filter((c) => c.status === "PENDING").length;
  const activeContracts = activeDossier.contracts.filter((c) => c.status === "ACTIVE");
  const monthlyActiveCost = activeContracts.reduce((s, c) => s + c.monthlyCost, 0);
  const terminatedSavingsYearly =
    activeDossier.contracts.filter((c) => c.status === "TERMINATED").reduce((s, c) => s + c.monthlyCost, 0) * 12;

  function buildSepaXmlString(): string {
    const msgId = `CURATELA-${activeDossier.crbpRef.replace(/\//g, "-")}-${Date.now().toString().slice(-5)}`;
    const txs = selectedInvoices
      .map(
        (inv, idx) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-${idx + 1}-${inv.id}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${inv.amount.toFixed(2)}</InstdAmt></Amt>
        <Cdtr><Nm>${inv.supplier.replace(/&/g, "&amp;")}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${inv.iban.replace(/\s+/g, "")}</IBAN></Id></CdtrAcct>
        <RmtInf><Strd><CdtrRefInf><Ref>${inv.ogm}</Ref></CdtrRefInf></Strd></RmtInf>
      </CdtTrfTxInf>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${selectedInvoices.length}</NbOfTxs>
      <CtrlSum>${batchTotal.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>Mr. Jan De Smet q.q. Bewindvoerder ${activeDossier.name}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>BATCH-${activeDossier.id.toUpperCase()}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <Dbtr><Nm>${activeDossier.name} (CRBP ${activeDossier.crbpRef})</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${activeDossier.accounts.management.iban.replace(/\s+/g, "")}</IBAN></Id></DbtrAcct>
${txs}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
  }

  function handleDownloadCrbpPdf() {
    window.open(`/api/dossiers/${activeDossier.id}/crbp-pdf`, "_blank");
    notify(
      "CRBP Jaarverslag PDF Gegenereerd",
      `Officieel PDF-verslag voor ${activeDossier.canton} (${activeDossier.crbpRef}) wordt gedownload.`
    );
    setTimeout(() => {
      fetch("/api/dossiers")
        .then((r) => r.json())
        .then((d) => setDossiers(d.dossiers || []));
    }, 600);
  }

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <header className="top-header">
        <div className="container-wide header-inner">
          <div className="brand-group">
            <div className="brand-monogram">C</div>
            <div>
              <div className="brand-title">
                <h1>Curatela</h1>
                <span className="badge badge-neutral">Balie &amp; Bewindvoering SaaS</span>
              </div>
              <p className="brand-subtitle">
                Advocatenkantoor De Smet &amp; Partners • Beheer van Goederen &amp; Persoon
              </p>
            </div>
          </div>

          <div className="controls-group">
            <div className="dossier-picker">
              <label htmlFor="dossier-selector">Actief Dossier:</label>
              <select
                id="dossier-selector"
                className="dossier-select"
                value={activeDossier.id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setActiveDossierId(nextId);
                  const found = dossiers.find((d) => d.id === nextId);
                  if (found) setAllowanceDraft(String(found.weeklyAllowance));
                }}
              >
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.age}j) — {d.crbpRef}
                  </option>
                ))}
              </select>
            </div>

            <div className="role-switcher" role="group" aria-label="Gebruikersrol">
              <button
                id="btn-role-admin"
                type="button"
                className={`role-btn ${roleMode === "admin" ? "active" : ""}`}
                onClick={() => setRoleMode("admin")}
              >
                Advocaat-Bewindvoerder
              </button>
              <button
                id="btn-role-care"
                type="button"
                className={`role-btn ${roleMode === "care" ? "active" : ""}`}
                onClick={() => setRoleMode("care")}
              >
                WZC Zorgportaal (GDPR-beperkt)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Dossier Context & Integration Status Banner */}
      <section className="context-banner">
        <div className="container-wide banner-inner">
          <div className="banner-meta">
            <div>
              <span className="label">Beschermde persoon:</span>
              <strong>
                {activeDossier.name} ({activeDossier.birthDate})
              </strong>
            </div>
            <div>
              <span className="label">Bevoegde rechter:</span>
              <strong>{activeDossier.canton}</strong>
            </div>
            <div>
              <span className="label">Verblijf:</span>
              <strong>{activeDossier.livingSituation}</strong>
            </div>
            <div>
              <span className="label">Zorgprofiel:</span>
              <strong>
                {activeDossier.katzScale} • {activeDossier.mutuality}
              </strong>
            </div>
          </div>

          <div className="integration-pills">
            <span className="pill-inactive" title="Live PSD2 bankkoppeling is momenteel uitgeschakeld">
              Bankkoppeling (PSD2 API): Inactief
            </span>
            <span className="pill-inactive" title="Rechtstreekse indiening bij Just-on-Web is uitgeschakeld; gebruik PDF-export">
              Vredegerecht / Just-on-Web API: Inactief (PDF Export Actief)
            </span>
          </div>
        </div>
      </section>

      {/* Module Navigation Tabs */}
      <nav className="tabs-bar" aria-label="Hoofdmodules">
        <div className="container-wide tabs-list">
          <button
            id="tab-financial"
            type="button"
            className={`tab-button ${activeTab === "financial" ? "active" : ""}`}
            onClick={() => setActiveTab("financial")}
          >
            <span>1. Financieel Beheer &amp; OCR Facturen</span>
            <span className="tab-count">{readyInvoices.length}</span>
          </button>
          <button
            id="tab-crbp"
            type="button"
            className={`tab-button ${activeTab === "crbp" ? "active" : ""}`}
            onClick={() => setActiveTab("crbp")}
          >
            <span>2. CRBP Jaarverslag &amp; PDF Vredegerecht</span>
          </button>
          <button
            id="tab-care"
            type="button"
            className={`tab-button ${activeTab === "care" ? "active" : ""}`}
            onClick={() => setActiveTab("care")}
          >
            <span>3. WZC Zorgportaal &amp; Briefautomatisatie</span>
            <span className="tab-count">{pendingCareCount}</span>
          </button>
          <button
            id="tab-estate"
            type="button"
            className={`tab-button ${activeTab === "estate" ? "active" : ""}`}
            onClick={() => setActiveTab("estate")}
          >
            <span>4. Woning, Inventaris &amp; Contractopzegging</span>
            <span className="tab-count">{activeContracts.length}</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="workspace-main">
        <div className="container-wide stack-lg">
          {/* ===============================================================
              MODULE 1: FINANCIEEL BEHEER & OCR FACTUURHUB
             =============================================================== */}
          {activeTab === "financial" && (
            <>
              {roleMode === "care" ? (
                <div className="card stack-lg">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Leefgeld &amp; Comfortbudget Status (WZC Inzage)</h2>
                      <p className="card-subtitle">
                        Conform de GDPR en het beroepsgeheim van de bewindvoerder zijn de beheerrekening en spaarrekeningen afgeschermd.
                      </p>
                    </div>
                    <span className="badge badge-ok">
                      Wekelijks Leefgeld: {formatEUR(activeDossier.weeklyAllowance)} / week
                    </span>
                  </div>
                  <div className="grid-2">
                    <div className="list-item-box">
                      <div>
                        <p className="card-subtitle">
                          Huidig saldo zakgeld-/leefgeldrekening ({activeDossier.accounts.allowance.iban})
                        </p>
                        <p className="metric-value">{formatEUR(activeDossier.accounts.allowance.balance)}</p>
                        <p className="card-subtitle">Volgende periodieke storting: maandag 08:00</p>
                      </div>
                    </div>
                    <div className="list-item-box">
                      <div>
                        <p className="card-subtitle">Beschikbare ruimte voor extra zorgaanvragen</p>
                        <p style={{ fontWeight: 700, fontSize: "15px", marginTop: "4px" }}>
                          Groen licht voor kleine uitgaven tot € 250,00
                        </p>
                        <p className="card-subtitle">Dien medische of comfort-aanvragen in via het Zorgportaal.</p>
                      </div>
                      <button
                        id="btn-jump-care"
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setActiveTab("care")}
                      >
                        Dien Zorgaanvraag In →
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Bank Account Cards */}
                  <div className="grid-3">
                    <div className="card">
                      <div className="card-header" style={{ marginBottom: "6px" }}>
                        <span className="card-subtitle" style={{ fontWeight: 600 }}>
                          BEHEERREKENING
                        </span>
                        <span className="badge badge-inactive">Bankkoppeling Inactief (Lokaal)</span>
                      </div>
                      <p className="metric-value">{formatEUR(activeDossier.accounts.management.balance)}</p>
                      <p className="mono" style={{ color: "var(--text-secondary)" }}>
                        {activeDossier.accounts.management.iban} • {activeDossier.accounts.management.bank}
                      </p>
                      <div
                        style={{
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12.5px"
                        }}
                      >
                        <span style={{ color: "var(--text-secondary)" }}>Ingestelde minimumbuffer:</span>
                        <strong>{formatEUR(activeDossier.minBuffer)}</strong>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header" style={{ marginBottom: "6px" }}>
                        <span className="card-subtitle" style={{ fontWeight: 600 }}>
                          LEEFGELDREKENING (ZAKGELD)
                        </span>
                        <span className="badge badge-ok">Schema: Elke maandag</span>
                      </div>
                      <p className="metric-value">{formatEUR(activeDossier.accounts.allowance.balance)}</p>
                      <p className="mono" style={{ color: "var(--text-secondary)" }}>
                        {activeDossier.accounts.allowance.iban} • {activeDossier.accounts.allowance.bank}
                      </p>
                      <div
                        style={{
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          fontSize: "12.5px"
                        }}
                      >
                        <label htmlFor="weekly-allowance-input" style={{ color: "var(--text-secondary)" }}>
                          Wekelijks leefgeld (€):
                        </label>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input
                            id="weekly-allowance-input"
                            type="number"
                            className="input-field"
                            style={{ width: "82px", textAlign: "right", fontWeight: 600 }}
                            value={allowanceDraft}
                            onChange={(e) => setAllowanceDraft(e.target.value)}
                          />
                          <button
                            id="btn-save-allowance"
                            type="button"
                            className="btn btn-secondary"
                            onClick={async () => {
                              await dispatchAction("UPDATE_ALLOWANCE", {
                                weeklyAllowance: Number(allowanceDraft)
                              });
                              notify(
                                "Leefgeldschema Opgeslagen",
                                `Wekelijkse storting voor ${activeDossier.name} ingesteld op ${formatEUR(
                                  Number(allowanceDraft)
                                )}.`
                              );
                            }}
                          >
                            Bewaar
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header" style={{ marginBottom: "6px" }}>
                        <span className="card-subtitle" style={{ fontWeight: 600 }}>
                          RESERVE- &amp; SPAARREKENING
                        </span>
                        <span className="badge badge-neutral">Art. 499/7 BW</span>
                      </div>
                      <p className="metric-value">{formatEUR(activeDossier.accounts.savings.balance)}</p>
                      <p className="mono" style={{ color: "var(--text-secondary)" }}>
                        {activeDossier.accounts.savings.iban} • {activeDossier.accounts.savings.bank}
                      </p>
                      <div
                        style={{
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12.5px"
                        }}
                      >
                        <span style={{ color: "var(--text-secondary)" }}>Opname vereist machtiging:</span>
                        <strong>Vrederechter</strong>
                      </div>
                    </div>
                  </div>

                  {/* Smart OCR Invoice Processing & SEPA XML Export */}
                  <div className="card stack-lg">
                    <div className="card-header" style={{ marginBottom: 0 }}>
                      <div>
                        <h2 className="card-title">
                          Slimme Factuurverwerking (OCR &amp; Peppol) → Lokale SEPA XML Betaalbatch
                        </h2>
                        <p className="card-subtitle">
                          Inkomende facturen worden gecontroleerd op Modulo-97 OGM en automatisch getagd met de juiste CRBP-rubriek voor het jaarverslag.
                        </p>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        <button
                          id="btn-simulate-ocr"
                          type="button"
                          className="btn btn-secondary"
                          onClick={async () => {
                            await dispatchAction("SIMULATE_OCR_INVOICE");
                            notify(
                              "Nieuwe Factuur Gescand via OCR",
                              "Factuur gevalideerd op OGM en klaargezet voor SEPA-betaling."
                            );
                          }}
                        >
                          + Simuleer Inkomende Factuur (OCR Scan)
                        </button>
                        <button
                          id="btn-open-sepa-modal"
                          type="button"
                          className="btn btn-primary"
                          disabled={selectedInvoices.length === 0}
                          onClick={() =>
                            setModal({
                              title: "SEPA Betaalbatch (ISO 20022 pain.001.001.03)",
                              subtitle: `Dossier ${activeDossier.name} • ${selectedInvoices.length} geselecteerde facturen • Totaal: ${formatEUR(
                                batchTotal
                              )}`,
                              type: "sepa",
                              content: buildSepaXmlString()
                            })
                          }
                        >
                          Genereer SEPA XML Batch ({selectedInvoices.length} • {formatEUR(batchTotal)})
                        </button>
                      </div>
                    </div>

                    <div className="notice-bar">
                      <div>
                        <strong>Automatische Saldobewaker:</strong>{" "}
                        <span>
                          Saldo beheerrekening na uitvoering batch: <strong>{formatEUR(projectedBalance)}</strong>{" "}
                          (Minimumbuffer: {formatEUR(activeDossier.minBuffer)})
                        </span>
                      </div>
                      <span className={`badge ${bufferHealthy ? "badge-ok" : "badge-inactive"}`}>
                        {bufferHealthy
                          ? "✓ Ruim boven minimumbuffer — Leefgeld gegarandeerd"
                          : "Let op: Minimumbuffer wordt aangesproken"}
                      </span>
                    </div>

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: "48px" }}>Batch</th>
                            <th>Leverancier &amp; Kanaal</th>
                            <th>Gestructureerde Mededeling (OGM)</th>
                            <th>CRBP-Rubriek (AI Tag)</th>
                            <th>Vervaldatum</th>
                            <th style={{ textAlign: "right" }}>Bedrag</th>
                            <th style={{ textAlign: "right" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDossier.invoices.map((inv) => (
                            <tr key={inv.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={inv.selected && inv.status === "READY"}
                                  disabled={inv.status !== "READY"}
                                  aria-label={`Selecteer ${inv.supplier}`}
                                  onChange={(e) =>
                                    dispatchAction("TOGGLE_INVOICE", {
                                      invoiceId: inv.id,
                                      selected: e.target.checked
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{inv.supplier}</div>
                                <div className="mono" style={{ color: "var(--text-secondary)" }}>
                                  {inv.iban} • {inv.source} ({inv.confidence}% OCR)
                                </div>
                              </td>
                              <td className="mono">
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--border-subtle)",
                                    backgroundColor: "var(--bg-subtle)"
                                  }}
                                >
                                  {inv.ogm}
                                </span>{" "}
                                <span style={{ color: "var(--status-ok-fg)" }}>✓ Mod97</span>
                              </td>
                              <td>
                                <select
                                  className="select-field"
                                  value={inv.crbpCode}
                                  aria-label={`CRBP-rubriek voor ${inv.supplier}`}
                                  onChange={async (e) => {
                                    await dispatchAction("UPDATE_INVOICE_CATEGORY", {
                                      invoiceId: inv.id,
                                      crbpCode: e.target.value
                                    });
                                    notify(
                                      "CRBP-Rubriek Bijgewerkt",
                                      `Factuur ${inv.supplier} gekoppeld aan ${e.target.value}.`
                                    );
                                  }}
                                >
                                  {Object.entries(categories)
                                    .filter(([, meta]) => meta.type === "EXPENSE")
                                    .map(([code, meta]) => (
                                      <option key={code} value={code}>
                                        {code}: {meta.label}
                                      </option>
                                    ))}
                                </select>
                              </td>
                              <td>{inv.dueDate}</td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{formatEUR(inv.amount)}</td>
                              <td style={{ textAlign: "right" }}>
                                <span className={`badge ${inv.status === "PAID" ? "badge-ok" : "badge-neutral"}`}>
                                  {inv.status === "PAID" ? "✓ Betaald & Geboekt" : "Klaar voor SEPA"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ===============================================================
              MODULE 2: CRBP JAARVERSLAG & PDF EXPORT VOOR VREDEGERECHT
             =============================================================== */}
          {activeTab === "crbp" && (
            <div className="stack-lg">
              <div className="card">
                <div className="card-header" style={{ marginBottom: 0 }}>
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                      <h2 className="card-title">
                        Periodiek Verslag Bewindvoering — Model CRBP (Art. 498/3 &amp; 499/14 BW)
                      </h2>
                      <span className="badge badge-ok">100% Transacties Gecategoriseerd</span>
                      <span className="badge badge-inactive">
                        Rechtstreekse Just-on-Web / DPA Integratie: Inactief
                      </span>
                    </div>
                    <p className="card-subtitle">
                      Bevoegde rechtbank: <strong>{activeDossier.canton}</strong> • CRBP-referentie:{" "}
                      <strong className="mono">{activeDossier.crbpRef}</strong> • Export via gegenereerde PDF met
                      inventaris van stavingsstukken.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    <button
                      id="btn-download-crbp-pdf"
                      type="button"
                      className="btn btn-primary"
                      onClick={handleDownloadCrbpPdf}
                    >
                      Genereer &amp; Download CRBP Verslag (PDF voor Vredegerecht)
                    </button>
                    <button
                      id="btn-preview-crbp"
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        setModal({
                          title: `Voorbeeld CRBP Jaarverslag — ${activeDossier.canton}`,
                          subtitle: `Referentie ${activeDossier.crbpRef} • Rechtstreekse Just-on-Web indiening is inactief`,
                          type: "crbp-preview"
                        })
                      }
                    >
                      Bekijk Verslagopbouw
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid-4">
                <div className="card">
                  <p className="card-subtitle">Totaal Geïnde Inkomsten (Jaar)</p>
                  <p className="metric-value">{formatEUR(totalIncome)}</p>
                  <p className="card-subtitle">Grondslag ereloonberekening</p>
                </div>
                <div className="card">
                  <p className="card-subtitle">Totaal Uitgaven (incl. Ereloon)</p>
                  <p className="metric-value">{formatEUR(totalExpensesWithFee)}</p>
                  <p className="card-subtitle">Alle stavingsstukken gekoppeld</p>
                </div>
                <div className="card">
                  <p className="card-subtitle">Wettelijk Forfait Ereloon (3%)</p>
                  <p className="metric-value">{formatEUR(legalFeeForfait)}</p>
                  <p className="card-subtitle">Conform Art. 497/5 BW</p>
                </div>
                <div className="card">
                  <p className="card-subtitle">Netto Jaaroverschot / -tekort</p>
                  <p className="metric-value">
                    {netAnnualResult >= 0 ? "+" : ""}
                    {formatEUR(netAnnualResult)}
                  </p>
                  <p className="card-subtitle">Liquide middelen: {formatEUR(totalLiquidAssets)}</p>
                </div>
              </div>

              {/* Rubrieken Ontvangsten & Uitgaven */}
              <div className="grid-2">
                <div className="card stack-lg">
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <h3 className="card-title">Deel I — Ontvangsten per CRBP-Rubriek</h3>
                    <strong>{formatEUR(totalIncome)}</strong>
                  </div>
                  <div className="stack-lg" style={{ gap: "10px" }}>
                    {activeDossier.annualIncomes.map((inc) => (
                      <div key={inc.code} className="list-item-box">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="badge badge-neutral mono">{inc.code}</span>
                            <strong style={{ fontSize: "13px" }}>{categories[inc.code]?.label || inc.code}</strong>
                          </div>
                          <p className="card-subtitle" style={{ marginTop: "4px" }}>
                            {inc.description} • {inc.docsCount} bewijsstukken
                          </p>
                        </div>
                        <strong>{formatEUR(inc.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card stack-lg">
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <h3 className="card-title">Deel II — Uitgaven per CRBP-Rubriek</h3>
                    <strong>{formatEUR(totalExpensesWithFee)}</strong>
                  </div>
                  <div className="stack-lg" style={{ gap: "10px" }}>
                    {activeDossier.annualExpenses.map((exp) => (
                      <div key={exp.code} className="list-item-box">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="badge badge-neutral mono">{exp.code}</span>
                            <strong style={{ fontSize: "13px" }}>{categories[exp.code]?.label || exp.code}</strong>
                          </div>
                          <p className="card-subtitle" style={{ marginTop: "4px" }}>
                            {exp.description} • {exp.docsCount} PDF-facturen
                          </p>
                        </div>
                        <strong>{formatEUR(exp.amount)}</strong>
                      </div>
                    ))}
                    <div className="list-item-box">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="badge badge-neutral mono">UIT-05</span>
                          <strong style={{ fontSize: "13px" }}>
                            {categories["UIT-05"]?.label || "Staat van kosten en ereloon"}
                          </strong>
                        </div>
                        <p className="card-subtitle" style={{ marginTop: "4px" }}>
                          Automatisch berekend: 3% op {formatEUR(totalIncome)} (Art. 497/5 BW)
                        </p>
                      </div>
                      <strong>{formatEUR(legalFeeForfait)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actuele Vermogenstoestand */}
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: "12px" }}>
                  Deel III — Actuele Vermogenstoestand (Opgenomen in PDF voor het Vredegerecht)
                </h3>
                <div className="grid-4">
                  <div className="list-item-box">
                    <div>
                      <p className="card-subtitle">Beheerrekening ({activeDossier.accounts.management.iban})</p>
                      <p style={{ fontWeight: 700, fontSize: "15px", marginTop: "2px" }}>
                        {formatEUR(activeDossier.accounts.management.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="list-item-box">
                    <div>
                      <p className="card-subtitle">Leefgeldrekening ({activeDossier.accounts.allowance.iban})</p>
                      <p style={{ fontWeight: 700, fontSize: "15px", marginTop: "2px" }}>
                        {formatEUR(activeDossier.accounts.allowance.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="list-item-box">
                    <div>
                      <p className="card-subtitle">Spaarrekening ({activeDossier.accounts.savings.iban})</p>
                      <p style={{ fontWeight: 700, fontSize: "15px", marginTop: "2px" }}>
                        {formatEUR(activeDossier.accounts.savings.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="list-item-box">
                    <div>
                      <p className="card-subtitle">Onroerend &amp; Roerend Patrimonium</p>
                      <p style={{ fontWeight: 700, fontSize: "15px", marginTop: "2px" }}>
                        {formatEUR(totalRealEstate)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MODULE 3: WZC ZORGPORTAAL & SJABLOON-AUTOMATISATIE
             =============================================================== */}
          {activeTab === "care" && (
            <div className="grid-2">
              <div className="stack-lg">
                {/* New Care Request Form */}
                <div className="card stack-lg">
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <div>
                      <h2 className="card-title">Gestructureerde Uitgave-aanvraag (WZC / Thuiszorg Portaal)</h2>
                      <p className="card-subtitle">
                        Dien een aanvraag in voor kleding, medische hulpmiddelen of comfortuitgaven.
                      </p>
                    </div>
                    <span className="badge badge-ok">Directe Budgetkoppeling</span>
                  </div>

                  <form
                    style={{ display: "grid", gap: "12px" }}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!careTitle.trim() || !careAmount) return;
                      await dispatchAction("SUBMIT_CARE_REQUEST", {
                        title: careTitle,
                        amount: Number(careAmount),
                        justification: careJustification,
                        requesterName:
                          roleMode === "care" ? "Hoofdverpleging WZC Portaal" : "Kantoorinvoer De Smet"
                      });
                      setCareTitle("");
                      setCareAmount("");
                      setCareJustification("");
                      notify("Zorgaanvraag Geregistreerd", `Aanvraag "${careTitle}" is toegevoegd aan het dossier.`);
                    }}
                  >
                    <div>
                      <label htmlFor="care-title-input" className="card-subtitle" style={{ display: "block", marginBottom: "4px" }}>
                        Omschrijving benodigdheid (bv. bril, orthopedische schoenen, gehoorapparaat)
                      </label>
                      <input
                        id="care-title-input"
                        type="text"
                        required
                        className="input-field"
                        style={{ width: "100%" }}
                        placeholder="Bv. Nieuwe multifocale bril na oogartsconsult"
                        value={careTitle}
                        onChange={(e) => setCareTitle(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "12px" }}>
                      <div>
                        <label htmlFor="care-amount-input" className="card-subtitle" style={{ display: "block", marginBottom: "4px" }}>
                          Bedrag (€)
                        </label>
                        <input
                          id="care-amount-input"
                          type="number"
                          step="0.5"
                          min="5"
                          required
                          className="input-field"
                          style={{ width: "100%" }}
                          placeholder="145.00"
                          value={careAmount}
                          onChange={(e) => setCareAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="care-just-input" className="card-subtitle" style={{ display: "block", marginBottom: "4px" }}>
                          Motivatie zorgteam / bijgevoegd bestek
                        </label>
                        <input
                          id="care-just-input"
                          type="text"
                          required
                          className="input-field"
                          style={{ width: "100%" }}
                          placeholder="Bv. Bestek opticien bijgevoegd; noodzakelijk voor valpreventie."
                          value={careJustification}
                          onChange={(e) => setCareJustification(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button id="btn-submit-care-req" type="submit" className="btn btn-primary">
                        + Dien Zorgaanvraag In
                      </button>
                    </div>
                  </form>
                </div>

                {/* Existing Care Requests */}
                <div className="card stack-lg">
                  <h3 className="card-title">
                    Behandelde &amp; Openstaande Zorgaanvragen ({activeDossier.careRequests.length})
                  </h3>
                  {activeDossier.careRequests.length === 0 ? (
                    <p className="card-subtitle">Geen zorgaanvragen geregistreerd voor dit dossier.</p>
                  ) : (
                    <div className="stack-lg" style={{ gap: "10px" }}>
                      {activeDossier.careRequests.map((req) => (
                        <div key={req.id} className="list-item-box">
                          <div style={{ maxWidth: "460px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <strong>{req.title}</strong>
                              <span className="badge badge-neutral mono">{req.crbpCode}</span>
                            </div>
                            <p className="card-subtitle" style={{ marginTop: "4px" }}>
                              {req.justification}
                            </p>
                            <p className="card-subtitle">
                              Door: <strong>{req.requesterName}</strong> ({req.requesterOrg}) • {req.date}
                            </p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <strong style={{ fontSize: "14px" }}>{formatEUR(req.amount)}</strong>
                            {req.status === "PENDING" && roleMode === "admin" ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={async () => {
                                    await dispatchAction("DECIDE_CARE_REQUEST", {
                                      requestId: req.id,
                                      decision: "APPROVED"
                                    });
                                    notify(
                                      "Zorgaanvraag Goedgekeurd",
                                      `"${req.title}" is goedgekeurd en klaargezet bij de SEPA-facturen.`
                                    );
                                  }}
                                >
                                  Goedkeuren &amp; Klaarzetten
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={async () => {
                                    await dispatchAction("DECIDE_CARE_REQUEST", {
                                      requestId: req.id,
                                      decision: "REJECTED"
                                    });
                                    notify("Zorgaanvraag Afgewezen", `Aanvraag "${req.title}" werd afgewezen.`);
                                  }}
                                >
                                  Afwijzen
                                </button>
                              </>
                            ) : (
                              <span
                                className={`badge ${
                                  req.status === "APPROVED"
                                    ? "badge-ok"
                                    : req.status === "REJECTED"
                                    ? "badge-inactive"
                                    : "badge-neutral"
                                }`}
                              >
                                {req.status === "APPROVED"
                                  ? "✓ Goedgekeurd"
                                  : req.status === "REJECTED"
                                  ? "Afgewezen"
                                  : "In behandeling"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Official Notification Letters (Sjabloon-automatisatie) */}
              <div className="card stack-lg" style={{ height: "fit-content" }}>
                <div>
                  <h2 className="card-title">Sjabloon-Automatisatie Kennisgevingsbrieven (Art. 492/1 BW)</h2>
                  <p className="card-subtitle">
                    Genereer officiële kennisgevingen van aanstelling bewindvoerder voor banken, overheden en nutsbedrijven.
                  </p>
                </div>

                <div className="stack-lg" style={{ gap: "12px" }}>
                  {[
                    {
                      key: "fod" as const,
                      title: "FOD Financiën & Vlaamse Belastingdienst",
                      desc: "Kennisgeving bewindvoering en doorsturen aanslagbiljetten naar kantooradres."
                    },
                    {
                      key: "mutuality" as const,
                      title: `Ziekenfonds (${activeDossier.mutuality}) & VSB`,
                      desc: "Koppeling terugbetalingen gezondheidszorg en Vlaams Zorgbudget aan beheerrekening."
                    },
                    {
                      key: "banks" as const,
                      title: "Febelfin / Bankenprotocol (KBC, Belfius, BNP, ING)",
                      desc: "Blokkering volmachten derden en activatie beheerrekening + aparte zakgeldrekening."
                    },
                    {
                      key: "utilities" as const,
                      title: "Nutsbedrijven & Leveranciers (Bescherming Deurwaarder)",
                      desc: "Melding rechterlijke bescherming om invorderingskosten op het thuisadres te vermijden."
                    }
                  ].map((item) => (
                    <div key={item.key} className="list-item-box">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong>{item.title}</strong>
                          <span
                            className={`badge ${
                              activeDossier.notificationsSent[item.key] ? "badge-ok" : "badge-inactive"
                            }`}
                          >
                            {activeDossier.notificationsSent[item.key] ? "✓ Verzonden" : "Nog te melden"}
                          </span>
                        </div>
                        <p className="card-subtitle" style={{ marginTop: "4px", marginBottom: "10px" }}>
                          {item.desc}
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() =>
                            setModal({
                              title: `Officiële Kennisgeving van Bewindvoering — ${item.title}`,
                              subtitle: `Dossier ${activeDossier.name} (CRBP ${activeDossier.crbpRef})`,
                              type: "letter",
                              letterKey: item.key,
                              letterTitle: item.title
                            })
                          }
                        >
                          Genereer &amp; Verstuur Kennisgevingsbrief
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MODULE 4: WONING, INVENTARIS & CONTRACTOPZEGGINGEN
             =============================================================== */}
          {activeTab === "estate" && (
            <div className="stack-lg">
              <div className="card stack-lg">
                <div className="card-header" style={{ marginBottom: 0 }}>
                  <div>
                    <h2 className="card-title">
                      Woning- &amp; Boedelinventaris (Aanvangsvermogensverslag &amp; Art. 499/7 BW)
                    </h2>
                    <p className="card-subtitle">
                      Registratie van onroerende en roerende goederen met tijdstempel-foto&apos;s en machtigingen van de vrederechter.
                    </p>
                  </div>
                </div>

                {/* Add New Inventory Item Form */}
                <form
                  className="notice-bar"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!assetName.trim() || !assetValue) return;
                    await dispatchAction("ADD_ASSET", {
                      name: assetName,
                      estimatedValue: Number(assetValue),
                      judicialAuthRef:
                        assetAuthRef || "Opgenomen in plaatsbeschrijving & CRBP vermogensoverzicht"
                    });
                    setAssetName("");
                    setAssetValue("");
                    setAssetAuthRef("");
                    notify("Boedelstuk Toegevoegd", `"${assetName}" is toegevoegd aan de inventaris.`);
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", flex: 1 }}>
                    <input
                      type="text"
                      required
                      className="input-field"
                      style={{ flex: "1 1 220px" }}
                      placeholder="Naam boedelstuk (bv. Gouden zakhorloge of Personenwagen)"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                    />
                    <input
                      type="number"
                      required
                      className="input-field"
                      style={{ width: "140px" }}
                      placeholder="Waarde (€)"
                      value={assetValue}
                      onChange={(e) => setAssetValue(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-field"
                      style={{ flex: "1 1 240px" }}
                      placeholder="Beschikkingsreferentie Vrederechter (optioneel)"
                      value={assetAuthRef}
                      onChange={(e) => setAssetAuthRef(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary">
                    + Boedelstuk Toevoegen
                  </button>
                </form>

                <div className="grid-2">
                  {activeDossier.assets.map((asset) => (
                    <div key={asset.id} className="list-item-box" style={{ alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "14px" }}>{asset.name}</strong>
                          <span className="badge badge-neutral">{asset.category}</span>
                        </div>
                        <p className="card-subtitle" style={{ marginTop: "3px" }}>
                          Locatie: {asset.location} • {asset.photoCount} tijdstempel-foto&apos;s
                        </p>
                        <p className="card-subtitle" style={{ marginTop: "4px" }}>
                          <strong>Rechtsgrond:</strong> {asset.judicialAuthRef}
                        </p>
                        <p style={{ fontSize: "12.5px", fontWeight: 600, marginTop: "4px" }}>
                          Status: {asset.status}
                        </p>
                      </div>
                      <strong style={{ fontSize: "15px" }}>{formatEUR(asset.estimatedValue)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contract Termination Hub */}
              <div className="card stack-lg">
                <div className="card-header" style={{ marginBottom: 0 }}>
                  <div>
                    <h2 className="card-title">
                      Contractbeëindigingshub (Opzeg Abonnementen &amp; Nutsvoorzieningen bij Verhuis WZC)
                    </h2>
                    <p className="card-subtitle">
                      Zeg lopende abonnementen op het oude thuisadres op met bijgevoegd WZC-opnameattest en beschikking bewindvoering.
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ textAlign: "right", fontSize: "12.5px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Reeds bespaard voor dossier: </span>
                      <strong>{formatEUR(terminatedSavingsYearly)} / jaar</strong>
                    </div>
                    {activeContracts.length > 0 && (
                      <button
                        id="btn-terminate-all"
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          await dispatchAction("TERMINATE_ALL_CONTRACTS");
                          notify(
                            "Alle Thuiscontracten Opgezegd",
                            `Opzegbrieven verzonden voor ${activeContracts.length} contracten.`
                          );
                        }}
                      >
                        Zeg Alle {activeContracts.length} Contracten Op (Bespaar {formatEUR(monthlyActiveCost)}/m)
                      </button>
                    )}
                  </div>
                </div>

                {activeDossier.contracts.length === 0 ? (
                  <p className="card-subtitle">Geen lopende thuiscontracten geregistreerd voor dit dossier.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Leverancier &amp; Contract</th>
                          <th>Contractnummer</th>
                          <th>Reden &amp; Juridisch Bewijsstuk</th>
                          <th style={{ textAlign: "right" }}>Maandkost</th>
                          <th style={{ textAlign: "right" }}>Status / Actie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDossier.contracts.map((ct) => (
                          <tr key={ct.id}>
                            <td style={{ fontWeight: 600 }}>{ct.provider}</td>
                            <td className="mono">{ct.contractNr}</td>
                            <td style={{ color: "var(--text-secondary)" }}>{ct.reason}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{formatEUR(ct.monthlyCost)} / m</td>
                            <td style={{ textAlign: "right" }}>
                              {ct.status === "ACTIVE" ? (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={async () => {
                                    await dispatchAction("TERMINATE_CONTRACT", { contractId: ct.id });
                                    notify(
                                      `Contract ${ct.provider} Opgezegd`,
                                      `Jaarlijkse besparing: ${formatEUR(ct.monthlyCost * 12)}.`
                                    );
                                  }}
                                >
                                  Verstuur Opzegbrief
                                </button>
                              ) : (
                                <span className="badge badge-ok">✓ Opgezegd (Eindfactuur volgt)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Persistent Audit Log Section */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: "10px" }}>
              <div>
                <h3 className="card-title">Onweerlegbare Audit Trail (Dossier {activeDossier.crbpRef})</h3>
                <p className="card-subtitle">
                  Elke actie op dit dossier wordt chronologisch gelogd ten behoeve van de verantwoording aan de vrederechter.
                </p>
              </div>
            </div>
            <div className="stack-lg" style={{ gap: "8px" }}>
              {activeDossier.auditTrail.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    fontSize: "12.5px",
                    padding: "8px 12px",
                    backgroundColor: "var(--bg-subtle)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)"
                  }}
                >
                  <span>
                    <strong>{entry.actor}:</strong> {entry.action}
                  </span>
                  <span className="mono" style={{ color: "var(--text-secondary)" }}>
                    {entry.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Modal Overlay */}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal-panel" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2 className="card-title">{modal.title}</h2>
                <p className="card-subtitle">{modal.subtitle}</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Sluiten
              </button>
            </div>

            <div className="modal-body">
              {modal.type === "sepa" && (
                <>
                  <div className="notice-bar">
                    <span>
                      Debetrekening: <strong>{activeDossier.accounts.management.iban}</strong> (Live PSD2-koppeling staat op inactief; exporteer XML of boek lokaal af)
                    </span>
                  </div>
                  <pre className="code-block">{modal.content}</pre>
                </>
              )}

              {modal.type === "crbp-preview" && (
                <>
                  <div className="list-item-box">
                    <div>
                      <strong>1. Identificatie &amp; Levensomstandigheden (Bescherming van de Persoon)</strong>
                      <p className="card-subtitle" style={{ marginTop: "4px" }}>
                        {activeDossier.name} ({activeDossier.birthDate}, RRN {activeDossier.rrnMasked}) verblijft in{" "}
                        {activeDossier.livingSituation}. Wekelijks leefgeld: {formatEUR(activeDossier.weeklyAllowance)}.
                      </p>
                    </div>
                  </div>
                  <div className="list-item-box">
                    <div style={{ width: "100%" }}>
                      <strong>2. Financieel Overzicht &amp; Staat van Ereloon (Art. 497/5 BW)</strong>
                      <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Totaal Ontvangsten (INK-01 t/m INK-03):</span>
                          <strong>{formatEUR(totalIncome)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Totaal Uitgaven (UIT-01 t/m UIT-04):</span>
                          <strong>{formatEUR(baseExpenses)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Wettelijk Forfait Ereloon Bewindvoerder (3%):</span>
                          <strong>{formatEUR(legalFeeForfait)}</strong>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            paddingTop: "6px",
                            borderTop: "1px solid var(--border-subtle)"
                          }}
                        >
                          <span>Eindsaldo Beheerrekening + Spaarrekening:</span>
                          <strong>{formatEUR(totalLiquidAssets)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {modal.type === "letter" && (
                <div className="list-item-box mono" style={{ lineHeight: "1.6", whiteSpace: "pre-line" }}>
                  {`AANGETEKEND / KENNISGEVING ART. 492/1 BURGERLIJK WETBOEK
Aan: ${modal.letterTitle}
Betreft: Rechterlijke beschermingsmaatregel ${activeDossier.name} (RRN ${activeDossier.rrnMasked})
Beschikking: ${activeDossier.canton} d.d. ${activeDossier.appointmentDate} (CRBP ${activeDossier.crbpRef})

Geachte mevrouw, geachte heer,

Bij beschikking van het ${activeDossier.canton} werd ondergetekende, Mr. Jan De Smet, aangesteld als bewindvoerder over de goederen en de persoon van ${activeDossier.name}.

Gelieve alle briefwisseling en facturen te richten aan het kantoor van de bewindvoerder en alle betalingen uitsluitend uit te voeren op beheerrekening ${activeDossier.accounts.management.iban}.

Met bijzondere hoogachting,
Mr. Jan De Smet, Advocaat-Bewindvoerder`}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {modal.type === "sepa" && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const blob = new Blob([modal.content || ""], { type: "application/xml" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `SEPA_${activeDossier.crbpRef.replace(/\//g, "_")}.xml`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download pain.001 XML Bestand
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      await dispatchAction("EXECUTE_SEPA_BATCH");
                      setModal(null);
                      notify(
                        "SEPA Betaalbatch Verwerkt",
                        `${selectedInvoices.length} facturen (${formatEUR(
                          batchTotal
                        )}) geboekt onder de CRBP-rubrieken.`
                      );
                    }}
                  >
                    Boek Batch Af in Dossier ({formatEUR(batchTotal)})
                  </button>
                </>
              )}

              {modal.type === "crbp-preview" && (
                <>
                  <button type="button" className="btn btn-secondary" disabled>
                    Rechtstreekse Just-on-Web Indiening (Inactief)
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      handleDownloadCrbpPdf();
                      setModal(null);
                    }}
                  >
                    Genereer &amp; Download PDF voor Vredegerecht
                  </button>
                </>
              )}

              {modal.type === "letter" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await dispatchAction("SEND_NOTIFICATION", {
                      key: modal.letterKey,
                      title: modal.letterTitle
                    });
                    setModal(null);
                    notify(
                      "Kennisgevingsbrief Verzonden",
                      `Melding aan ${modal.letterTitle} vastgelegd in het dossier.`
                    );
                  }}
                >
                  Bevestig Verzending &amp; Archiveer in Dossier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast-banner" role="status">
          <div style={{ fontWeight: 700 }}>{toast.title}</div>
          <div style={{ color: "var(--text-banner-muted)", marginTop: "2px" }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
