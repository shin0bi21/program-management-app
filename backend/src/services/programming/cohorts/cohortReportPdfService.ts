import PDFDocument from 'pdfkit';
import type { AccessTokenPayload } from '../../../types/auth';
import { getCohortYouthReport } from './cohortReportService';

type YouthReport = Awaited<ReturnType<typeof getCohortYouthReport>>;
type ReportYouth = YouthReport['youth'][number];
type Breakdown = ReportYouth['attendanceBreakdown']['total'];

const pageWidth = 612;
const pageHeight = 792;
const margin = 32;
const contentWidth = pageWidth - (margin * 2);
const muted = '#59636e';
const border = '#d9dee4';
const totalColor = '#4b5563';
const timelineLineColor = '#9ca3af';
const sessionTypeColors = {
  Regular: '#2563a6',
  'Guest Speaker': '#eab308',
  'Field Trip': '#15803d',
} as const;
const additionalSessionTypeColors = ['#7e22ce', '#be123c', '#0f766e', '#c2410c', '#4338ca'];
const statusValues = { unmarked: 1, absent: 2, late: 3, excused: 4, present: 5 } as const;
const statusLabels = ['Unmarked', 'Absent', 'Late', 'Excused', 'On time'];
const noteStyles = {
  general: { label: 'General', marker: 'G', color: '#59636e' },
  attendance: { label: 'Attendance', marker: 'AT', color: '#2563a6' },
  behaviour: { label: 'Behaviour', marker: 'B', color: '#b45309' },
  achievement: { label: 'Achievement', marker: 'AC', color: '#15803d' },
  follow_up: { label: 'Follow-up', marker: 'F', color: '#7e22ce' },
} as const;

export async function generateCohortYouthReportPdf(cohortId: string, actor: AccessTokenPayload, youthId?: string) {
  const report = await getCohortYouthReport(cohortId, actor, youthId);
  const title = `${report.cohort.programName} - ${report.cohort.name} Youth Report`;
  const doc = new PDFDocument({ size: 'LETTER', margin, autoFirstPage: true, info: { Title: title } });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (!report.youth.length) {
    doc.font('Helvetica').fontSize(11).text('No youth have participated in this cohort.');
  } else {
    report.youth.forEach((youth, index) => {
      if (index) doc.addPage();
      drawYouth(doc, youth);
    });
  }
  doc.end();
  return { buffer: await completed, filename: `${safeFilename(title)}.pdf` };
}

function attendanceRate(breakdown: Breakdown) {
  return breakdown.attendanceRate === null ? 'Not available' : `${breakdown.attendanceRate}% attendance`;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height <= pageHeight - margin) return;
  doc.addPage();
  doc.y = margin;
}

function resetTextFlow(doc: PDFKit.PDFDocument) {
  doc.x = margin;
}

function createSessionTypeColorMap(youth: ReportYouth) {
  const colors = new Map<string, string>();
  let additionalColorIndex = 0;
  youth.attendanceBreakdown.bySessionType.forEach(({ name }) => {
    const presetColor = sessionTypeColors[name as keyof typeof sessionTypeColors];
    colors.set(name, presetColor ?? additionalSessionTypeColors[additionalColorIndex++ % additionalSessionTypeColors.length]!);
  });
  return colors;
}

function drawBreakdown(doc: PDFKit.PDFDocument, youth: ReportYouth, colors: Map<string, string>) {
  const summary = youth.attendanceBreakdown.total;
  const metrics = [
    ['On time', summary.present],
    ['Late', summary.late],
    ['Absent', summary.absent],
    ['Excused', summary.excused],
    ['Unmarked', summary.unmarked],
  ] as const;
  const top = doc.y;
  const metricWidth = 58;
  const metricGap = 12;

  metrics.forEach(([label, value], index) => {
    const left = margin + (index * (metricWidth + metricGap));
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#1f2937')
      .text(String(value), left, top, { width: metricWidth });
    doc.font('Helvetica').fontSize(7).fillColor(muted)
      .text(label, left, top + 19, { width: metricWidth });
  });

  doc.font('Helvetica-Bold').fontSize(8).fillColor(totalColor)
    .text(attendanceRate(summary), margin + 365, top + 8, { width: contentWidth - 365, align: 'right' });
  doc.moveTo(margin, top + 38).lineTo(pageWidth - margin, top + 38)
    .lineWidth(0.5).strokeColor(border).stroke();

  resetTextFlow(doc);
  doc.y = top + 50;

  youth.attendanceBreakdown.bySessionType.forEach(column => {
    ensureSpace(doc, 51);
    const sectionTop = doc.y;
    const accentColor = colors.get(column.name) ?? muted;

    doc.save().fillOpacity(0.08).rect(margin, sectionTop, contentWidth, 44).fillColor(accentColor).fill().restore();
    doc.rect(margin, sectionTop, 4, 44).fillColor(accentColor).fill();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1f2937')
      .text(column.name, margin + 13, sectionTop + 9, { width: 150, height: 11, ellipsis: true });
    doc.font('Helvetica').fontSize(6.5).fillColor(accentColor)
      .text(attendanceRate(column), margin + 13, sectionTop + 24, { width: 150 });

    const sectionMetrics = [
      ['On time', column.present],
      ['Late', column.late],
      ['Absent', column.absent],
      ['Excused', column.excused],
      ['Unmarked', column.unmarked],
    ] as const;
    sectionMetrics.forEach(([label, value], index) => {
      const left = margin + 184 + (index * 68);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1f2937')
        .text(String(value), left, sectionTop + 8, { width: 55, align: 'right' });
      doc.font('Helvetica').fontSize(6).fillColor(muted)
        .text(label, left, sectionTop + 23, { width: 55, align: 'right' });
    });

    resetTextFlow(doc);
    doc.y = sectionTop + 51;
  });

  doc.y += 5;
}

