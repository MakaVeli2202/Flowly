import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatQAR } from './currency';

// ── Brand-aligned colour palette ──────────────────────────────────────────────
// PDFs render on white paper, so we use the brand's dark navy for header
// backgrounds and gold for accents instead of the web's rgba transparency.
const C = {
  // Brand
  gold:       [200, 169, 107],   // #C8A96B — primary accent
  navy:       [13,  17,  23],    // #0D1117 — header/dark backgrounds
  navyMid:    [18,  26,  35],    // #121A23 — card/panel backgrounds

  // Semantic — kept universal so coloured cells remain instantly readable
  green:      [22,  163, 74],
  red:        [220, 38,  38],
  amber:      [217, 119, 6],
  blue:       [37,  99,  235],
  purple:     [109, 40,  217],

  // Neutral
  dark:       [17,  24,  39],
  gray:       [100, 116, 139],
  muted:      [148, 163, 184],
  white:      [255, 255, 255],
  bgLight:    [248, 250, 252],
  border:     [226, 232, 240],
  borderDark: [42,  51,  64],
};

// ── Shared drawing helpers ────────────────────────────────────────────────────

/**
 * Draw the branded page header and return the Y position to continue from.
 */
function drawHeader(doc, title, subtitle, from, to) {
  // ── Dark navy banner ─────────────────────────────────────────────────────
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, 210, 32, 'F');

  // Brand name in gold
  doc.setTextColor(...C.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Glanz', 14, 14);

  // Gold underline accent
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.5);
  doc.line(14, 16.5, 70, 16.5);

  // Report title (white, below brand)
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(title.toUpperCase(), 14, 24);

  // Subtitle right-aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 190, 200);
  doc.text(subtitle, 196, 24, { align: 'right' });

  // ── Meta strip (light) ───────────────────────────────────────────────────
  doc.setFillColor(...C.bgLight);
  doc.rect(0, 32, 210, 10, 'F');

  doc.setTextColor(...C.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const today = format(new Date(), 'dd MMM yyyy');
  doc.text(`Period: ${from}  –  ${to}`, 14, 38.5);
  doc.text(`Generated: ${today}`, 196, 38.5, { align: 'right' });

  // ── Bottom border of strip ───────────────────────────────────────────────
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(0, 42, 210, 42);

  return 52; // first content Y
}

/**
 * Draw a gold-accented section title and return the next Y.
 */
function sectionTitle(doc, text, y) {
  if (y > 268) { doc.addPage(); y = 22; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text(text, 14, y);

  // Gold accent line under title
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.5);
  doc.line(14, y + 1.5, 196, y + 1.5);

  return y + 9;
}

/**
 * Draw a row of metric cards and return the next Y.
 */
function metricsRow(doc, items, y) {
  const colW = 182 / items.length;

  items.forEach(({ label, value, sub, color = C.gold }, i) => {
    const x = 14 + i * colW;
    const w = colW - 3;

    // Card background
    doc.setFillColor(252, 252, 253);
    doc.roundedRect(x, y, w, 27, 2, 2, 'F');

    // Left gold accent bar
    doc.setFillColor(...C.gold);
    doc.roundedRect(x, y, 2.5, 27, 1, 1, 'F');

    // Border
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, 27, 2, 2, 'S');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(label.toUpperCase(), x + 6, y + 8);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(String(value), x + 6, y + 19);

    // Sub-label
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.muted);
      doc.text(String(sub), x + 6, y + 25.5);
    }
  });

  return y + 34;
}

/**
 * Draw the Insights & Recommendations section and return the next Y.
 */
function insightsSection(doc, items, y) {
  if (items.length === 0) return y;
  y = sectionTitle(doc, 'Insights & Recommendations', y);

  items.forEach(({ type, text }) => {
    if (y > 270) { doc.addPage(); y = 22; }

    // Coloured left stripe
    const stripeColor = type === 'warning' ? C.red : type === 'success' ? C.green : C.blue;
    doc.setFillColor(...stripeColor);
    doc.rect(14, y - 3.5, 2, 0, 'F'); // start invisible, grow with text

    // Bullet dot
    doc.setFillColor(...stripeColor);
    doc.circle(19, y - 0.5, 1.5, 'F');

    // Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.dark);
    const lines = doc.splitTextToSize(text, 166);
    doc.text(lines, 24, y);
    y += lines.length * 5 + 5;
  });

  return y + 4;
}

/**
 * Stamp every page with a footer line. Call after all content is written.
 */
