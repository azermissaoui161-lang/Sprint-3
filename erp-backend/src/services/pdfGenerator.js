const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────
//  Design tokens
// ─────────────────────────────────────────────
const COLORS = {
  navy:        '#0D1B2A',
  blue:        '#1B4F8A',
  accent:      '#2E9CCA',
  accentLight: '#E8F4FB',
  gold:        '#C8972A',
  white:       '#FFFFFF',
  offWhite:    '#F8FAFC',
  gray100:     '#F1F5F9',
  gray200:     '#E2E8F0',
  gray400:     '#94A3B8',
  gray600:     '#475569',
  gray800:     '#1E293B',
  red:         '#DC2626',
  green:       '#16A34A',
};

const FONT = {
  bold:    'Helvetica-Bold',
  regular: 'Helvetica',
  italic:  'Helvetica-Oblique',
};

const PAGE = { w: 595, h: 842, margin: 48 };
const COL  = PAGE.w - PAGE.margin * 2;  // usable width

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function hex2rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function fill(doc, hex)   { doc.fillColor(hex); return doc; }
function stroke(doc, hex) { doc.strokeColor(hex); return doc; }

function checkBreak(doc, y, needed = 80) {
  if (y + needed > PAGE.h - PAGE.margin) {
    doc.addPage();
    return PAGE.margin + 10;
  }
  return y;
}

function hLine(doc, x1, x2, y, color = COLORS.gray200, lw = 0.5) {
  doc.save()
     .strokeColor(color).lineWidth(lw)
     .moveTo(x1, y).lineTo(x2, y).stroke()
     .restore();
}

function badge(doc, text, x, y, bg, fg = COLORS.white) {
  const pad = 6;
  doc.save().font(FONT.bold).fontSize(7.5);
  const tw = doc.widthOfString(text);
  doc.roundedRect(x, y, tw + pad * 2, 14, 3).fill(bg);
  doc.fillColor(fg).text(text, x + pad, y + 3, { lineBreak: false });
  doc.restore();
  return tw + pad * 2 + 6;
}

// ─────────────────────────────────────────────
//  STATUS BADGE color map
// ─────────────────────────────────────────────
function statusColor(status = '') {
  const s = status.toLowerCase();
  if (['payée', 'payé', 'paid'].includes(s))   return { bg: COLORS.green,  fg: COLORS.white };
  if (['en attente', 'pending'].includes(s))    return { bg: COLORS.gold,   fg: COLORS.white };
  if (['annulée', 'annulé', 'void'].includes(s))return { bg: COLORS.red,    fg: COLORS.white };
  return { bg: COLORS.blue, fg: COLORS.white };
}

// ─────────────────────────────────────────────
//  Section header bar (thin accent left border)
// ─────────────────────────────────────────────
function sectionTitle(doc, label, y) {
  doc.save()
     .rect(PAGE.margin, y, 3, 13).fill(COLORS.accent)
     .font(FONT.bold).fontSize(9.5).fillColor(COLORS.navy)
     .text(label.toUpperCase(), PAGE.margin + 9, y + 1.5, { letterSpacing: 0.8 })
     .restore();
  return y + 18;
}

