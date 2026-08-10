import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CohortYouthReport } from '../../../../../common/types/cohort';
import { youthReportNoteCategories } from './youthReportNoteCategories';
import { formatAttendanceRate } from './youthReport.utils';

const styles = StyleSheet.create({
  page: { padding: 32, color: '#1f2937', fontFamily: 'Helvetica', fontSize: 9 },
  youthName: { fontSize: 16, fontWeight: 700, marginBottom: 14 },
  sectionLabel: { fontSize: 9, fontWeight: 700, marginBottom: 5 },
  attendanceCards: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  attendanceCard: { flexGrow: 1, flexBasis: 0, border: '1 solid #d9dee4', borderRadius: 4 },
  attendanceTotalCard: { backgroundColor: '#f8f9fa', borderColor: '#aeb6c0' },
  attendanceCardHeader: { minHeight: 30, padding: 7, backgroundColor: '#f4f6f8', justifyContent: 'center' },
  attendanceCardTitle: { fontSize: 8, fontWeight: 700, textAlign: 'center' },
  attendanceMetric: { flexDirection: 'row', justifyContent: 'space-between', padding: '4 7', borderTop: '1 solid #eef0f2' },
  attendanceMetricLabel: { color: '#59636e', fontSize: 7 },
  attendanceMetricValue: { fontSize: 7, fontWeight: 700 },
  attendanceCardRate: { padding: 7, borderTop: '1 solid #d9dee4', alignItems: 'center' },
  attendanceCardRateText: { fontSize: 8, fontWeight: 700, textAlign: 'center' },
  timelineChart: { width: '100%', height: 207, marginBottom: 14 },
  notes: { borderTop: '1 solid #e5e7eb', paddingTop: 10 },
  note: { marginBottom: 9, paddingBottom: 9, borderBottom: '1 solid #eef0f2' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  noteMarker: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  noteMarkerText: { color: '#ffffff', fontSize: 6, fontWeight: 700, textAlign: 'center' },
  noteMeta: { color: '#59636e', fontSize: 7 },
  noteTitle: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  noteDetails: { color: '#3f4852', lineHeight: 1.35 },
  muted: { color: '#59636e' },
});

interface YouthReportDocumentProps {
  report: CohortYouthReport;
  attendanceCharts: Record<string, string>;
}

export default function YouthReportDocument({ report, attendanceCharts }: YouthReportDocumentProps) {
  return <Document title={`${report.cohort.programName} - ${report.cohort.name} Youth Report`}>
    {report.youth.length ? report.youth.map(youth => {
      const columns = [...youth.attendanceBreakdown.bySessionType, youth.attendanceBreakdown.total];

      return <Page key={youth.id} size="LETTER" style={styles.page} wrap>
        <Text style={styles.youthName}>{youth.firstName} {youth.lastName}</Text>

        <Text style={styles.sectionLabel}>Attendance Breakdown</Text>
        <View style={styles.attendanceCards} wrap={false}>
          {columns.map(type => <View key={type.name} style={[
            styles.attendanceCard,
            ...(type.name === 'Total' ? [styles.attendanceTotalCard] : []),
          ]}>
            <View style={styles.attendanceCardHeader}>
              <Text style={styles.attendanceCardTitle}>{type.name}</Text>
            </View>
            {([
              ['On time', 'present'], ['Late', 'late'], ['Absent', 'absent'],
              ['Excused', 'excused'], ['Unmarked', 'unmarked'],
            ] as const).map(([label, status]) => <View key={status} style={styles.attendanceMetric}>
              <Text style={styles.attendanceMetricLabel}>{label}</Text>
              <Text style={styles.attendanceMetricValue}>{type[status]}</Text>
            </View>)}
            <View style={styles.attendanceCardRate}>
              <Text style={styles.attendanceCardRateText}>{formatAttendanceRate(type)}</Text>
            </View>
          </View>)}
        </View>

        <Text style={styles.sectionLabel}>Attendance Timeline</Text>
        {attendanceCharts[youth.id]
          ? <Image src={attendanceCharts[youth.id]} style={styles.timelineChart} />
          : <Text style={styles.muted}>No sessions in this youth's enrollment period.</Text>}

        <View style={styles.notes}>
          <Text style={styles.sectionLabel}>Session Notes</Text>
          {youth.notes.length ? youth.notes.map(note => {
            const noteStyle = youthReportNoteCategories[note.category];
            const sessionLabel = note.sessionTheme || 'Untitled session';
            return <View key={note.id} style={styles.note} wrap={false}>
              <View style={styles.noteHeader}>
                <View style={[styles.noteMarker, { backgroundColor: noteStyle.color }]}>
                  <Text style={styles.noteMarkerText}>{noteStyle.marker}</Text>
                </View>
                <Text style={[styles.noteMeta, { color: noteStyle.color }]}>{noteStyle.label}</Text>
                <Text style={styles.noteMeta}>· {new Date(note.startsAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} · {sessionLabel}</Text>
              </View>
              <Text style={styles.noteTitle}>{note.title}</Text>
              {note.details && <Text style={styles.noteDetails}>{note.details}</Text>}
            </View>;
          }) : <Text style={styles.muted}>No notes for this youth.</Text>}
        </View>
      </Page>;
    }) : <Page size="LETTER" style={styles.page}>
      <Text>No youth have participated in this cohort.</Text>
    </Page>}
  </Document>;
}