function drawTimeline(doc: PDFKit.PDFDocument, youth: ReportYouth, colors: Map<string, string>) {
  if (!youth.timeline.length) {
    resetTextFlow(doc);
    doc.font('Helvetica').fontSize(8).fillColor(muted)
      .text("No sessions in this youth's enrollment period.", margin, doc.y, { width: contentWidth });
    return;
  }

  const top = doc.y;
  const chartLeft = margin + 58;
  const chartRight = pageWidth - margin - 10;
  // Reserve a band above the highest status row so its note markers remain
  // distinct instead of stacking over the row or timeline heading.
  const chartTop = top + 61;
  const chartBottom = top + 169;
  const plotHeight = chartBottom - chartTop;
  const stepX = youth.timeline.length === 1 ? 0 : (chartRight - chartLeft) / (youth.timeline.length - 1);
  const pointY = (status: keyof typeof statusValues | null) => chartBottom - (((statusValues[status ?? 'unmarked'] - 1) / 4) * plotHeight);

  statusLabels.forEach((label, index) => {
    const y = chartBottom - ((index / 4) * plotHeight);
    doc.moveTo(chartLeft, y).lineTo(chartRight, y).lineWidth(0.35).strokeColor('#e5e7eb').stroke();
    doc.font('Helvetica').fontSize(6.5).fillColor(muted).text(label, margin, y - 3, { width: 50, align: 'right' });
  });

  youth.timeline.forEach((point, index) => {
    const x = chartLeft + (index * stepX);
    const y = pointY(point.status);
    if (index) {
      const previous = youth.timeline[index - 1]!;
      doc.moveTo(chartLeft + ((index - 1) * stepX), pointY(previous.status)).lineTo(x, y).lineWidth(1.2).strokeColor(timelineLineColor).stroke();
    }
    doc.circle(x, y, 3.2).fillColor(colors.get(point.sessionTypeName) ?? muted).fill();
    point.noteCategories.forEach((category, categoryIndex) => {
      const style = noteStyles[category];
      const markerY = Math.max(chartTop + 5, y - 12 - (categoryIndex * 11));
      doc.circle(x, markerY, 4.5).fillColor(style.color).fill();
      doc.font('Helvetica-Bold').fontSize(style.marker.length > 1 ? 3.5 : 5).fillColor('#ffffff')
        .text(style.marker, x - 4, markerY - 2, { width: 8, align: 'center' });
    });
    const showLabel = youth.timeline.length <= 10 || index % Math.ceil(youth.timeline.length / 10) === 0;
    if (showLabel) {
      const label = new Date(point.startsAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
      doc.font('Helvetica').fontSize(5.5).fillColor(muted).text(label, x - 18, chartBottom + 5, { width: 36, align: 'center' });
    }
  });
  resetTextFlow(doc);
  doc.y = chartBottom + 25;
}

function drawNotes(doc: PDFKit.PDFDocument, youth: ReportYouth) {
  if (!youth.notes.length) {
    resetTextFlow(doc);
    doc.font('Helvetica').fontSize(8).fillColor(muted)
      .text('No notes for this youth.', margin, doc.y, { width: contentWidth });
    return;
  }
  youth.notes.forEach(note => {
    const detailHeight = note.details ? doc.heightOfString(note.details, { width: contentWidth }) : 0;
    ensureSpace(doc, 34 + detailHeight);
    const style = noteStyles[note.category];
    const date = new Date(note.startsAt).toLocaleDateString('en-CA', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto',
    });
    const session = note.sessionTheme || 'Untitled session';
    doc.circle(margin + 6, doc.y + 5, 6).fillColor(style.color).fill();
    doc.font('Helvetica-Bold').fontSize(style.marker.length > 1 ? 4 : 6).fillColor('#ffffff')
      .text(style.marker, margin + 1, doc.y + 2, { width: 10, align: 'center' });
    doc.font('Helvetica').fontSize(7).fillColor(style.color).text(`${style.label} · ${date} · ${session}`, margin + 18, doc.y - 10);
    doc.moveDown(0.3).font('Helvetica-Bold').fontSize(9).fillColor('#1f2937').text(note.title);
    if (note.details) doc.moveDown(0.15).font('Helvetica').fontSize(8).fillColor('#3f4852').text(note.details, { lineGap: 1.5 });
    doc.moveDown(0.5).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).lineWidth(0.4).strokeColor('#eef0f2').stroke();
    doc.moveDown(0.7);
  });
}

function drawYouth(doc: PDFKit.PDFDocument, youth: ReportYouth) {
  const colors = createSessionTypeColorMap(youth);
  resetTextFlow(doc);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1f2937')
    .text(`${youth.firstName} ${youth.lastName}`, margin, doc.y, { width: contentWidth });
  resetTextFlow(doc);
  doc.moveDown(0.8).fontSize(9).text('Attendance Breakdown', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.5);
  drawBreakdown(doc, youth, colors);
  ensureSpace(doc, 215);
  resetTextFlow(doc);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1f2937')
    .text('Attendance Timeline', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.4);
  drawTimeline(doc, youth, colors);
  ensureSpace(doc, 45);
  resetTextFlow(doc);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1f2937')
    .text('Session Notes', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.5);
  drawNotes(doc, youth);
}

function safeFilename(value: string) {
  return value
    .split('')
    .map(character => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '-' : character;
    })
    .join('')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'Youth Report';
}
