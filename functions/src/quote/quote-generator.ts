import type { ExtractedProjectData } from './extraction';
import type { PriceEstimate } from './pricing';

const HOURLY_RATE = 65;

const COMPLEXITY_LABEL: Record<string, string> = {
  simple:     'eenvoudig',
  medium:     'gemiddeld',
  complex:    'complex',
  enterprise: 'enterprise',
};

export interface OfferteData {
  quoteId: string;
  extractedData: ExtractedProjectData;
  priceEstimate: PriceEstimate;
  userName: string;
  userEmail: string;
  generatedAt: Date;
}

/**
 * Generates a full HTML offer document from extracted project data and price estimate.
 * The HTML is self-contained (inline CSS) and print-ready.
 */
export function generateOfferteHtml(data: OfferteData): string {
  const { extractedData: ex, priceEstimate: pe, quoteId, userName, generatedAt } = data;

  const dateStr = generatedAt.toLocaleDateString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const validUntilDate = new Date(generatedAt);
  validUntilDate.setDate(validUntilDate.getDate() + 30);
  const validUntilStr = validUntilDate.toLocaleDateString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const clientDisplay = ex.clientName || userName;
  const offerteNr = `WS-${quoteId.slice(0, 8).toUpperCase()}`;

  const totalHoursMin = pe.phaseBreakdowns.reduce((s, p) => s + p.subtotalHoursMin, 0);
  const totalHoursMax = pe.phaseBreakdowns.reduce((s, p) => s + p.subtotalHoursMax, 0);
  const totalPriceMin = pe.phaseBreakdowns.reduce((s, p) => s + p.subtotalPriceMin, 0);
  const totalPriceMax = pe.phaseBreakdowns.reduce((s, p) => s + p.subtotalPriceMax, 0);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offerte — ${escHtml(ex.projectTitle)}</title>
  <style>
    /* ── Design tokens (Watsturen brand) ── */
    :root {
      --brand:        #6366f1;   /* indigo */
      --brand-end:    #8b5cf6;   /* violet */
      --accent:       #22d3ee;   /* cyan */
      --success:      #10b981;   /* emerald */
      --warning:      #f59e0b;

      --bg:           #0a0a0f;
      --surface:      #13131f;
      --surface-2:    #1a1a2e;
      --border:       rgba(255,255,255,0.10);
      --border-hover: rgba(255,255,255,0.18);

      --text:         #f1f5f9;
      --text-muted:   #94a3b8;
      --text-subtle:  #475569;
    }

    /* ── Print overrides — white paper, dark ink ── */
    @media print {
      :root {
        --bg:           #ffffff;
        --surface:      #f8f9fa;
        --surface-2:    #ffffff;
        --border:       #dde3ea;
        --border-hover: #c8d0db;
        --text:         #1a1a2e;
        --text-muted:   #475569;
        --text-subtle:  #64748b;
      }
      .no-print { display: none !important; }
      body { font-size: 12px; }
      .page-break { page-break-before: always; }
      header, .fase-card, .stack-item, .maand-item,
      .tabel-alt tr:nth-child(even) td, tr.totaal td, tr.subtotaal td {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      color: var(--text);
      background: var(--bg);
      font-size: 14px;
      line-height: 1.6;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 0 30px 60px; }

    /* ── Header ── */
    header {
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-hover);
      color: var(--text);
      padding: 40px 30px 30px;
      margin-bottom: 40px;
    }
    header .inner { max-width: 900px; margin: 0 auto; }
    header .logo-regel { font-size: 11px; opacity: 0.6; margin-bottom: 6px; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); }
    header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; color: var(--brand); }
    header .subtitel { font-size: 15px; color: var(--text-muted); margin-bottom: 24px; }
    header .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    header .meta-item { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }
    header .meta-item label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-subtle); margin-bottom: 3px; }
    header .meta-item span { font-size: 13px; font-weight: 600; color: var(--text); }

    /* ── Sections ── */
    section { margin-bottom: 40px; }
    h2 { font-size: 17px; color: var(--brand); border-bottom: 1px solid var(--border-hover); padding-bottom: 8px; margin-bottom: 16px; font-weight: 700; letter-spacing: 0.3px; }
    h3 { font-size: 14px; color: var(--text); margin: 16px 0 8px; font-weight: 600; }
    p { margin-bottom: 10px; color: var(--text-muted); }

    /* ── Info box ── */
    .infobox { background: rgba(99,102,241,0.08); border-left: 3px solid var(--brand); padding: 14px 18px; border-radius: 6px; margin-bottom: 16px; color: var(--text-muted); }
    .infobox strong { color: var(--brand); }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    th { background: var(--surface-2); color: var(--text); text-align: left; padding: 9px 12px; font-weight: 600; border-bottom: 1px solid var(--border-hover); }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; color: var(--text-muted); }
    .tabel-alt tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
    td.bedrag, th.bedrag { text-align: right; }
    td.uren, th.uren { text-align: center; }
    tr.subtotaal td { font-weight: 700; background: rgba(99,102,241,0.10); border-top: 1px solid var(--brand); color: var(--text); }
    tr.totaal td { font-weight: 700; background: var(--brand); color: #fff; font-size: 14px; }
    tr.totaal td.bedrag { font-size: 16px; }

    /* ── Phase cards ── */
    .fase-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
    .fase-card { border: 1px solid var(--border-hover); border-radius: 10px; padding: 16px; background: var(--surface); }
    .fase-card .fase-nr { display: inline-block; background: var(--brand); color: #fff; font-size: 10px; font-weight: 700; padding: 4px 14px; border-radius: 20px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .fase-card h3 { margin-top: 0; font-size: 13px; color: var(--text); }
    .fase-card ul { padding-left: 16px; color: var(--text-muted); font-size: 12px; }
    .fase-card ul li { margin-bottom: 3px; }
    .fase-card .duur { margin-top: 10px; font-size: 11px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── Tech stack ── */
    .stack-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .stack-item { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; background: var(--surface); }
    .stack-item .rol { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); font-weight: 700; margin-bottom: 4px; }
    .stack-item .tool { font-size: 14px; font-weight: 700; color: var(--text); }
    .stack-item .reden { font-size: 11px; color: var(--text-muted); margin-top: 3px; }

    /* ── Monthly services ── */
    .maand-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .maand-item { border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 12px 14px; background: rgba(16,185,129,0.06); }
    .maand-item .service { font-weight: 700; color: var(--success); font-size: 13px; }
    .maand-item .prijs { font-size: 18px; font-weight: 700; color: var(--success); margin: 4px 0; }
    .maand-item .toelichting { font-size: 11px; color: var(--text-muted); }

    /* ── Assumptions ── */
    .voorwaarden-lijst { list-style: none; padding: 0; }
    .voorwaarden-lijst li { padding: 8px 0 8px 24px; border-bottom: 1px solid var(--border); position: relative; color: var(--text-muted); font-size: 13px; }
    .voorwaarden-lijst li::before { content: '⚠'; position: absolute; left: 0; color: var(--warning); }

    /* ── Signature ── */
    .handtekening-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; }
    .handtekening-blok { border-top: 2px solid var(--brand); padding-top: 10px; }
    .handtekening-blok .naam { font-weight: 700; font-size: 13px; color: var(--text); }
    .handtekening-blok .rol-label { font-size: 11px; color: var(--text-subtle); }
    .handtekening-blok .lijn { border-bottom: 1px solid var(--border-hover); margin: 30px 0 6px; }
    .handtekening-blok .lijn-label { font-size: 10px; color: var(--text-subtle); }

    /* ── Footer ── */
    footer { background: var(--surface-2); border-top: 1px solid var(--border-hover); color: var(--text-subtle); text-align: center; padding: 16px; font-size: 11px; margin-top: 40px; }
    footer strong { color: var(--text-muted); }

    /* ── Print button (hidden in result component via ::ng-deep) ── */
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: var(--brand); color: #fff; border: none; padding: 12px 20px; border-radius: 30px; font-size: 14px; font-weight: 700; cursor: pointer; z-index: 999; }
    .print-btn:hover { opacity: 0.9; }

    /* ── AI disclaimer ── */
    .ai-disclaimer { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25); border-left: 3px solid var(--warning); border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: var(--text-muted); }

    /* ── GenAI efficiency block ── */
    .genai-block { background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.30); border-radius: 10px; padding: 18px 20px; margin-top: 20px; }
    .genai-block .genai-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .genai-block .genai-badge { background: linear-gradient(135deg, var(--brand), var(--brand-end)); color: #fff; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; }
    .genai-block .genai-title { font-size: 14px; font-weight: 700; color: var(--text); }
    .genai-block .genai-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .genai-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 4px; }
    .genai-stat { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }
    .genai-stat .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-subtle); margin-bottom: 4px; }
    .genai-stat .stat-value { font-size: 15px; font-weight: 700; color: var(--text); }
    .genai-stat .stat-value.highlight { color: var(--brand); }
    .genai-stat .stat-value.saving { color: var(--success); }
    .genai-stat .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  </style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">Opslaan als PDF</button>

