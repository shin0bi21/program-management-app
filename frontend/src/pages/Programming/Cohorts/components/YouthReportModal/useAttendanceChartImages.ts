import { useEffect, useState } from 'react';
import {
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { CohortYouthReport } from '../../../../../common/types/cohort';
import { youthReportNoteCategories } from './youthReportNoteCategories';

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend);

const statusValues = { unmarked: 1, absent: 2, late: 3, excused: 4, present: 5 } as const;
const statusLabels: Record<number, string> = {
  1: 'Unmarked',
  2: 'Absent',
  3: 'Late',
  4: 'Excused',
  5: 'On time',
};

export default function useAttendanceChartImages(report: CohortYouthReport) {
  const [result, setResult] = useState<{
    report: CohortYouthReport | null;
    images: Record<string, string>;
  }>({ report: null, images: {} });

  useEffect(() => {
    const nextImages: Record<string, string> = {};

    for (const youth of report.youth) {
      if (!youth.timeline.length) continue;

      const canvas = document.createElement('canvas');
      canvas.width = 1100;
      canvas.height = 460;
      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: youth.timeline.map(point => new Date(point.startsAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })),
          datasets: [{
            data: youth.timeline.map(point => point.status ? statusValues[point.status] : statusValues.unmarked),
            borderColor: '#d95f02',
            backgroundColor: '#d95f02',
            pointBackgroundColor: youth.timeline.map(point => point.status ? '#d95f02' : '#7b8794'),
            borderWidth: 3.5,
            pointRadius: 4.5,
            pointHoverRadius: 4.5,
            tension: 0,
          }],
        },
        options: {
          responsive: false,
          animation: false,
          devicePixelRatio: 2,
          layout: { padding: { left: 23, right: 23 } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: context => youth.timeline[context.dataIndex]?.status ? statusLabels[Number(context.raw)] : 'Unmarked' } },
          },
          scales: {
            x: { offset: true, grid: { display: false }, ticks: { color: '#59636e', font: { size: 16 } } },
            y: {
              min: 0,
              max: 6,
              ticks: {
                stepSize: 1,
                color: '#59636e',
                font: { size: 16 },
                callback: value => statusLabels[Number(value)] ?? '',
              },
            },
          },
        },
        plugins: [{
          id: 'sessionNoteFlags',
          afterDatasetsDraw(chartInstance) {
            const points = chartInstance.getDatasetMeta(0).data;
            const context = chartInstance.ctx;
            context.save();
            youth.timeline.forEach((point, index) => {
              const chartPoint = points[index];
              if (!chartPoint) return;
              const stackWouldClipTop = chartPoint.y - 21 - ((point.noteCategories.length - 1) * 21) - 10 < chartInstance.chartArea.top;
              point.noteCategories.forEach((category, categoryIndex) => {
                const noteStyle = youthReportNoteCategories[category];
                const x = chartPoint.x;
                const y = stackWouldClipTop
                  ? chartPoint.y + 21 + (categoryIndex * 21)
                  : chartPoint.y - 21 - (categoryIndex * 21);
                context.fillStyle = noteStyle.color;
                context.beginPath();
                context.arc(x, y, 9.2, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = '#ffffff';
                context.font = `700 ${noteStyle.marker.length > 1 ? 8 : 10.5}px Arial`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(noteStyle.marker, x, y);
              });
            });
            context.restore();
          },
        }],
      });
      nextImages[youth.id] = chart.toBase64Image('image/png', 1);
      chart.destroy();
    }

    setResult({ report, images: nextImages });
  }, [report]);

  return {
    images: result.images,
    ready: result.report === report,
  };
}
