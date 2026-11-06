import fs from "fs";
import path from "path";

export interface CrbpCategoryMeta {
  label: string;
  type: "INCOME" | "EXPENSE";
}

export const CRBP_CATEGORIES: Record<string, CrbpCategoryMeta> = {
  "INK-01": { label: "Rust- en overlevingspensioen (FPD)", type: "INCOME" },
  "INK-02": { label: "Vlaams Zorgbudget / Tegemoetkoming hulp aan bejaarden", type: "INCOME" },
  "INK-03": { label: "Roerende & onroerende inkomsten (Huur / Interest)", type: "INCOME" },
  "UIT-01": { label: "Verblijfskosten WZC / Huisvesting", type: "EXPENSE" },
  "UIT-02": { label: "Medische, ziekenhuis- en apotheekkosten", type: "EXPENSE" },
  "UIT-03": { label: "Leefgeld & persoonlijke uitgaven (Zakgeldrekening)", type: "EXPENSE" },
  "UIT-04": { label: "Nutsvoorzieningen, telecom & verzekeringen", type: "EXPENSE" },
  "UIT-05": { label: "Staat van kosten en ereloon bewindvoerder (Art. 497/5 BW)", type: "EXPENSE" }
};

export interface BankAccountInfo {
  iban: string;
  bank: string;
  balance: number;
}

export interface AnnualLineItem {
  code: string;
  description: string;
  amount: number;
  docsCount: number;
}

export interface InvoiceItem {
  id: string;
  supplier: string;
  iban: string;
  amount: number;
  ogm: string;
  ogmValid: boolean;
  dueDate: string;
  crbpCode: string;
  source: string;
  confidence: number;
  status: "READY" | "PAID";
  selected: boolean;
}

