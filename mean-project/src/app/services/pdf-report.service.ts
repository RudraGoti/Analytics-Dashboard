import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfReportPayload {
  fileName: string;
  reportTitle: string;
  businessName?: string;
  selectedRange: { from: string; to: string };
  generationDate: string;
  openingInHand: number;
  totalCounter: number;
  totalExpense: number;
  closingInHand: number;
  categorySummary: Array<{ category: string; amount: number; percentage: number; color: string }>;
  topTransactions: Array<{
    date: string;
    title: string;
    category: string;
    amount: number;
    description: string;
    time: string;
    notes: string;
  }>;
  dateWiseSummary: Array<{
    date: string;
    counter: number;
    expense: number;
    runningInHand: number;
    notes: string;
  }>;
  detailedRecords: Array<{
    date: string;
    previousInHand: number;
    counter: number;
    expenses: Array<{
      title: string;
      category: string;
      amount: number;
      description: string;
      time: string;
      notes: string;
    }>;
    totalExpense: number;
    closingInHand: number;
  }>;
  paidPendingSummary: {
    paidAmount: number;
    paidCount: number;
    pendingAmount: number;
    paidPercentage: number;
    pendingPercentage: number;
    pendingCount: number;
  };
  paymentModeSummary: Array<{
    mode: string;
    transactions: number;
    amount: number;
    percentage: number;
  }>;
  categoryStatusSummary: Array<{
    category: string;
    paidAmount: number;
    pendingAmount: number;
    total: number;
  }>;
  trendChartImage?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PdfReportService {
  private readonly pageWidth = 210;
  private readonly pageHeight = 297;
  private readonly margin = 18;
  private readonly borderColor = '#cbd5e1';
  private readonly textColor = '#334155';
  private readonly headingColor = '#1e293b';

  async generateReport(rawPayload: PdfReportPayload): Promise<void> {
    const payload = this.sanitizePayload(rawPayload);
    const doc = this.createDocument();
    const businessName = payload.businessName || payload.reportTitle;
    const period = `${this.formatShortDate(payload.selectedRange.from)} - ${this.formatShortDate(payload.selectedRange.to)}`;
    const innerWidth = this.pageWidth - this.margin * 2;

    this.drawPageFrame(doc);
    this.drawHeader(doc, businessName, 'EXPENSE REPORT', period, payload.generationDate);
    doc.setDrawColor(this.borderColor);
    doc.setLineWidth(0.4);
    doc.line(this.margin + 8, this.margin + 37, this.pageWidth - this.margin - 8, this.margin + 37);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(this.headingColor);
    doc.text('BALANCE SUMMARY', this.margin + 8, this.margin + 48);

    const metrics = [
      { label: 'Opening balance', value: this.formatCurrency(payload.openingInHand) },
      { label: 'Counter total', value: this.formatCurrency(payload.totalCounter) },
      { label: 'Expense total', value: this.formatCurrency(payload.totalExpense) },
      { label: 'Closing balance', value: this.formatCurrency(payload.closingInHand) },
    ];
    const gridY = this.margin + 55;
    const gap = 5;
    const cardWidth = (innerWidth - gap * 3) / 4;
    const cardHeight = 34;

    metrics.forEach((metric, index) => {
      const x = this.margin + index * (cardWidth + gap);
      doc.setDrawColor(this.borderColor);
      doc.setLineWidth(0.35);
      doc.roundedRect(x, gridY, cardWidth, cardHeight, 2, 2, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(this.textColor);
      doc.text(metric.label, x + 3, gridY + 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(this.headingColor);
      doc.text(metric.value, x + 3, gridY + 23);
    });

    this.drawPageNumber(doc, 1);
    doc.addPage();
    const drawLedgerPageHeader = () => {
      this.drawPageFrame(doc);
      this.drawHeader(doc, businessName, 'DATE-WISE LEDGER', period, payload.generationDate, true);
    };

    drawLedgerPageHeader();
    const detailedRows = payload.detailedRecords.map((record) => {
      const expenseEntries = record.expenses.length
        ? record.expenses
            .map(
              (expense) =>
                `${expense.title} (${expense.category}): ${this.formatCurrency(expense.amount)}`,
            )
            .join('\n')
        : 'No expenses';
      return [
        this.formatShortDate(record.date),
        this.formatCurrency(record.previousInHand),
        this.formatCurrency(record.counter),
        expenseEntries,
        this.formatCurrency(record.totalExpense),
        this.formatCurrency(record.closingInHand),
      ];
    });
    detailedRows.push([
      'TOTAL',
      '',
      this.formatCurrency(payload.totalCounter),
      '',
      this.formatCurrency(payload.totalExpense),
      this.formatCurrency(payload.closingInHand),
    ]);
    autoTable(doc, {
      startY: this.margin + 35,
      head: [
        [
          'Date',
          'Opening balance',
          'Counter',
          'Expense details',
          'Expense total',
          'Closing balance',
        ],
      ],
      body: detailedRows,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: this.textColor,
        cellPadding: { top: 4, right: 2, bottom: 4, left: 2 },
        lineColor: this.borderColor,
        lineWidth: { bottom: 0.25 },
        valign: 'middle',
      },
      headStyles: {
        fillColor: '#ffffff',
        textColor: this.headingColor,
        fontStyle: 'bold',
        lineWidth: { bottom: 0.6 },
        lineColor: this.headingColor,
      },
      columnStyles: {
        0: { cellWidth: 19 },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 23, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' },
      },
      margin: {
        top: this.margin + 32,
        left: this.margin + 4,
        right: this.margin + 4,
        bottom: this.margin + 12,
      },
      rowPageBreak: 'avoid',
      didDrawPage: (data) => {
        drawLedgerPageHeader();
        this.drawPageNumber(doc, data.pageNumber + 1);
      },
    });
    doc.save(payload.fileName);
  }

  private drawPageFrame(doc: jsPDF): void {
    const innerWidth = this.pageWidth - this.margin * 2;
    doc.setDrawColor(this.borderColor);
    doc.setLineWidth(0.6);
    doc.roundedRect(
      this.margin,
      this.margin,
      innerWidth,
      this.pageHeight - this.margin * 2,
      5,
      5,
      'S',
    );
  }

  private drawHeader(
    doc: jsPDF,
    businessName: string,
    title: string,
    period: string,
    generationDate: string,
    compact = false,
  ): void {
    const top = this.margin + (compact ? 12 : 17);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 14 : 16);
    doc.setTextColor(this.headingColor);
    doc.text(businessName, this.margin + 8, top);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(this.textColor);
    doc.text('Cash and expense statement', this.margin + 8, top + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 10 : 11);
    doc.setTextColor(this.headingColor);
    doc.text(title, this.pageWidth - this.margin - 8, top - 1, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(this.textColor);
    doc.text(`Date range: ${period}`, this.pageWidth - this.margin - 8, top + 5, {
      align: 'right',
    });
    doc.text(
      `Generated: ${this.formatShortDate(generationDate)}`,
      this.pageWidth - this.margin - 8,
      top + 10,
      { align: 'right' },
    );
  }

  protected createDocument(): jsPDF {
    return new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
  }

  private drawPageNumber(doc: jsPDF, pageNumber: number): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#475569');
    doc.text(String(pageNumber), this.pageWidth - this.margin, this.pageHeight - this.margin / 2, {
      align: 'right',
    });
  }

  private formatShortDate(value: string): string {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoDate) {
      return `${Number(isoDate[3])}/${Number(isoDate[2])}/${isoDate[1].slice(-2)}`;
    }

    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return value;
    }
    return `${date.getDate()}/${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`;
  }

  private formatCurrency(value: number): string {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

    return formatted.startsWith('₹') ? formatted.replace('₹', '₹ ') : formatted;
  }

  private sanitizeText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    let text = String(value);
    text = text.replace(/\r?\n|\r/g, ' ');
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");
    text = text.replace(/&#x2F;/gi, '/');
    text = text.replace(/&[#A-Za-z0-9]+;/g, '');
    text = text.replace(/&/g, '');
    return text.trim();
  }

  private sanitizePayload(payload: PdfReportPayload): PdfReportPayload {
    return {
      ...payload,
      reportTitle: this.sanitizeText(payload.reportTitle),
      businessName: this.sanitizeText(payload.businessName),
      selectedRange: {
        from: this.sanitizeText(payload.selectedRange.from),
        to: this.sanitizeText(payload.selectedRange.to),
      },
      generationDate: this.sanitizeText(payload.generationDate),
      openingInHand: payload.openingInHand,
      totalCounter: payload.totalCounter,
      totalExpense: payload.totalExpense,
      closingInHand: payload.closingInHand,
      categorySummary: payload.categorySummary.map((item) => ({
        category: this.sanitizeText(item.category),
        amount: item.amount,
        percentage: item.percentage,
        color: item.color,
      })),
      topTransactions: payload.topTransactions.map((item) => ({
        date: this.sanitizeText(item.date),
        title: this.sanitizeText(item.title),
        category: this.sanitizeText(item.category),
        amount: item.amount,
        description: this.sanitizeText(item.description),
        time: this.sanitizeText(item.time),
        notes: this.sanitizeText(item.notes),
      })),
      dateWiseSummary: payload.dateWiseSummary.map((item) => ({
        date: this.sanitizeText(item.date),
        counter: item.counter,
        expense: item.expense,
        runningInHand: item.runningInHand,
        notes: this.sanitizeText(item.notes),
      })),
      detailedRecords: payload.detailedRecords.map((item) => ({
        date: this.sanitizeText(item.date),
        previousInHand: item.previousInHand,
        counter: item.counter,
        expenses: item.expenses.map((expense) => ({
          title: this.sanitizeText(expense.title),
          category: this.sanitizeText(expense.category),
          amount: expense.amount,
          description: this.sanitizeText(expense.description),
          time: this.sanitizeText(expense.time),
          notes: this.sanitizeText(expense.notes),
        })),
        totalExpense: item.totalExpense,
        closingInHand: item.closingInHand,
      })),
      paidPendingSummary: { ...payload.paidPendingSummary },
      paymentModeSummary: payload.paymentModeSummary.map((item) => ({
        mode: this.sanitizeText(item.mode),
        transactions: item.transactions,
        amount: item.amount,
        percentage: item.percentage,
      })),
      categoryStatusSummary: payload.categoryStatusSummary.map((item) => ({
        category: this.sanitizeText(item.category),
        paidAmount: item.paidAmount,
        pendingAmount: item.pendingAmount,
        total: item.total,
      })),
      trendChartImage: payload.trendChartImage,
    };
  }
}
