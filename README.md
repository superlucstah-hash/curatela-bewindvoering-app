# Curatela — Platform voor Professionele Bewindvoering (CRBP & Vredegerecht)

Full-stack **Next.js + TypeScript** applicatie gericht op professionele bewindvoerders (advocaten en gespecialiseerde kantoren) voor het beheer van de goederen en de persoon van beschermde personen onder het Belgisch bewindvoeringsrecht (Boek 1, Titel XI Burgerlijk Wetboek).

## Functionaliteiten

1. **Financieel & Factuurbeheer (Lokale SEPA XML Batches):**
   - Overzicht van Beheerrekeningen, Leefgeldrekeningen (met instelbaar wekelijks leefgeld en automatische saldobewaker) en Spaarrekeningen (`Art. 499/7 BW`).
   - Slimme OCR/Peppol factuurwachtrij met Modulo-97 validatie op Belgische gestructureerde mededelingen (`+++xxx/xxxx/xxxxx+++`) en automatische toewijzing aan wettelijke CRBP-rubrieken.
   - Generatie en download van `ISO 20022 pain.001.001.03` SEPA XML-bestanden. *(Live PSD2-bankkoppeling staat bewust op **Inactief**).*
2. **CRBP Jaarverslag & PDF-Export voor het Vredegerecht:**
   - Realtime rubricering van ontvangsten (`INK-01` t/m `INK-03`) en uitgaven (`UIT-01` t/m `UIT-05`, inclusief automatische berekening van het 3% forfaitair ereloon conform `Art. 497/5 BW`).
   - Server-side PDF-generator (`/api/dossiers/[id]/crbp-pdf`) die een officieel 2-pagina's tellend PDF-verslag genereert voor het Vredegerecht inclusief vermogenstoestand en genummerde inventaris van stavingsstukken. *(Rechtstreekse Just-on-Web / DPA-integratie staat op **Inactief**).*
3. **WZC Zorgverlenersportaal & Sjabloon-Automatisatie:**
   - Schakel tussen **Advocaat-Bewindvoerder** en **WZC Zorgportaal (GDPR-beperkt)** voor het indienen en goedkeuren van extra zorg- en comfortaanvragen.
   - 1-klik generatie van officiële kennisgevingsbrieven van aanstelling bewindvoerder (`Art. 492/1 BW`) naar FOD Financiën, ziekenfondsen, banken en nutsbedrijven.
4. **Woning-, Inventaris- & Contractbeëindigingshub:**
   - Plaatsbeschrijving en registratie van onroerende en roerende boedelstukken.
   - Opzegmodule voor lopende abonnementen en nutsvoorzieningen bij definitieve opname in een woonzorgcentrum.

## Lokaal opstarten op je eigen computer

```bash
git clone https://github.com/superlucstah-hash/curatela-bewindvoering.git
cd curatela-bewindvoering
npm install
npm run dev
```

Open daarna `http://localhost:3000` in je browser.

## Architectuurdocumentatie

Zie [ARCHITECTURE.md](./ARCHITECTURE.md) voor het volledige technische ontwerp (Systeemarchitectuur, PostgreSQL ERD & DDL, Prisma-schema en GDPR-richtlijnen).