function pageFooters(doc, reportName) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);

    // Footer rule
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(14, 287, 196, 287);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Glanz  ·  Confidential ${reportName}`, 14, 292);
    doc.text(`Page ${p} of ${total}`, 196, 292, { align: 'right' });
  }
}

// ── Table defaults (shared by all autoTable calls) ─────────────────────────────
const TABLE_DEFAULTS = {
  styles: {
    fontSize:    8.5,
    cellPadding: 3,
    textColor:   C.dark,
  },
  headStyles: {
    fillColor:  C.navy,       // dark navy header rows instead of blue
    textColor:  C.gold,       // gold text on dark — matches brand
    fontStyle:  'bold',
    fontSize:   8,
  },
  alternateRowStyles: { fillColor: [249, 250, 251] },
  margin: { left: 14, right: 14 },
};

// ── Insight generators (logic untouched) ──────────────────────────────────────

function financialInsights(report) {
  const insights = [];
  const {
    totalRevenue, totalCost, totalProfit: _totalProfit, totalBookings,
    profitMarginPercent, averageBookingValue, dailyBreakdown = [],
  } = report;

  if (profitMarginPercent < 15) {
    insights.push({ type: 'warning', text: `Profit margin is low at ${profitMarginPercent.toFixed(1)}%. Review product/supply costs or consider a pricing adjustment for premium tiers.` });
  } else if (profitMarginPercent >= 30) {
    insights.push({ type: 'success', text: `Strong profit margin of ${profitMarginPercent.toFixed(1)}%. Business is healthy — consider reinvesting surplus into marketing or staff training.` });
  } else {
    insights.push({ type: 'info', text: `Profit margin is ${profitMarginPercent.toFixed(1)}%. Industry target for cleaning services is 15–35%; you are within the healthy range.` });
  }

  if (totalBookings < 5) {
    insights.push({ type: 'warning', text: `Only ${totalBookings} bookings in this period. Consider promotional pricing, referral incentives, or boosting online presence.` });
  }

  if (averageBookingValue < 100) {
    insights.push({ type: 'info', text: `Average booking value is ${formatQAR(averageBookingValue)}. Upselling add-ons (interior, engine bay, ceramic coat) could increase this meaningfully.` });
  }

  if (dailyBreakdown.length > 0) {
    const zeroDays = dailyBreakdown.filter(d => d.bookingCount === 0).length;
    if (zeroDays > dailyBreakdown.length * 0.4) {
      insights.push({ type: 'warning', text: `${zeroDays} of ${dailyBreakdown.length} days had no bookings. Identify slow days (typically mid-week) and run targeted promotions on those days.` });
    }
    const best = dailyBreakdown.reduce((a, b) => a.revenue > b.revenue ? a : b, dailyBreakdown[0]);
    if (best?.revenue > 0) {
      const dayLabel = format(new Date(best.date), 'EEEE dd MMM yyyy');
      insights.push({ type: 'info', text: `Peak revenue day was ${dayLabel} (${formatQAR(best.revenue)}). Analyse what drove this — staffing levels, promotions, or seasonal demand — to replicate it.` });
    }
  }

  if (totalRevenue > 0 && totalCost / totalRevenue > 0.7) {
    insights.push({ type: 'warning', text: `Product costs represent ${((totalCost / totalRevenue) * 100).toFixed(1)}% of revenue. Review product usage per job and consider bulk procurement to reduce costs.` });
  }

  return insights;
}

function operationalInsights(report) {
  const {
    totalBookings, completedBookings, cancelledBookings,
    pendingBookings, packagePopularity = [],
  } = report;

  if (totalBookings === 0) {
    return [{ type: 'info', text: 'No bookings recorded in the selected period.' }];
  }

  const insights = [];
  const cancelRate     = (cancelledBookings / totalBookings) * 100;
  const completionRate = (completedBookings  / totalBookings) * 100;
  const pendingRate    = (pendingBookings    / totalBookings) * 100;

  if (cancelRate > 20) {
    insights.push({ type: 'warning', text: `Cancellation rate is high at ${cancelRate.toFixed(1)}%. Common causes: scheduling conflicts, pricing concerns, or unclear expectations. Consider a flexible rescheduling policy.` });
  } else if (cancelRate < 5) {
    insights.push({ type: 'success', text: `Very low cancellation rate of ${cancelRate.toFixed(1)}%. Customers are committed — great sign of pricing and expectation alignment.` });
  }

  if (completionRate >= 80) {
    insights.push({ type: 'success', text: `High completion rate of ${completionRate.toFixed(1)}%. Operations are running efficiently.` });
  }

  if (pendingRate > 25) {
    insights.push({ type: 'warning', text: `${pendingBookings} bookings (${pendingRate.toFixed(1)}%) are still pending. Ensure timely worker assignment to avoid customer dissatisfaction.` });
  }

  if (packagePopularity.length > 0) {
    const top = packagePopularity[0];
    insights.push({ type: 'success', text: `Top package is "${top.packageName}" with ${top.bookingCount} bookings. Ensure sufficient worker capacity and products stocked for this service.` });
    const low = packagePopularity[packagePopularity.length - 1];
    if (packagePopularity.length > 1 && low.bookingCount <= 2) {
      insights.push({ type: 'info', text: `"${low.packageName}" has only ${low.bookingCount} booking(s). Consider reviewing its visibility, adjusting pricing, or bundling it with a popular package.` });
    }
  }

  return insights;
}

// ── Public exports ────────────────────────────────────────────────────────────

export function generateFinancialPDF(report, startDate, endDate) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawHeader(doc, 'Financial Report', 'Revenue & Profitability Analysis', startDate, endDate);

  y = sectionTitle(doc, 'Key Metrics', y);
  y = metricsRow(doc, [
    { label: 'Total Revenue',  value: formatQAR(report.totalRevenue),                          sub: `${report.totalBookings} bookings`,                          color: C.gold   },
    { label: 'Total Cost',     value: formatQAR(report.totalCost),                             sub: 'Product expenses',                                          color: C.red    },
    { label: 'Net Profit',     value: formatQAR(report.totalProfit),                           sub: `${report.profitMarginPercent.toFixed(1)}% margin`,           color: C.green  },
    { label: 'Avg Booking',    value: formatQAR(report.averageBookingValue),                   sub: 'Per appointment',                                           color: C.purple },
  ], y);

  y = insightsSection(doc, financialInsights(report), y);

  if (report.dailyBreakdown?.length > 0) {
    if (y > 230) { doc.addPage(); y = 22; }
    y = sectionTitle(doc, 'Daily Breakdown', y);
    autoTable(doc, {
      ...TABLE_DEFAULTS,
      startY: y,
      head: [['Date', 'Bookings', 'Revenue', 'Cost', 'Profit', 'Margin']],
      body: report.dailyBreakdown.map(day => {
        const margin = day.revenue > 0 ? ((day.profit / day.revenue) * 100).toFixed(1) : '0.0';
        return [
          format(new Date(day.date), 'dd MMM yyyy'),
          day.bookingCount,
          formatQAR(day.revenue),
          formatQAR(day.cost),
          formatQAR(day.profit),
          `${margin}%`,
        ];
      }),
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { textColor: C.gold  },
        3: { textColor: C.red   },
        4: { textColor: C.green },
        5: { halign: 'center'   },
      },
    });
  }

  pageFooters(doc, 'Financial Report');
  doc.save(`financial-report-${startDate}-to-${endDate}.pdf`);
}

export function generateOperationalPDF(report, startDate, endDate) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = drawHeader(doc, 'Operational Report', 'Booking Statistics & Service Analysis', startDate, endDate);

  y = sectionTitle(doc, 'Key Metrics', y);
  y = metricsRow(doc, [
    { label: 'Total Bookings', value: report.totalBookings,     color: C.gold  },
    { label: 'Completed',      value: report.completedBookings, color: C.green },
    { label: 'Pending',        value: report.pendingBookings,   color: C.amber },
    { label: 'Cancelled',      value: report.cancelledBookings, color: C.red   },
  ], y);

  if (report.bookingsByStatus) {
    y = sectionTitle(doc, 'Bookings by Status', y);
    autoTable(doc, {
      ...TABLE_DEFAULTS,
      startY: y,
      head: [['Status', 'Count', 'Share']],
      body: Object.entries(report.bookingsByStatus).map(([status, count]) => [
        status,
        count,
        report.totalBookings > 0 ? `${((count / report.totalBookings) * 100).toFixed(1)}%` : '0%',
      ]),
      tableWidth: 100,
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (report.packagePopularity?.length > 0) {
    if (y > 220) { doc.addPage(); y = 22; }
    y = sectionTitle(doc, 'Package Popularity', y);
    autoTable(doc, {
      ...TABLE_DEFAULTS,
      startY: y,
      head: [['#', 'Package', 'Tier', 'Bookings', 'Revenue']],
      body: report.packagePopularity.map((pkg, i) => [
        i + 1, pkg.packageName, pkg.tier, pkg.bookingCount, formatQAR(pkg.totalRevenue),
      ]),
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        3: { halign: 'center' },
        4: { textColor: C.green, fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (report.topProductsUsed?.length > 0) {
    if (y > 220) { doc.addPage(); y = 22; }
    y = sectionTitle(doc, 'Top Products Used (by cost)', y);
    autoTable(doc, {
      ...TABLE_DEFAULTS,
      startY: y,
      head: [['#', 'Product', 'Qty Used', 'Total Cost']],
      body: report.topProductsUsed.map((p, i) => [
        i + 1,
        p.productName,
        `${p.totalQuantityUsed.toFixed(1)} ${p.unit}`,
        formatQAR(p.totalCost),
      ]),
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        2: { halign: 'center' },
        3: { textColor: C.red, fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  y = insightsSection(doc, operationalInsights(report), y);

  pageFooters(doc, 'Operational Report');
  doc.save(`operational-report-${startDate}-to-${endDate}.pdf`);
}