<header>
  <div class="inner">
    <div class="logo-regel">Offerte — Webontwikkeling</div>
    <h1>${escHtml(ex.projectTitle)}</h1>
    <div class="subtitel">${escHtml(ex.description)}</div>
    <div class="meta-grid">
      <div class="meta-item"><label>Opgesteld door</label><span>Watsturen</span></div>
      <div class="meta-item"><label>Opgesteld voor</label><span>${escHtml(clientDisplay)}</span></div>
      <div class="meta-item"><label>Datum</label><span>${dateStr}</span></div>
      <div class="meta-item"><label>Offertenummer</label><span>${offerteNr}</span></div>
      <div class="meta-item"><label>Geldig tot</label><span>${validUntilStr}</span></div>
      <div class="meta-item"><label>Uurtarief</label><span>€ ${HOURLY_RATE},00 excl. BTW</span></div>
    </div>
  </div>
</header>

<div class="container">

  <div class="ai-disclaimer">
    <strong>Let op:</strong> Dit is een GenAI-gegenereerde offerte op basis van uw projectbrief. De bedragen zijn indicatief en dienen als startpunt voor een persoonlijk gesprek. Definitieve prijsafspraken worden gemaakt na een kick-off gesprek.
  </div>

  <!-- 1. PROJECTOMSCHRIJVING -->
  <section>
    <h2>1. Projectomschrijving</h2>
    ${ex.projectSummary.split('\n').filter(p => p.trim()).map(p => `<p>${escHtml(p)}</p>`).join('\n    ')}
    ${ex.targetAudience ? `<div class="infobox"><strong>Doelgroep:</strong> ${escHtml(ex.targetAudience)}</div>` : ''}
  </section>

  <!-- 2. TECHNISCHE ARCHITECTUUR -->
  <section>
    <h2>2. Technische Architectuur</h2>
    <p>Het platform wordt gebouwd op een moderne, schaalbare en kostenefficiënte stack:</p>
    <div class="stack-grid">
      ${ex.techStack.map(item => `
      <div class="stack-item">
        <div class="rol">${escHtml(item.role)}</div>
        <div class="tool">${escHtml(item.tool)}</div>
        <div class="reden">${escHtml(item.reason)}</div>
      </div>`).join('')}
    </div>
  </section>

  <!-- 3. PROJECTFASERING -->
  <section>
    <h2>3. Projectfasering</h2>
    <p>Het project wordt in ${ex.phases.length} fase${ex.phases.length !== 1 ? 'n' : ''} opgeleverd, zodat er snel een werkende versie beschikbaar is en het platform stapsgewijs uitgebreid wordt.</p>
    <div class="fase-grid">
      ${ex.phases.map(phase => `
      <div class="fase-card">
        <div class="fase-nr">${escHtml(phase.name)}</div>
        <h3>${escHtml(phase.subtitle)}</h3>
        <ul>
          ${phase.deliverables.map(d => `<li>${escHtml(d)}</li>`).join('\n          ')}
        </ul>
        <div class="duur">⏱ Doorlooptijd: ${escHtml(phase.duration)}</div>
      </div>`).join('')}
    </div>
  </section>

  <!-- 4. URENRAMING & KOSTEN -->
  <section>
    <h2>4. Urenraming &amp; Ontwikkelkosten</h2>
    <p>Alle bedragen zijn exclusief BTW. Het uurtarief bedraagt <strong>€ ${HOURLY_RATE},00</strong>.</p>

    ${pe.phaseBreakdowns.map(phase => `
    <h3>${escHtml(phase.phaseName)} (${escHtml(phase.phaseSubtitle)})</h3>
    <table class="tabel-alt">
      <thead>
        <tr>
          <th>Onderdeel</th>
          <th class="uren">Min. uren</th>
          <th class="uren">Max. uren</th>
          <th class="bedrag">Min. bedrag</th>
          <th class="bedrag">Max. bedrag</th>
        </tr>
      </thead>
      <tbody>
        ${phase.items.map(item => `
        <tr>
          <td>${escHtml(item.label)}</td>
          <td class="uren">${item.hoursMin}</td>
          <td class="uren">${item.hoursMax}</td>
          <td class="bedrag">€ ${fmtNum(item.priceMin)}</td>
          <td class="bedrag">€ ${fmtNum(item.priceMax)}</td>
        </tr>`).join('')}
        <tr class="subtotaal">
          <td><strong>Subtotaal ${escHtml(phase.phaseName)}</strong></td>
          <td class="uren"><strong>${phase.subtotalHoursMin}</strong></td>
          <td class="uren"><strong>${phase.subtotalHoursMax}</strong></td>
          <td class="bedrag"><strong>€ ${fmtNum(phase.subtotalPriceMin)}</strong></td>
          <td class="bedrag"><strong>€ ${fmtNum(phase.subtotalPriceMax)}</strong></td>
        </tr>
      </tbody>
    </table>`).join('')}

    <h3>Totaaloverzicht Ontwikkelkosten</h3>
    <table>
      <thead>
        <tr>
          <th>Fase</th>
          <th class="uren">Min. uren</th>
          <th class="uren">Max. uren</th>
          <th class="bedrag">Min. bedrag</th>
          <th class="bedrag">Max. bedrag</th>
        </tr>
      </thead>
      <tbody>
        ${pe.phaseBreakdowns.map(phase => `
        <tr>
          <td>${escHtml(phase.phaseName)}</td>
          <td class="uren">${phase.subtotalHoursMin}</td>
          <td class="uren">${phase.subtotalHoursMax}</td>
          <td class="bedrag">€ ${fmtNum(phase.subtotalPriceMin)}</td>
          <td class="bedrag">€ ${fmtNum(phase.subtotalPriceMax)}</td>
        </tr>`).join('')}
        <tr class="totaal">
          <td><strong>TOTAAL ONTWIKKELING</strong></td>
          <td class="uren"><strong>${totalHoursMin}</strong></td>
          <td class="uren"><strong>${totalHoursMax}</strong></td>
          <td class="bedrag"><strong>€ ${fmtNum(totalPriceMin)}</strong></td>
          <td class="bedrag"><strong>€ ${fmtNum(totalPriceMax)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="infobox">
      <strong>Toelichting:</strong> De bandbreedte in de urenraming reflecteert de onzekerheid in de scope. Na een kick-off gesprek en definitieve scope-afbakening kan een vaste prijs per fase worden overeengekomen.
    </div>

    <div class="genai-block">
      <div class="genai-header">
        <span class="genai-badge">⚡ GenAI-efficiëntie</span>
        <div>
          <div class="genai-title">Ontwikkeld met GenAI-assisted development</div>
          <div class="genai-subtitle">Door gebruik van GenAI wordt dit ${escHtml(COMPLEXITY_LABEL[ex.complexity] ?? ex.complexity)} project ${pe.aiEfficiency.discountPct}% sneller opgeleverd dan bij traditionele ontwikkeling.</div>
        </div>
      </div>
      <div class="genai-stats">
        <div class="genai-stat">
          <div class="stat-label">Traditionele ontwikkeling</div>
          <div class="stat-value">${pe.aiEfficiency.traditionalHoursMin} – ${pe.aiEfficiency.traditionalHoursMax} uur</div>
          <div class="stat-sub">Zonder GenAI-ondersteuning</div>
        </div>
        <div class="genai-stat">
          <div class="stat-label">GenAI-assisted ontwikkeling</div>
          <div class="stat-value highlight">${totalHoursMin} – ${totalHoursMax} uur</div>
          <div class="stat-sub">Met GenAI-samenwerking</div>
        </div>
        <div class="genai-stat">
          <div class="stat-label">Tijdsbesparing</div>
          <div class="stat-value saving">${pe.aiEfficiency.savedHoursMin} – ${pe.aiEfficiency.savedHoursMax} uur</div>
          <div class="stat-sub">${pe.aiEfficiency.discountPct}% minder uren dan traditioneel</div>
        </div>
        <div class="genai-stat">
          <div class="stat-label">Voordeel voor u</div>
          <div class="stat-value saving">€ ${fmtNum(pe.aiEfficiency.savedAmountMin)} – € ${fmtNum(pe.aiEfficiency.savedAmountMax)}</div>
          <div class="stat-sub">t.o.v. traditioneel uurtarief</div>
        </div>
      </div>
    </div>
  </section>

  <!-- 5. MAANDELIJKSE KOSTEN -->
  ${ex.monthlyServices.length > 0 ? `
  <section>
    <h2>5. Maandelijkse Hosting &amp; Servicekosten</h2>
    <p>Naast de eenmalige ontwikkelkosten zijn er terugkerende kosten voor hosting en externe diensten.</p>
    <div class="maand-grid">
      ${ex.monthlyServices.map(svc => `
      <div class="maand-item">
        <div class="service">${escHtml(svc.service)}</div>
        <div class="prijs">${escHtml(svc.price)}</div>
        <div class="toelichting">${escHtml(svc.note)}</div>
      </div>`).join('')}
    </div>
  </section>` : ''}

  <!-- 6. AANDACHTSPUNTEN & AANNAMES -->
  ${ex.assumptions.length > 0 ? `
  <section>
    <h2>6. Aandachtspunten &amp; Aannames</h2>
    <ul class="voorwaarden-lijst">
      ${ex.assumptions.map(a => `<li>${escHtml(a)}</li>`).join('\n      ')}
    </ul>
  </section>` : ''}

  <!-- 7. BETALINGSSCHEMA -->
  <section class="${ex.monthlyServices.length > 0 ? '' : 'page-break'}">
    <h2>7. Betalingsschema</h2>
    <table class="tabel-alt">
      <thead>
        <tr>
          <th>Moment</th>
          <th>Omschrijving</th>
          <th class="bedrag">Percentage</th>
          <th class="bedrag">Indicatief bedrag (op basis van min.)</th>
        </tr>
      </thead>
      <tbody>
        ${pe.paymentSchedule.map(row => `
        <tr>
          <td>${escHtml(row.moment)}</td>
          <td>${escHtml(row.description)}</td>
          <td class="bedrag">${row.percentage}%</td>
          <td class="bedrag">± € ${fmtNum(row.amount)}</td>
        </tr>`).join('')}
        <tr class="subtotaal">
          <td colspan="2"><strong>Totaal (op basis van minimumraming)</strong></td>
          <td class="bedrag"><strong>100%</strong></td>
          <td class="bedrag"><strong>± € ${fmtNum(totalPriceMin)}</strong></td>
        </tr>
      </tbody>
    </table>
    <p>Betalingstermijn: 14 dagen na factuurdatum. Alle bedragen zijn exclusief 21% BTW.</p>
  </section>

  <!-- 8. AKKOORDVERKLARING -->
  <section class="page-break">
    <h2>8. Akkoordverklaring</h2>
    <p>
      Door ondertekening van deze offerte gaat de opdrachtgever akkoord met de beschreven scope, het uurtarief,
      het betalingsschema en de genoemde aandachtspunten. Na akkoord wordt een gedetailleerde projectplanning
      opgesteld en start de ontwikkeling van Fase 1.
    </p>
    <div class="handtekening-grid">
      <div class="handtekening-blok">
        <div class="naam">Dirk van der Giesen</div>
        <div class="rol-label">Opdrachtnemer — Watsturen</div>
        <div class="lijn"></div>
        <div class="lijn-label">Handtekening &amp; datum</div>
      </div>
      <div class="handtekening-blok">
        <div class="naam">${escHtml(clientDisplay)}</div>
        <div class="rol-label">Opdrachtgever</div>
        <div class="lijn"></div>
        <div class="lijn-label">Handtekening &amp; datum</div>
      </div>
    </div>
  </section>

</div>

<footer>
  <strong>Watsturen</strong> &nbsp;·&nbsp;
  Vlissingen &nbsp;·&nbsp;
  info@watsturen.nl &nbsp;·&nbsp;
  watsturen.nl &nbsp;·&nbsp;
  Offertenummer: ${offerteNr}
</footer>

</body>
</html>`;
}

/** Escapes HTML special characters to prevent XSS in the generated document. */
function escHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Formats a number with Dutch locale (dots as thousands separator). */
function fmtNum(n: number): string {
  return n.toLocaleString('nl-NL');
}
