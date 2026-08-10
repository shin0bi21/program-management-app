import { useEffect, useMemo } from 'react';
import { usePDF } from '@react-pdf/renderer';
import LoadingSpinner from '../../../../../common/components/LoadingSpinner/LoadingSpinner';
import type { CohortYouthReport } from '../../../../../common/types/cohort';
import YouthReportDocument from './YouthReportDocument';
import useAttendanceChartImages from './useAttendanceChartImages';

interface YouthReportPdfProps {
  report: CohortYouthReport;
  onPdfReady: (url: string | null) => void;
}

interface GeneratedYouthReportPdfProps extends YouthReportPdfProps {
  attendanceCharts: Record<string, string>;
}

function GeneratedYouthReportPdf({ report, attendanceCharts, onPdfReady }: GeneratedYouthReportPdfProps) {
  const document = useMemo(
    () => <YouthReportDocument report={report} attendanceCharts={attendanceCharts} />,
    [attendanceCharts, report],
  );
  const [pdf] = usePDF({ document });

  useEffect(() => {
    onPdfReady(!pdf.loading ? pdf.url : null);
    return () => onPdfReady(null);
  }, [onPdfReady, pdf.loading, pdf.url]);

  return <div className="youth-report-pdf">
    {!pdf.loading && pdf.url ? <iframe
      className="youth-report-pdf__viewer"
      src={pdf.url}
      title="Youth report PDF preview"
    /> : <div className="youth-report-pdf__chart-loading">
      <LoadingSpinner />
      <span>Building report…</span>
    </div>}
  </div>;
}

export default function YouthReportPdf({ report, onPdfReady }: YouthReportPdfProps) {
  const { images, ready } = useAttendanceChartImages(report);

  if (!ready) {
    return <div className="youth-report-pdf">
      <div className="youth-report-pdf__chart-loading">
        <LoadingSpinner />
        <span>Building report…</span>
      </div>
    </div>;
  }

  return <GeneratedYouthReportPdf
    report={report}
    attendanceCharts={images}
    onPdfReady={onPdfReady}
  />;
}
