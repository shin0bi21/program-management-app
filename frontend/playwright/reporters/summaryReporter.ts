import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const summaryPath = resolve('test-results/playwright-summary.json');

export default class SummaryReporter implements Reporter {
  private readonly results = new Map<string, { title: string; status: TestResult['status'] }>();
  private startedAt = 0;

  onBegin() {
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.results.set(test.id, {
      title: test.titlePath().join(' › '),
      status: result.status,
    });
  }

  onEnd(result: FullResult) {
    const tests = [...this.results.values()];
    const passed = tests.filter(test => test.status === 'passed').length;
    const skipped = tests.filter(test => test.status === 'skipped').length;
    const failedTests = tests
      .filter(test => test.status !== 'passed' && test.status !== 'skipped')
      .map(test => test.title);

    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify({
      status: result.status,
      durationMs: Date.now() - this.startedAt,
      tests: {
        total: tests.length,
        passed,
        failed: failedTests.length,
        skipped,
      },
      failedTests,
    }, null, 2)}\n`);
  }
}
