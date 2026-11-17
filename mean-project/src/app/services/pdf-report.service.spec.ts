import jsPDF from 'jspdf';
import { vi } from 'vitest';
import { PdfReportPayload, PdfReportService } from './pdf-report.service';

class TestPdfReportService extends PdfReportService {
  document?: jsPDF;

  protected override createDocument(): jsPDF {
    this.document = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
    vi.spyOn(this.document, 'save').mockImplementation(() => this.document!);
    vi.spyOn(this.document, 'text');
    return this.document;
  }
}

describe('PdfReportService', () => {
  it('creates a summary page followed by the date-wise expense ledger', async () => {
    const service = new TestPdfReportService();
    const payload: PdfReportPayload = {
      fileName: 'expense-report.pdf',
      reportTitle: 'Shree Nilkanth Stationery Expense Report',
      businessName: 'Shree Nilkanth Stationery',
      selectedRange: { from: '2026-04-01', to: '2026-04-02' },
      generationDate: '2 Apr 2026',
      openingInHand: 1000,
      totalCounter: 5000,
      totalExpense: 800,
      closingInHand: 5200,
      categorySummary: [],
      topTransactions: [],
      dateWiseSummary: [],
      detailedRecords: [
        {
          date: '1 Apr 2026',
          previousInHand: 1000,
          counter: 3000,
          expenses: [
            {
              title: 'Paper',
              category: 'Product Purchase',
              amount: 800,
              description: '',
              time: '',
              notes: '',
            },
          ],
          totalExpense: 800,
          closingInHand: 3200,
        },
        {
          date: '2 Apr 2026',
          previousInHand: 3200,
          counter: 2000,
          expenses: [],
          totalExpense: 0,
          closingInHand: 5200,
        },
      ],
      paidPendingSummary: {
        paidAmount: 800,
        paidCount: 1,
        pendingAmount: 0,
        paidPercentage: 100,
        pendingPercentage: 0,
        pendingCount: 0,
      },
      paymentModeSummary: [],
      categoryStatusSummary: [],
    };

    await service.generateReport(payload);

    expect(service.document?.getNumberOfPages()).toBe(2);
    expect(service.document?.save).toHaveBeenCalledWith('expense-report.pdf');
    const printedText = vi
      .mocked(service.document!.text)
      .mock.calls.flatMap(([value]) => (Array.isArray(value) ? value : [value]));
    expect(printedText).toContain('Shree Nilkanth Stationery');
    expect(printedText).toContain('EXPENSE REPORT');
    expect(printedText).toContain('DATE-WISE LEDGER');
    expect(printedText).toContain('Opening balance');
    expect(printedText).toContain('Counter total');
    expect(printedText).toContain('Expense total');
    expect(printedText).toContain('Expense details');
    expect(printedText).toContain('1/4/26');
    expect(printedText).toContain('Paper (Product Purchase): ₹ 800.00');
    expect(printedText).toContain('No expenses');
  });
});