export interface CareRequestItem {
  id: string;
  requesterOrg: string;
  requesterName: string;
  title: string;
  justification: string;
  amount: number;
  crbpCode: string;
  date: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface AssetItem {
  id: string;
  name: string;
  location: string;
  estimatedValue: number;
  category: string;
  judicialAuthRequired: boolean;
  judicialAuthRef: string;
  photoCount: number;
  status: string;
}

export interface ContractItem {
  id: string;
  provider: string;
  contractNr: string;
  monthlyCost: number;
  reason: string;
  status: "ACTIVE" | "TERMINATED";
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
}

export interface DossierRecord {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  rrnMasked: string;
  crbpRef: string;
  canton: string;
  appointmentDate: string;
  reportDue: string;
  scope: string;
  livingSituation: string;
  katzScale: string;
  mutuality: string;
  weeklyAllowance: number;
  minBuffer: number;
  integrations: {
    bankConnectionActive: boolean;
    justOnWebConnectionActive: boolean;
  };
  accounts: {
    management: BankAccountInfo;
    allowance: BankAccountInfo;
    savings: BankAccountInfo;
  };
  annualIncomes: AnnualLineItem[];
  annualExpenses: AnnualLineItem[];
  invoices: InvoiceItem[];
  careRequests: CareRequestItem[];
  notificationsSent: {
    fod: boolean;
    mutuality: boolean;
    banks: boolean;
    utilities: boolean;
  };
  assets: AssetItem[];
  contracts: ContractItem[];
  auditTrail: AuditEntry[];
}

export interface CuratelaDatabase {
  dossiers: DossierRecord[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "curatela-db.json");

const INITIAL_DB: CuratelaDatabase = {
  dossiers: [
    {
      id: "dos-1",
      name: "Roger Vandenberghe",
      age: 84,
      birthDate: "14/03/1942",
      rrnMasked: "42.03.14-189.64",
      crbpRef: "2024/ANT2/08419",
      canton: "Vredegerecht 2de Kanton Antwerpen",
      appointmentDate: "12/09/2024",
      reportDue: "30/09/2027",
      scope: "Goederen & Persoon (Vertegenwoordiging)",
      livingSituation: "WZC Sint-Camillus Antwerpen (Kamer 204)",
      katzScale: "Katz B",
      mutuality: "CM Antwerpen (101)",
      weeklyAllowance: 85,
      minBuffer: 1500,
      integrations: {
        bankConnectionActive: false,
        justOnWebConnectionActive: false
      },
      accounts: {
        management: { iban: "BE68 5390 0754 7034", bank: "KBC Beheerrekening", balance: 4820.50 },
        allowance: { iban: "BE42 5390 0811 2290", bank: "KBC Leefgeldrekening", balance: 245.00 },
        savings: { iban: "BE91 0018 4429 1055", bank: "BNP Paribas Spaarrekening (Geblokkeerd)", balance: 68400.00 }
      },
      annualIncomes: [
        { code: "INK-01", description: "Federale Pensioendienst (FPD) - 12 maanden", amount: 23760.00, docsCount: 12 },
        { code: "INK-02", description: "Vlaams Zorgbudget voor zwaar zorgbehoevenden (EUR 140/m)", amount: 1680.00, docsCount: 12 },
        { code: "INK-03", description: "Rente gereglementeerde spaarrekening", amount: 820.00, docsCount: 1 }
      ],
      annualExpenses: [
        { code: "UIT-01", description: "Maandelijkse woonzorgcentrumfacturen WZC Sint-Camillus", amount: 22140.00, docsCount: 11 },
        { code: "UIT-02", description: "Apotheek, remgeld huisarts & hospitalisatie ZNA", amount: 1495.40, docsCount: 19 },
        { code: "UIT-03", description: "Doorstortingen wekelijks leefgeld (EUR 85/week)", amount: 4420.00, docsCount: 52 },
        { code: "UIT-04", description: "Familiale verzekering & opzegkosten oude woning", amount: 318.20, docsCount: 4 }
      ],
      invoices: [
        {
          id: "inv-101",
          supplier: "WZC Sint-Camillus vzw",
          iban: "BE31 7330 4912 8821",
          amount: 2165.40,
          ogm: "+++090/9337/55493+++",
          ogmValid: true,
          dueDate: "15/11/2026",
          crbpCode: "UIT-01",
          source: "Peppol e-Invoicing",
          confidence: 99,
          status: "READY",
          selected: true
        },
        {
          id: "inv-102",
          supplier: "Apotheek De Linde (Maandafrekening WZC)",
          iban: "BE84 3631 2098 4410",
          amount: 142.85,
          ogm: "+++104/8821/30948+++",
          ogmValid: true,
          dueDate: "20/11/2026",
          crbpCode: "UIT-02",
          source: "OCR PDF Mailbox",
          confidence: 98,
          status: "READY",
          selected: true
        },
        {
          id: "inv-103",
          supplier: "ZNA Middelheim (Consultatie Geriatrie)",
          iban: "BE19 0910 1234 9981",
          amount: 64.20,
          ogm: "+++420/1190/44286+++",
          ogmValid: true,
          dueDate: "28/11/2026",
          crbpCode: "UIT-02",
          source: "Doccle / eBox",
          confidence: 96,
          status: "READY",
          selected: false
        }
      ],
      careRequests: [
        {
          id: "cr-201",
          requesterOrg: "WZC Sint-Camillus — Hoofdverpleging Afd. 2",
          requesterName: "Sofie Vermeulen",
          title: "Orthopedische winterschoenen op maat",
          justification: "Bestaande schoenen geven drukwonden; voorschrift geriater bijgevoegd.",
          amount: 165.00,
          crbpCode: "UIT-03",
          date: "04/11/2026",
          status: "PENDING"
        },
        {
          id: "cr-202",
          requesterOrg: "WZC Sint-Camillus — Sociale Dienst",
          requesterName: "Marc Janssens",
          title: "Herstelling gehoorapparaat rechts (Lapperre)",
          justification: "Toestel werkt niet meer na val op kamer; bestek van EUR 95,00 ontvangen.",
          amount: 95.00,
          crbpCode: "UIT-02",
          date: "05/11/2026",
          status: "PENDING"
        },
        {
          id: "cr-203",
          requesterOrg: "WZC Sint-Camillus — Animatie & Zorg",
          requesterName: "Sofie Vermeulen",
          title: "Winterjas en 3 wollen truien",
          justification: "Aankoop winterkledij voor familiebezoek en wandelingen.",
          amount: 180.00,
          crbpCode: "UIT-03",
          date: "22/10/2026",
          status: "APPROVED"
        }
      ],
      notificationsSent: {
        fod: true,
        mutuality: true,
        banks: true,
        utilities: false
      },
      assets: [
        {
          id: "as-1",
          name: "Voormalige gezinswoning (Rijwoning)",
          location: "Kerkstraat 84, 2140 Borgerhout",
          estimatedValue: 265000,
          category: "Onroerend goed",
          judicialAuthRequired: true,
          judicialAuthRef: "Beschikking Art. 499/7 BW — Rolnr. 26A1092 (Machtiging onderhandse verkoop)",
          photoCount: 18,
          status: "Te koop via notaris (Compromis in opmaak)"
        },
        {
          id: "as-2",
          name: "Inboedel & antieke eiken eetkamer",
          location: "Kerkstraat 84, 2140 Borgerhout",
          estimatedValue: 1850,
          category: "Roerend goed (Plaatsbeschrijving)",
          judicialAuthRequired: false,
          judicialAuthRef: "Opgenomen in aanvangsvermogensverslag CRBP",
          photoCount: 12,
          status: "Geinventariseerd met tijdstempel"
        }
      ],
      contracts: [
        { id: "ct-1", provider: "Telenet (All-Internet + TV)", contractNr: "KL-8849201", monthlyCost: 84.50, reason: "Verhuis naar WZC Sint-Camillus", status: "ACTIVE" },
        { id: "ct-2", provider: "Engie Electrabel (Gas & Elektriciteit)", contractNr: "EAN-541448820019", monthlyCost: 145.00, reason: "Leegstandstarief / Overdracht bij verkoop", status: "ACTIVE" },
        { id: "ct-3", provider: "Mediahuis (Gazet van Antwerpen Papier)", contractNr: "ABO-33910", monthlyCost: 34.00, reason: "Omgezet naar collectieve leesmap WZC", status: "TERMINATED" },
        { id: "ct-4", provider: "Water-link (Drinkwater)", contractNr: "WL-992011", monthlyCost: 26.00, reason: "Afsluiting wegens definitieve opname WZC", status: "ACTIVE" }
      ],
      auditTrail: [
        {
          id: "aud-1",
          timestamp: "06/11/2026 09:15",
          actor: "Mr. Jan De Smet (Advocaat-Bewindvoerder)",
          action: "OCR-factuur WZC Sint-Camillus gevalideerd (Modulo-97 OGM gecontroleerd)."
        }
      ]
    },
    {
      id: "dos-2",
      name: "Maria Janssens",
      age: 79,
      birthDate: "28/07/1947",
      rrnMasked: "47.07.28-312.18",
      crbpRef: "2025/GNT1/03102",
      canton: "Vredegerecht 1ste Kanton Gent",
      appointmentDate: "03/02/2025",
      reportDue: "28/02/2027",
      scope: "Goederen & Persoon (Vertegenwoordiging)",
      livingSituation: "Thuiswonend met Familiehulp (Overstap WZC gepland)",
      katzScale: "Katz A",
      mutuality: "Solidaris Oost-Vlaanderen (306)",
      weeklyAllowance: 110,
      minBuffer: 1200,
      integrations: {
        bankConnectionActive: false,
        justOnWebConnectionActive: false
      },
      accounts: {
        management: { iban: "BE12 0689 3310 4492", bank: "Belfius Beheerrekening", balance: 2890.15 },
        allowance: { iban: "BE55 0689 3310 8810", bank: "Belfius Leefgeldkaart", balance: 165.40 },
        savings: { iban: "BE77 0689 9901 1120", bank: "Belfius Spaarrekening", balance: 19450.00 }
      },
      annualIncomes: [
        { code: "INK-01", description: "Overlevingspensioen FPD - 12 maanden", amount: 21480.00, docsCount: 12 },
        { code: "INK-02", description: "Zorgbudget voor ouderen met zorgnood", amount: 3120.00, docsCount: 12 }
      ],
      annualExpenses: [
        { code: "UIT-01", description: "Sociale huurwoning De Gentse Haard", amount: 7440.00, docsCount: 12 },
        { code: "UIT-02", description: "Thuisverpleging Wit-Gele Kruis & Gezinszorg Familiehulp", amount: 4890.00, docsCount: 24 },
        { code: "UIT-03", description: "Wekelijks leefgeld & warme maaltijden aan huis", amount: 6420.00, docsCount: 52 },
        { code: "UIT-04", description: "Luminus energie, Proximus & brandverzekering", amount: 2980.00, docsCount: 16 }
      ],
      invoices: [
        {
          id: "inv-201",
          supplier: "Familiehulp vzw (Gezinszorg Oktober)",
          iban: "BE44 7340 1122 9980",
          amount: 384.60,
          ogm: "+++310/4489/11294+++",
          ogmValid: true,
          dueDate: "18/11/2026",
          crbpCode: "UIT-02",
          source: "Peppol e-Invoicing",
          confidence: 99,
          status: "READY",
          selected: true
        },
        {
          id: "inv-202",
          supplier: "Traiteur Zorgmaaltijden Gent",
          iban: "BE90 0014 5582 3910",
          amount: 215.00,
          ogm: "+++881/2039/44110+++",
          ogmValid: true,
          dueDate: "22/11/2026",
          crbpCode: "UIT-03",
          source: "OCR PDF Mailbox",
          confidence: 94,
          status: "READY",
          selected: true
        }
      ],
      careRequests: [
        {
          id: "cr-301",
          requesterOrg: "Familiehulp Gent — Wijkverantwoordelijke",
          requesterName: "Annelies De Cock",
          title: "Vervanging defecte microgolfoven voor opwarmen maaltijden",
          justification: "Oude microgolfoven vonkt en is onveilig geworden voor mevrouw.",
          amount: 119.00,
          crbpCode: "UIT-03",
          date: "05/11/2026",
          status: "PENDING"
        }
      ],
      notificationsSent: {
        fod: true,
        mutuality: true,
        banks: true,
        utilities: true
      },
      assets: [
        {
          id: "as-201",
          name: "Huurwaarborgkorf Korfine",
          location: "Vlaanderenstraat 19 bus 2, 9000 Gent",
          estimatedValue: 1860,
          category: "Geblokkeerde waarborg",
          judicialAuthRequired: false,
          judicialAuthRef: "Vrijgave bij einde huurcontract",
          photoCount: 6,
          status: "Actief tot verhuis WZC"
        }
      ],
      contracts: [
        { id: "ct-201", provider: "Proximus (Vaste Telefoon & TV)", contractNr: "PX-661209", monthlyCost: 68.00, reason: "Voorbereiding opname WZC", status: "ACTIVE" }
      ],
      auditTrail: [
        {
          id: "aud-201",
          timestamp: "05/11/2026 14:20",
          actor: "Annelies De Cock (Familiehulp)",
          action: "Nieuwe zorgaanvraag ingediend via Zorgportaal (EUR 119,00)."
        }
      ]
    },
    {
      id: "dos-3",
      name: "Jozef Peeters",
      age: 88,
      birthDate: "05/11/1938",
      rrnMasked: "38.11.05-041.92",
      crbpRef: "2023/LEU1/11940",
      canton: "Vredegerecht 1ste Kanton Leuven",
      appointmentDate: "19/05/2023",
      reportDue: "31/05/2027",
      scope: "Goederen & Persoon (Vertegenwoordiging)",
      livingSituation: "WZC De Vijvers Leuven (Afdeling Dementiezorg)",
      katzScale: "Katz Cd",
      mutuality: "Helan Onafhankelijk Ziekenfonds (526)",
      weeklyAllowance: 60,
      minBuffer: 2000,
      integrations: {
        bankConnectionActive: false,
        justOnWebConnectionActive: false
      },
      accounts: {
        management: { iban: "BE09 3300 6119 8240", bank: "ING Beheerrekening", balance: 6140.80 },
        allowance: { iban: "BE81 3300 6119 9901", bank: "ING Leefgeldrekening", balance: 310.00 },
        savings: { iban: "BE50 3300 9981 0012", bank: "ING Effecten & Spaarrekening", balance: 142000.00 }
      },
      annualIncomes: [
        { code: "INK-01", description: "Ambtenarenpensioen FPD - 12 maanden", amount: 31200.00, docsCount: 12 },
        { code: "INK-02", description: "Vlaams Zorgbudget (EUR 140/m)", amount: 1680.00, docsCount: 12 },
        { code: "INK-03", description: "Huurinkomsten verhuurd appartement Heverlee", amount: 10200.00, docsCount: 12 }
      ],
      annualExpenses: [
        { code: "UIT-01", description: "Verblijfskosten WZC De Vijvers Leuven", amount: 25680.00, docsCount: 12 },
        { code: "UIT-02", description: "UZ Leuven Geriatrie & Medicatie", amount: 2140.00, docsCount: 15 },
        { code: "UIT-03", description: "Leefgeld, pedicure & kapper in WZC", amount: 3120.00, docsCount: 52 },
        { code: "UIT-04", description: "Syndicus- en onroerende voorheffing appartement Heverlee", amount: 2890.00, docsCount: 6 }
      ],
      invoices: [
        {
          id: "inv-301",
          supplier: "WZC De Vijvers Leuven",
          iban: "BE72 0016 8832 1044",
          amount: 2240.00,
          ogm: "+++501/2298/77160+++",
          ogmValid: true,
          dueDate: "14/11/2026",
          crbpCode: "UIT-01",
          source: "Peppol e-Invoicing",
          confidence: 100,
          status: "READY",
          selected: true
        }
      ],
      careRequests: [],
      notificationsSent: {
        fod: true,
        mutuality: true,
        banks: true,
        utilities: true
      },
      assets: [
        {
          id: "as-301",
          name: "Opbrengstappartement (Verhuurd)",
          location: "Naamsesteenweg 210 bus 4, 3001 Heverlee",
          estimatedValue: 310000,
          category: "Onroerend goed (Verhuurd)",
          judicialAuthRequired: false,
          judicialAuthRef: "Regulier beheer — Huurindexatie automatisch opgevolgd",
          photoCount: 24,
          status: "Verhuurd (EUR 850/maand)"
        }
      ],
      contracts: [],
      auditTrail: [
        {
          id: "aud-301",
          timestamp: "01/11/2026 11:00",
          actor: "Systeem (CRBP Categorisatie Engine)",
          action: "Huurinkomsten Heverlee gekoppeld aan CRBP-rubriek INK-03."
        }
      ]
    }
  ]
};

export function readDb(): CuratelaDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), "utf-8");
    return structuredClone(INITIAL_DB);
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw) as CuratelaDatabase;
}

export function writeDb(db: CuratelaDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export function getDossierById(id: string): DossierRecord | undefined {
  const db = readDb();
  return db.dossiers.find((d) => d.id === id);
}