// ─────────────────────────────────────────────
//  generateInvoice
// ─────────────────────────────────────────────
async function generateInvoice(invoice, customer, items) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', compress: true });
      const buf = [];
      doc.on('data', d => buf.push(d));
      doc.on('end',  () => resolve(Buffer.concat(buf)));

      // ── HERO HEADER ───────────────────────────────────────────────
      // Full-bleed dark rectangle
      doc.rect(0, 0, PAGE.w, 115).fill(COLORS.navy);

      // Diagonal accent stripe
      doc.save()
         .polygon([PAGE.w - 160, 0], [PAGE.w, 0], [PAGE.w, 115], [PAGE.w - 80, 115])
         .fill(COLORS.blue);
      doc.save()
         .polygon([PAGE.w - 90, 0], [PAGE.w, 0], [PAGE.w, 115], [PAGE.w - 30, 115])
         .fillOpacity(0.4).fill(COLORS.accent);
      doc.restore();

      // Company name
      doc.font(FONT.bold).fontSize(22).fillColor(COLORS.white)
         .text('ERP', PAGE.margin, 28, { continued: true })
         .font(FONT.regular).fillColor(COLORS.accent)
         .text(' SYSTEM', { continued: false });

      doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.gray400)
         .text('123 Rue de l\'ERP, 1000 Tunis, Tunisie  •  +216 00 000 000  •  contact@erp.tn',
               PAGE.margin, 55);

      // "FACTURE" label
      doc.font(FONT.bold).fontSize(28).fillColor(COLORS.white)
         .text('FACTURE', 0, 72, { align: 'center', width: PAGE.w });

      // ── INFO STRIP (below header) ──────────────────────────────────
      doc.rect(0, 115, PAGE.w, 42).fill(COLORS.gray100);
      hLine(doc, 0, PAGE.w, 115, COLORS.gray200, 1);
      hLine(doc, 0, PAGE.w, 157, COLORS.gray200, 1);

      const fields = [
        { label: 'N° FACTURE', value: invoice.invoiceNumber || 'FAC-000001' },
        { label: 'DATE',       value: fmt(invoice.createdAt) },
        { label: 'ÉCHÉANCE',   value: fmt(invoice.dueDate) },
        { label: 'STATUT',     value: invoice.status || 'En attente', isStatus: true },
      ];

      const slotW = COL / fields.length;
      fields.forEach((f, i) => {
        const x = PAGE.margin + i * slotW;
        doc.font(FONT.bold).fontSize(6.5).fillColor(COLORS.gray400)
           .text(f.label, x, 122, { width: slotW - 8 });

        if (f.isStatus) {
          const sc = statusColor(f.value);
          badge(doc, f.value.toUpperCase(), x, 134, sc.bg, sc.fg);
        } else {
          doc.font(FONT.bold).fontSize(9.5).fillColor(COLORS.navy)
             .text(f.value, x, 133, { width: slotW - 8 });
        }
      });

      // ── PARTIES (Vendeur ↔ Client) ─────────────────────────────────
      let y = 177;
      const halfW = (COL - 20) / 2;

      // Seller card
      doc.roundedRect(PAGE.margin, y, halfW, 90, 5).fill(COLORS.offWhite);
      doc.rect(PAGE.margin, y, 4, 90).fill(COLORS.blue);
      doc.font(FONT.bold).fontSize(7).fillColor(COLORS.blue)
         .text('ÉMETTEUR', PAGE.margin + 12, y + 10);
      doc.font(FONT.bold).fontSize(10).fillColor(COLORS.navy)
         .text('ERP System SARL', PAGE.margin + 12, y + 22);
      doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
         .text('123 Rue de l\'ERP\n1000 Tunis, Tunisie\n+216 00 000 000\ncontact@erp.tn',
               PAGE.margin + 12, y + 36, { lineGap: 2 });

      // Customer card
      const cx = PAGE.margin + halfW + 20;
      doc.roundedRect(cx, y, halfW, 90, 5).fill(COLORS.accentLight);
      doc.rect(cx, y, 4, 90).fill(COLORS.accent);
      doc.font(FONT.bold).fontSize(7).fillColor(COLORS.accent)
         .text('CLIENT', cx + 12, y + 10);

      const cName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Client';
      doc.font(FONT.bold).fontSize(10).fillColor(COLORS.navy)
         .text(cName, cx + 12, y + 22);

      const cDetails = [
        customer.email   ? `✉  ${customer.email}`   : null,
        customer.phone   ? `☎  ${customer.phone}`   : null,
        customer.address ? `⌂  ${customer.address.street || ''}, ${customer.address.postalCode || ''} ${customer.address.city || ''}` : null,
        customer.taxId   ? `TVA: ${customer.taxId}` : null,
      ].filter(Boolean).join('\n');

      doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
         .text(cDetails || '-', cx + 12, y + 36, { lineGap: 2 });

      y += 105;

      // ── ITEMS TABLE ────────────────────────────────────────────────
      y = sectionTitle(doc, 'Détail des prestations', y);

      // Column definitions
      const cols = {
        ref:   { x: PAGE.margin,       w: 60,  align: 'left'  },
        desc:  { x: PAGE.margin + 62,  w: 175, align: 'left'  },
        qty:   { x: PAGE.margin + 239, w: 45,  align: 'center'},
        pu:    { x: PAGE.margin + 286, w: 65,  align: 'right' },
        tva:   { x: PAGE.margin + 353, w: 40,  align: 'center'},
        total: { x: PAGE.margin + 395, w: 104, align: 'right' },
      };

      // Table header
      doc.rect(PAGE.margin, y, COL, 22).fill(COLORS.navy);
      doc.font(FONT.bold).fontSize(7.5).fillColor(COLORS.white);
      const headers = { ref: 'RÉF.', desc: 'DÉSIGNATION', qty: 'QTÉ', pu: 'PRIX U. HT', tva: 'TVA', total: 'MONTANT TTC' };
      Object.entries(cols).forEach(([k, c]) => {
        doc.text(headers[k], c.x + 4, y + 7, { width: c.w - 4, align: c.align });
      });
      y += 22;

      // Rows
      items.forEach((item, i) => {
        y = checkBreak(doc, y, 26);
        const rowH = 24;
        const bg = i % 2 === 0 ? COLORS.white : COLORS.gray100;
        doc.rect(PAGE.margin, y, COL, rowH).fill(bg);

        const pu      = +(item.unitPrice || 0);
        const qty     = +(item.quantity || 0);
        const tvaRate = +(item.tvaRate  || item.taxRate || 19);
        const totalHT = qty * pu;
        const totalTTC = item.totalTTC || totalHT * (1 + tvaRate / 100);
        const pName   = (item.product?.name || item.description || 'Article').substring(0, 22);
        const pDesc   = (item.product?.description || item.notes || '').substring(0, 45);

        doc.font(FONT.regular).fontSize(8).fillColor(COLORS.gray400)
           .text(`#${String(i + 1).padStart(3, '0')}`, cols.ref.x + 4, y + 4, { width: cols.ref.w - 4 });

        doc.font(FONT.bold).fontSize(8.5).fillColor(COLORS.navy)
           .text(pName, cols.desc.x + 2, y + 4, { width: cols.desc.w - 4 });
        if (pDesc) {
          doc.font(FONT.italic).fontSize(7).fillColor(COLORS.gray400)
             .text(pDesc, cols.desc.x + 2, y + 14, { width: cols.desc.w - 4 });
        }

        doc.font(FONT.bold).fontSize(8.5).fillColor(COLORS.navy)
           .text(String(qty), cols.qty.x, y + 8, { width: cols.qty.w, align: 'center' });

        doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
           .text(num(pu) + ' DT', cols.pu.x, y + 8, { width: cols.pu.w, align: 'right' });

        doc.font(FONT.regular).fontSize(8).fillColor(COLORS.gray400)
           .text(`${tvaRate}%`, cols.tva.x, y + 8, { width: cols.tva.w, align: 'center' });

        doc.font(FONT.bold).fontSize(9).fillColor(COLORS.navy)
           .text(num(totalTTC) + ' DT', cols.total.x, y + 8, { width: cols.total.w - 4, align: 'right' });

        // right-side accent bar
        doc.rect(PAGE.w - PAGE.margin - 3, y, 3, rowH).fill(i % 2 === 0 ? COLORS.accent : COLORS.blue);

        y += rowH;
      });

      hLine(doc, PAGE.margin, PAGE.w - PAGE.margin, y, COLORS.navy, 1.5);
      y += 16;

      // ── TOTALS ─────────────────────────────────────────────────────
      y = checkBreak(doc, y, 120);
      const totX = PAGE.margin + COL - 200;
      const totW = 200;

      const subtotalHT = +(invoice.subtotalHT || 0);
      const totalTax   = +(invoice.totalTax   || 0);
      const totalTTC   = +(invoice.totalTTC   || 0);
      const remise     = +(invoice.discount   || 0);

      const totRows = [
        { label: 'Sous-total HT',     value: num(subtotalHT) + ' DT',   bold: false },
        remise > 0
          ? { label: `Remise (${invoice.discountPct || ''}%)`, value: '- ' + num(remise) + ' DT', bold: false, color: COLORS.red }
          : null,
        { label: `TVA (${invoice.tvaRate || 19}%)`, value: num(totalTax) + ' DT', bold: false },
      ].filter(Boolean);

      totRows.forEach(r => {
        doc.font(r.bold ? FONT.bold : FONT.regular).fontSize(8.5)
           .fillColor(r.color || COLORS.gray600)
           .text(r.label, totX, y, { width: 120 })
           .text(r.value, totX + 120, y, { width: 80, align: 'right' });
        y += 16;
      });

      hLine(doc, totX, totX + totW, y, COLORS.gray200);
      y += 8;

      // Grand total box
      doc.roundedRect(totX - 8, y, totW + 8, 32, 5).fill(COLORS.navy);
      doc.font(FONT.bold).fontSize(9.5).fillColor(COLORS.gray400)
         .text('TOTAL TTC', totX, y + 9, { width: 100 });
      doc.font(FONT.bold).fontSize(14).fillColor(COLORS.white)
         .text(num(totalTTC) + ' DT', totX + 100, y + 6, { width: 90, align: 'right' });
      y += 44;

      // Payment info
      if (invoice.paymentMethod || invoice.iban) {
        y = checkBreak(doc, y, 60);
        y = sectionTitle(doc, 'Informations de paiement', y);
        doc.roundedRect(PAGE.margin, y, COL, 46, 5).fill(COLORS.gray100);
        const pm = [
          invoice.paymentMethod ? `Mode : ${invoice.paymentMethod}` : 'Mode : Virement bancaire',
          invoice.iban          ? `IBAN : ${invoice.iban}`          : 'IBAN : TN59 1234 5678 9012 3456 7890',
          invoice.bankName      ? `Banque : ${invoice.bankName}`    : null,
        ].filter(Boolean);
        doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
           .text(pm.join('    •    '), PAGE.margin + 12, y + 16, { width: COL - 24 });
        y += 58;
      }

      // Notes / conditions
      if (invoice.notes || invoice.terms) {
        y = checkBreak(doc, y, 60);
        y = sectionTitle(doc, 'Notes & conditions', y);
        doc.roundedRect(PAGE.margin, y, COL, 36, 5)
           .lineWidth(0.5).strokeColor(COLORS.gray200).stroke();
        doc.font(FONT.italic).fontSize(8).fillColor(COLORS.gray400)
           .text(invoice.notes || invoice.terms || 'Paiement à réception de facture. Tout retard entraîne des pénalités.',
                 PAGE.margin + 10, y + 10, { width: COL - 20, lineGap: 2 });
        y += 50;
      }

      // ── FOOTER ────────────────────────────────────────────────────
      const fy = PAGE.h - 42;
      doc.rect(0, fy - 4, PAGE.w, 1).fill(COLORS.accent);
      doc.rect(0, fy - 4, 80, 46).fill(COLORS.navy);
      doc.font(FONT.bold).fontSize(9).fillColor(COLORS.accent)
         .text('ERP', 14, fy + 6, { continued: true })
         .fillColor(COLORS.white).text(' SYS');
      doc.font(FONT.regular).fontSize(7).fillColor(COLORS.gray400)
         .text(`${invoice.invoiceNumber || ''} — Généré le ${fmt(Date.now())}`,
               95, fy + 4, { width: PAGE.w - 190, align: 'center' });
      doc.font(FONT.regular).fontSize(7).fillColor(COLORS.gray400)
         .text('Document officiel. Merci de votre confiance.',
               95, fy + 16, { width: PAGE.w - 190, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─────────────────────────────────────────────
//  generateQuote  (même style)
// ─────────────────────────────────────────────
async function generateQuote(quote, customer, items = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', compress: true });
      const buf = [];
      doc.on('data', d => buf.push(d));
      doc.on('end',  () => resolve(Buffer.concat(buf)));

      // Hero header – gold accent instead of blue
      doc.rect(0, 0, PAGE.w, 115).fill(COLORS.navy);
      doc.save()
         .polygon([PAGE.w - 160, 0], [PAGE.w, 0], [PAGE.w, 115], [PAGE.w - 80, 115])
         .fill(COLORS.gold);
      doc.restore();

      doc.font(FONT.bold).fontSize(22).fillColor(COLORS.white)
         .text('ERP', PAGE.margin, 28, { continued: true })
         .font(FONT.regular).fillColor(COLORS.gold).text(' SYSTEM');
      doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.gray400)
         .text('123 Rue de l\'ERP, 1000 Tunis  •  +216 00 000 000',
               PAGE.margin, 55);
      doc.font(FONT.bold).fontSize(28).fillColor(COLORS.white)
         .text('DEVIS', 0, 72, { align: 'center', width: PAGE.w });

      // Info strip
      doc.rect(0, 115, PAGE.w, 42).fill(COLORS.gray100);
      hLine(doc, 0, PAGE.w, 157, COLORS.gray200, 1);

      const validity = new Date(Date.now() + 30 * 864e5);
      const qFields = [
        { label: 'N° DEVIS',   value: quote.quoteNumber || 'DEV-000001' },
        { label: 'DATE',       value: fmt(Date.now()) },
        { label: 'VALABLE JUSQU\'AU', value: validity.toLocaleDateString('fr-FR') },
        { label: 'STATUT',     value: quote.status || 'En attente', isStatus: true },
      ];
      const slotW = COL / 4;
      qFields.forEach((f, i) => {
        const x = PAGE.margin + i * slotW;
        doc.font(FONT.bold).fontSize(6.5).fillColor(COLORS.gray400).text(f.label, x, 122, { width: slotW - 8 });
        if (f.isStatus) {
          const sc = statusColor(f.value);
          badge(doc, f.value.toUpperCase(), x, 134, sc.bg, sc.fg);
        } else {
          doc.font(FONT.bold).fontSize(9.5).fillColor(COLORS.navy).text(f.value, x, 133, { width: slotW - 8 });
        }
      });

      // Customer card
      let y = 177;
      const cName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Client';
      doc.roundedRect(PAGE.margin, y, COL, 72, 5).fill(COLORS.offWhite);
      doc.rect(PAGE.margin, y, 4, 72).fill(COLORS.gold);
      doc.font(FONT.bold).fontSize(7).fillColor(COLORS.gold).text('CLIENT', PAGE.margin + 12, y + 10);
      doc.font(FONT.bold).fontSize(10).fillColor(COLORS.navy).text(cName, PAGE.margin + 12, y + 22);
      doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
         .text([customer.email ? `✉  ${customer.email}` : '', customer.phone ? `☎  ${customer.phone}` : ''].filter(Boolean).join('    '),
               PAGE.margin + 12, y + 38);
      y += 88;

      // Items table (reuse same structure)
      y = sectionTitle(doc, 'Détail du devis', y);
      doc.rect(PAGE.margin, y, COL, 22).fill(COLORS.navy);
      const cols2 = {
        desc:  { x: PAGE.margin,       w: 235, align: 'left'  },
        qty:   { x: PAGE.margin + 237, w: 45,  align: 'center'},
        pu:    { x: PAGE.margin + 284, w: 70,  align: 'right' },
        total: { x: PAGE.margin + 356, w: 141, align: 'right' },
      };
      const hdr2 = { desc: 'DÉSIGNATION', qty: 'QTÉ', pu: 'PRIX U. HT', total: 'TOTAL HT' };
      doc.font(FONT.bold).fontSize(7.5).fillColor(COLORS.white);
      Object.entries(cols2).forEach(([k, c]) =>
        doc.text(hdr2[k], c.x + 4, y + 7, { width: c.w - 4, align: c.align }));
      y += 22;

      items.forEach((item, i) => {
        y = checkBreak(doc, y, 24);
        const rowH = 22;
        doc.rect(PAGE.margin, y, COL, rowH).fill(i % 2 === 0 ? COLORS.white : COLORS.gray100);
        const pu  = +(item.unitPrice || 0);
        const qty = +(item.quantity  || 0);
        doc.font(FONT.bold).fontSize(8.5).fillColor(COLORS.navy)
           .text((item.product?.name || item.description || 'Article').substring(0, 40), cols2.desc.x + 4, y + 6, { width: cols2.desc.w - 8 });
        doc.font(FONT.bold).fontSize(8.5).fillColor(COLORS.navy)
           .text(String(qty), cols2.qty.x, y + 6, { width: cols2.qty.w, align: 'center' });
        doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
           .text(num(pu) + ' DT', cols2.pu.x, y + 6, { width: cols2.pu.w, align: 'right' });
        doc.font(FONT.bold).fontSize(9).fillColor(COLORS.navy)
           .text(num(qty * pu) + ' DT', cols2.total.x, y + 6, { width: cols2.total.w - 4, align: 'right' });
        y += rowH;
      });

      hLine(doc, PAGE.margin, PAGE.w - PAGE.margin, y, COLORS.navy, 1.5);
      y += 16;

      // Total box
      const totX = PAGE.margin + COL - 190;
      hLine(doc, totX, totX + 190, y, COLORS.gray200);
      y += 8;
      doc.roundedRect(totX - 8, y, 198, 32, 5).fill(COLORS.gold);
      doc.font(FONT.bold).fontSize(9.5).fillColor(COLORS.white)
         .text('TOTAL HT', totX, y + 9, { width: 90 });
      const totalHT = items.reduce((s, it) => s + (+(it.quantity || 0)) * (+(it.unitPrice || 0)), 0);
      doc.font(FONT.bold).fontSize(14).fillColor(COLORS.white)
         .text(num(totalHT) + ' DT', totX + 90, y + 6, { width: 100, align: 'right' });
      y += 48;

      // Conditions
      y = checkBreak(doc, y, 50);
      y = sectionTitle(doc, 'Conditions', y);
      doc.roundedRect(PAGE.margin, y, COL, 36, 5)
         .lineWidth(0.5).strokeColor(COLORS.gray200).stroke();
      doc.font(FONT.italic).fontSize(8).fillColor(COLORS.gray400)
         .text('Devis valable 30 jours à compter de sa date d\'émission. Hors taxes sauf mention contraire.',
               PAGE.margin + 10, y + 10, { width: COL - 20 });
      y += 50;

      // Footer
      const fy = PAGE.h - 42;
      doc.rect(0, fy - 4, PAGE.w, 1).fill(COLORS.gold);
      doc.rect(0, fy - 4, 80, 46).fill(COLORS.navy);
      doc.font(FONT.bold).fontSize(9).fillColor(COLORS.gold)
         .text('ERP', 14, fy + 6, { continued: true }).fillColor(COLORS.white).text(' SYS');
      doc.font(FONT.regular).fontSize(7).fillColor(COLORS.gray400)
         .text(`${quote.quoteNumber || ''} — Généré le ${fmt(Date.now())}`,
               95, fy + 4, { width: PAGE.w - 190, align: 'center' })
         .text('Document officiel. Merci de votre confiance.',
               95, fy + 16, { width: PAGE.w - 190, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─────────────────────────────────────────────
//  generateReport  (generic)
// ─────────────────────────────────────────────
async function generateReport(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', compress: true });
      const buf = [];
      doc.on('data', d => buf.push(d));
      doc.on('end',  () => resolve(Buffer.concat(buf)));

      // Header
      doc.rect(0, 0, PAGE.w, 90).fill(COLORS.navy);
      doc.save()
         .polygon([PAGE.w - 160, 0], [PAGE.w, 0], [PAGE.w, 90], [PAGE.w - 80, 90])
         .fill(COLORS.blue);
      doc.restore();

      doc.font(FONT.bold).fontSize(16).fillColor(COLORS.white)
         .text('ERP SYSTEM', PAGE.margin, 22);
      doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.gray400)
         .text('Rapport officiel', PAGE.margin, 42);
      doc.font(FONT.regular).fontSize(8).fillColor(COLORS.accent)
         .text(fmt(report.date || report.createdAt || Date.now()), PAGE.w - 180, 22, { width: 140, align: 'right' });
      doc.font(FONT.regular).fontSize(8).fillColor(COLORS.gray400)
         .text(`Type : ${(report.type || 'analytique').toUpperCase()}`, PAGE.w - 180, 36, { width: 140, align: 'right' });

      let y = 110;
      // Title
      doc.font(FONT.bold).fontSize(20).fillColor(COLORS.navy)
         .text(report.title || 'Rapport', PAGE.margin, y, { width: COL });
      y = doc.y + 4;
      doc.rect(PAGE.margin, y, 50, 3).fill(COLORS.accent);
      y += 18;

      // Meta box
      doc.roundedRect(PAGE.margin, y, COL, 44, 5).fill(COLORS.gray100);
      const metaFields = [
        { label: 'DATE',   value: fmt(report.date || report.createdAt) },
        { label: 'AUTEUR', value: report.author || 'Administrateur' },
        { label: 'MODULE', value: (report.tags || []).map(t => t.replace('source:', '')).join(', ') || '-' },
      ];
      const mw = COL / 3;
      metaFields.forEach((mf, i) => {
        const mx = PAGE.margin + i * mw + 12;
        doc.font(FONT.bold).fontSize(7).fillColor(COLORS.gray400).text(mf.label, mx, y + 10, { width: mw - 20 });
        doc.font(FONT.bold).fontSize(9).fillColor(COLORS.navy).text(mf.value, mx, y + 24, { width: mw - 20 });
      });
      y += 58;

      // Description
      if (report.description) {
        y = sectionTitle(doc, 'Description', y);
        doc.font(FONT.regular).fontSize(9.5).fillColor(COLORS.gray600)
           .text(report.description, PAGE.margin, y, { width: COL, lineGap: 4, align: 'justify' });
        y = doc.y + 18;
      }

      // Data table
      if (report.data && typeof report.data === 'object') {
        y = checkBreak(doc, y, 50);
        y = sectionTitle(doc, 'Données détaillées', y);
        const entries = Object.entries(report.data);
        const colK = 200, colV = COL - colK;

        doc.rect(PAGE.margin, y, COL, 22).fill(COLORS.navy);
        doc.font(FONT.bold).fontSize(7.5).fillColor(COLORS.white)
           .text('INDICATEUR', PAGE.margin + 8, y + 7, { width: colK })
           .text('VALEUR', PAGE.margin + colK + 8, y + 7, { width: colV - 16 });
        y += 22;

        entries.forEach(([k, v], i) => {
          y = checkBreak(doc, y, 20);
          const displayV = typeof v === 'object' ? JSON.stringify(v) : String(v);
          const rh = Math.max(20, Math.ceil(displayV.length / 60) * 13 + 7);
          doc.rect(PAGE.margin, y, COL, rh).fill(i % 2 === 0 ? COLORS.offWhite : COLORS.white);
          doc.font(FONT.bold).fontSize(8.5).fillColor(COLORS.navy)
             .text(k, PAGE.margin + 8, y + 5, { width: colK - 16 });
          doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
             .text(displayV, PAGE.margin + colK + 8, y + 5, { width: colV - 16 });
          y += rh;
        });
        hLine(doc, PAGE.margin, PAGE.w - PAGE.margin, y, COLORS.navy, 1);
        y += 16;
      }

      // Footer
      const fy = PAGE.h - 42;
      doc.rect(0, fy - 4, PAGE.w, 1).fill(COLORS.accent);
      doc.font(FONT.regular).fontSize(7).fillColor(COLORS.gray400)
         .text(`Réf : RPT-${(report._id || '').toString().slice(-8).toUpperCase()} — ${fmt(Date.now())}`,
               PAGE.margin, fy + 10, { width: COL, align: 'center' })
         .text('Document officiel généré automatiquement par ERP System',
               PAGE.margin, fy + 22, { width: COL, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─────────────────────────────────────────────
//  generateFinancialReport
// ─────────────────────────────────────────────
async function generateFinancialReport(data, period) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PAGE.margin, size: 'A4', compress: true });
      const buf = [];
      doc.on('data', d => buf.push(d));
      doc.on('end',  () => resolve(Buffer.concat(buf)));

      // Header
      doc.rect(0, 0, PAGE.w, 100).fill(COLORS.navy);
      doc.save()
         .polygon([PAGE.w - 130, 0], [PAGE.w, 0], [PAGE.w, 100], [PAGE.w - 60, 100])
         .fill(COLORS.green);
      doc.restore();
      doc.font(FONT.bold).fontSize(22).fillColor(COLORS.white)
         .text('RAPPORT FINANCIER', PAGE.margin, 28, { continued: false });
      doc.font(FONT.regular).fontSize(9).fillColor(COLORS.accent)
         .text(`Période : ${period}`, PAGE.margin, 58);

      let y = 120;

      const kpiData = [
        { label: 'Trésorerie',  value: num(data.tresorerie?.total || 0) + ' DT', color: COLORS.green },
        { label: 'Créances',    value: num(data.creances?.total   || 0) + ' DT', color: COLORS.accent },
        { label: 'Dettes',      value: num(data.dettes?.total     || 0) + ' DT', color: COLORS.gold },
        { label: 'CA mensuel',  value: num(data.chiffreAffairesMois || 0) + ' DT', color: COLORS.blue },
      ];

      // KPI cards
      const cardW = (COL - 12) / 4;
      kpiData.forEach((k, i) => {
        const kx = PAGE.margin + i * (cardW + 4);
        doc.roundedRect(kx, y, cardW, 60, 5).fill(COLORS.offWhite);
        doc.rect(kx, y, cardW, 4).fill(k.color);
        doc.font(FONT.regular).fontSize(7.5).fillColor(COLORS.gray400)
           .text(k.label.toUpperCase(), kx + 8, y + 14, { width: cardW - 16 });
        doc.font(FONT.bold).fontSize(11).fillColor(COLORS.navy)
           .text(k.value, kx + 8, y + 28, { width: cardW - 16 });
      });
      y += 76;

      // Trésorerie detail
      if (data.tresorerie?.details?.length) {
        y = sectionTitle(doc, 'Trésorerie — comptes', y);
        doc.rect(PAGE.margin, y, COL, 20).fill(COLORS.navy);
        doc.font(FONT.bold).fontSize(7.5).fillColor(COLORS.white)
           .text('CODE', PAGE.margin + 8, y + 6, { width: 60 })
           .text('COMPTE', PAGE.margin + 70, y + 6, { width: 260 })
           .text('SOLDE (DT)', PAGE.margin + 330, y + 6, { width: COL - 338, align: 'right' });
        y += 20;
        data.tresorerie.details.forEach((acc, i) => {
          y = checkBreak(doc, y, 20);
          doc.rect(PAGE.margin, y, COL, 18).fill(i % 2 === 0 ? COLORS.offWhite : COLORS.white);
          doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.gray600)
             .text(acc.code, PAGE.margin + 8, y + 4, { width: 60 })
             .text(acc.name, PAGE.margin + 70, y + 4, { width: 260 });
          doc.font(FONT.bold).fillColor(acc.balance >= 0 ? COLORS.green : COLORS.red)
             .text(num(acc.balance) + ' DT', PAGE.margin + 330, y + 4, { width: COL - 338, align: 'right' });
          y += 18;
        });
        hLine(doc, PAGE.margin, PAGE.w - PAGE.margin, y, COLORS.navy, 1);
        y += 16;
      }

      // Créances
      y = checkBreak(doc, y, 60);
      y = sectionTitle(doc, 'Créances clients', y);
      doc.roundedRect(PAGE.margin, y, COL, 42, 5).fill(COLORS.gray100);
      doc.font(FONT.bold).fontSize(9).fillColor(COLORS.navy)
         .text(`Total créances : ${num(data.creances?.total || 0)} DT`,    PAGE.margin + 16, y + 12)
         .text(`Factures en attente : ${data.creances?.count || 0}`,       PAGE.margin + 16, y + 28);
      y += 58;

      // Footer
      const fy = PAGE.h - 42;
      doc.rect(0, fy - 4, PAGE.w, 1).fill(COLORS.green);
      doc.font(FONT.regular).fontSize(7).fillColor(COLORS.gray400)
         .text(`Rapport financier — ${period} — Généré le ${fmt(Date.now())}`,
               PAGE.margin, fy + 10, { width: COL, align: 'center' })
         .text('Document officiel généré automatiquement par ERP System',
               PAGE.margin, fy + 22, { width: COL, align: 'center' });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ─────────────────────────────────────────────
//  Utility formatters
// ─────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function num(n) {
  return (+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
class PDFGenerator {
  static generateInvoice        = generateInvoice;
  static generateQuote          = generateQuote;
  static generateReport         = generateReport;
  static generateFinancialReport = generateFinancialReport;
  // backward compat
  static _checkPageBreak = checkBreak;
}

module.exports = PDFGenerator;
module.exports.generatePDF = generateReport;