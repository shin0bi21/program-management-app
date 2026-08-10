import PDFDocument from 'pdfkit';
import type { AccessTokenPayload } from '../types/auth';
import { getCohortYouthReport } from './cohortReportService';

type YouthReport = Awaited<ReturnType<typeof getCohortYouthReport>>;
type ReportYouth = YouthReport['youth'][number];
type Breakdown = ReportYouth['attendanceBreakdown']['total'];

const pageWidth = 612;
const pageHeight = 792;
const margin = 32;
const contentWidth = pageWidth - (margin * 2);
const orange = '#d95f02';
const muted = '#59636e';
const border = '#d9dee4';
const statusValues = { unmarked: 1, absent: 2, late: 3, excused: 4, present: 5 } as const;
const statusLabels = ['Unmarked', 'Absent', 'Late', 'Excused', 'On time'];
const noteStyles = {
  general: { label: 'General', marker: 'G', color: '#59636e' },
  attendance: { label: 'Attendance', marker: 'AT', color: '#2563a6' },
  behaviour: { label: 'Behaviour', marker: 'B', color: '#b45309' },
  achievement: { label: 'Achievement', marker: 'AC', color: '#15803d' },
  follow_up: { label: 'Follow-up', marker: 'F', color: '#7e22ce' },
} as const;

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

function drawBreakdown(doc: PDFKit.PDFDocument, youth: ReportYouth) {
  const columns = [...youth.attendanceBreakdown.bySessionType, youth.attendanceBreakdown.total];
  const gap = 6;
  const width = (contentWidth - (gap * (columns.length - 1))) / columns.length;
  const top = doc.y;
  const height = 102;

  columns.forEach((column, index) => {
    const left = margin + (index * (width + gap));
    doc.roundedRect(left, top, width, height, 3).lineWidth(0.7).strokeColor(border).stroke();
    doc.rect(left, top, width, 22).fillAndStroke(column.name === 'Total' ? '#e9edf1' : '#f4f6f8', border);
    doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(7).text(column.name, left + 3, top + 7, { width: width - 6, align: 'center' });
    const metrics = [
      ['On time', column.present], ['Late', column.late], ['Absent', column.absent],
      ['Excused', column.excused], ['Unmarked', column.unmarked],
    ] as const;
    metrics.forEach(([label, value], metricIndex) => {
      const y = top + 27 + (metricIndex * 11);
      doc.font('Helvetica').fontSize(6.5).fillColor(muted).text(label, left + 4, y, { width: width - 20 });
      doc.font('Helvetica-Bold').fillColor('#1f2937').text(String(value), left + width - 17, y, { width: 12, align: 'right' });
    });
    doc.moveTo(left, top + 84).lineTo(left + width, top + 84).strokeColor(border).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#1f2937').text(attendanceRate(column), left + 3, top + 90, { width: width - 6, align: 'center' });
  });
  resetTextFlow(doc);
  doc.y = top + height + 14;
}

function drawTimeline(doc: PDFKit.PDFDocument, youth: ReportYouth) {
  if (!youth.timeline.length) {
    resetTextFlow(doc);
    doc.font('Helvetica').fontSize(8).fillColor(muted)
      .text("No sessions in this youth's enrollment period.", margin, doc.y, { width: contentWidth });
    return;
  }

  const top = doc.y;
  const chartLeft = margin + 58;
  const chartRight = pageWidth - margin - 10;
  const chartTop = top + 8;
  const chartBottom = top + 116;
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
      doc.moveTo(chartLeft + ((index - 1) * stepX), pointY(previous.status)).lineTo(x, y).lineWidth(1.6).strokeColor(orange).stroke();
    }
    doc.circle(x, y, 2.8).fillColor(point.status ? orange : '#7b8794').fill();
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
  resetTextFlow(doc);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1f2937')
    .text(`${youth.firstName} ${youth.lastName}`, margin, doc.y, { width: contentWidth });
  resetTextFlow(doc);
  doc.moveDown(0.8).fontSize(9).text('Attendance Breakdown', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.5);
  drawBreakdown(doc, youth);
  resetTextFlow(doc);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1f2937')
    .text('Attendance Timeline', margin, doc.y, { width: contentWidth });
  doc.moveDown(0.4);
  drawTimeline(doc, youth);
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
