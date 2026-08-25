import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfReportPayload {
  fileName: string;
  reportTitle: string;
  selectedRange: { from: string; to: string };
  generationDate: string;
  openingInHand: number;
  totalCounter: number;
  totalExpense: number;
  closingInHand: number;
  categorySummary: Array<{ category: string; amount: number; percentage: number; color: string }>;
  topTransactions: Array<{ date: string; title: string; category: string; amount: number; description: string; time: string; notes: string }>;
  dateWiseSummary: Array<{ date: string; counter: number; expense: number; runningInHand: number; notes: string }>;
  detailedRecords: Array<{
    date: string;
    previousInHand: number;
    counter: number;
    expenses: Array<{ title: string; category: string; amount: number; description: string; time: string; notes: string }>;
    totalExpense: number;
    closingInHand: number;
  }>;
  trendChartImage?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PdfReportService {
  private readonly pageWidth = 210;
  private readonly pageHeight = 297;
  private readonly margin = 14;

  async generateReport(rawPayload: PdfReportPayload): Promise<void> {
    const payload = this.sanitizePayload(rawPayload);
    const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
    const titleColor = '#0f172a';
    const textColor = '#475569';
    const headerText = '#111827';
    const cardBackground = '#ffffff';
    const pageBackground = '#f3f4f6';
    const kpiBackgrounds = ['#eff6ff', '#ecfdf5', '#fff7ed', '#f5f3ff'];
    const kpiBorders = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed'];
    const kpiText = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed'];

    const reportHeader = () => {
      doc.setFillColor(pageBackground);
      doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F');

      const headerX = this.margin;
      const headerY = 18;
      const headerW = this.pageWidth - this.margin * 2;
      const headerH = 28;

      doc.setFillColor(cardBackground);
      doc.roundedRect(headerX, headerY, headerW, headerH, 4, 4, 'F');
      doc.setDrawColor('#d1d5db');
      doc.setLineWidth(0.3);
      doc.roundedRect(headerX, headerY, headerW, headerH, 4, 4, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(titleColor);
      doc.text(payload.reportTitle, headerX + 6, headerY + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(textColor);
      doc.text('Financial overview and analytics summary report', headerX + 6, headerY + 15);

      doc.setFontSize(9);
      doc.setTextColor('#64748b');
      doc.text(`Period: ${payload.selectedRange.from} to ${payload.selectedRange.to}`, headerX + headerW - 6, headerY + 9, { align: 'right' });
      doc.text(`Generated: ${payload.generationDate}`, headerX + headerW - 6, headerY + 15, { align: 'right' });
    };

    const addFooter = (pageNumber: number, totalPages: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#6b7280');
      doc.text('Analytics Dashboard • Professional report generated automatically', this.margin, this.pageHeight - 12);
      doc.text(`Page ${pageNumber} of ${totalPages}`, this.pageWidth - this.margin, this.pageHeight - 12, { align: 'right' });
    };

    const drawKpiCard = (x: number, y: number, title: string, value: string, subtitle: string, bgIndex: number) => {
      const cardW = (this.pageWidth - this.margin * 2 - 12) / 4;
      const cardH = 30;
      doc.setFillColor(kpiBackgrounds[bgIndex]);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, 'F');
      doc.setDrawColor(kpiBorders[bgIndex]);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(kpiText[bgIndex]);
      doc.text(title, x + 5, y + 8);

      doc.setFontSize(16);
      doc.setTextColor(headerText);
      doc.text(value, x + 5, y + 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(textColor);
      doc.text(subtitle, x + 5, y + 25);
    };

    const drawSectionCard = (x: number, y: number, width: number, height: number, title: string) => {
      doc.setFillColor(cardBackground);
      doc.roundedRect(x, y, width, height, 4, 4, 'F');
      doc.setDrawColor('#e5e7eb');
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, width, height, 4, 4, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(titleColor);
      doc.text(title, x + 6, y + 9);
    };

    const chartWidth = this.pageWidth - this.margin * 2;
    const chartHeight = 68;
    const chartX = this.margin;
    let y = 18;

    reportHeader();
    y += 28 + 8;

    const kpiX = this.margin;
    const kpiW = (this.pageWidth - this.margin * 2 - 12) / 4;
    const kpiY = y;
    drawKpiCard(kpiX, kpiY, 'Counter', this.formatNumber(payload.totalCounter), 'Total counter', 0);
    drawKpiCard(kpiX + kpiW + 4, kpiY, 'Total Expense', this.formatCurrency(payload.totalExpense), 'Total expense', 1);
    drawKpiCard(kpiX + (kpiW + 4) * 2, kpiY, 'Transactions', this.formatNumber(payload.topTransactions.length), 'Total transactions', 2);
    drawKpiCard(kpiX + (kpiW + 4) * 3, kpiY, 'Categories Used', this.formatNumber(payload.categorySummary.length), 'Active categories', 3);
    y += 30 + 10;

    drawSectionCard(chartX, y, chartWidth, chartHeight + 10, 'Trend Overview');
    if (payload.trendChartImage) {
      doc.addImage(payload.trendChartImage, 'JPEG', chartX + 4, y + 11, chartWidth - 8, chartHeight);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textColor);
    doc.text('Counter', chartX + chartWidth - 40, y + 10, { align: 'left' });
    doc.setTextColor('#2563eb');
    doc.circle(chartX + chartWidth - 47, y + 7, 1.5, 'F');
    doc.setTextColor(textColor);
    doc.text('Expense', chartX + chartWidth - 22, y + 10, { align: 'left' });
    doc.setTextColor('#ea580c');
    doc.circle(chartX + chartWidth - 29, y + 7, 1.5, 'F');
    doc.setTextColor(textColor);
    doc.text('In Hand', chartX + chartWidth - 9, y + 10, { align: 'left' });
    doc.setTextColor('#16a34a');
    doc.circle(chartX + chartWidth - 16, y + 7, 1.5, 'F');

    y += chartHeight + 10 + 12;

    const cardW = (chartWidth - 8) / 3;
    const summaryY = y;
    drawSectionCard(chartX, summaryY, cardW, 55, 'Summary');
    drawSectionCard(chartX + cardW + 4, summaryY, cardW, 55, 'Category Breakdown');
    drawSectionCard(chartX + (cardW + 4) * 2, summaryY, cardW, 55, 'Top Transactions');

    const innerY = summaryY + 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textColor);

    const summaryX = chartX + 6;
    doc.text('Opening In Hand', summaryX, innerY);
    doc.setFont('helvetica', 'bold');
    doc.text(this.formatCurrency(payload.openingInHand), summaryX, innerY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Counter', summaryX, innerY + 13);
    doc.setFont('helvetica', 'bold');
    doc.text(this.formatNumber(payload.totalCounter), summaryX, innerY + 18);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Expense', summaryX, innerY + 26);
    doc.setFont('helvetica', 'bold');
    doc.text(this.formatCurrency(payload.totalExpense), summaryX, innerY + 31);
    doc.setFont('helvetica', 'normal');
    doc.text('Closing In Hand', summaryX, innerY + 39);
    doc.setFont('helvetica', 'bold');
    doc.text(this.formatCurrency(payload.closingInHand), summaryX, innerY + 44);

    const categoryX = chartX + cardW + 10;
    let categoryRow = innerY;
    payload.categorySummary.slice(0, 4).forEach((item) => {
      doc.setFillColor(item.color);
      doc.circle(categoryX + 3.5, categoryRow - 2, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(titleColor);
      doc.setFontSize(9);
      doc.text(item.category, categoryX + 8, categoryRow);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
      doc.text(`${this.formatCurrency(item.amount)} • ${item.percentage}%`, categoryX + 8, categoryRow + 5);
      categoryRow += 12;
    });

    const transactionsX = chartX + (cardW + 4) * 2 + 6;
    const txStartY = innerY;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(titleColor);
    doc.text('Date', transactionsX, txStartY);
    doc.text('Amount', transactionsX + 32, txStartY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    payload.topTransactions.slice(0, 4).forEach((txn, index) => {
      const offset = txStartY + 6 + index * 8;
      doc.setTextColor(textColor);
      doc.text(txn.date, transactionsX, offset);
      doc.text(this.formatCurrency(txn.amount), transactionsX + 32, offset, { align: 'right' });
      doc.setFontSize(7.5);
      doc.setTextColor('#6b7280');
      doc.text(txn.title, transactionsX, offset + 4);
      doc.setFontSize(8);
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    doc.addPage();
    reportHeader();
    y = 28;

    doc.setFontSize(10);
    doc.setTextColor(titleColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Date Wise Summary Report', this.margin, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Counter', 'Expense', 'Running In Hand', 'Notes']],
      body: payload.dateWiseSummary.map((row) => [row.date, this.formatCurrency(row.counter), this.formatCurrency(row.expense), this.formatCurrency(row.runningInHand), row.notes]),
      theme: 'grid',
      styles: { fontSize: 9, textColor, cellPadding: 2 },
      headStyles: { fillColor: '#f1f5f9', textColor: titleColor, fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { cellWidth: 'auto' },
      },
      margin: { left: this.margin, right: this.margin },
      didDrawPage: () => {
        // Footer pagination is handled after table rendering.
      },
    });

    doc.addPage();
    reportHeader();
    y = 28;
    doc.setFontSize(10);
    doc.setTextColor(titleColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Date Wise Detailed Report', this.margin, y);
    y += 6;

    payload.detailedRecords.forEach((record, index) => {
      if (y > this.pageHeight - 60) {
        doc.addPage();
        reportHeader();
        y = 28;
      }

      doc.setFontSize(9);
      doc.setTextColor(titleColor);
      doc.setFont('helvetica', 'bold');
      doc.text(record.date, this.margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
      doc.setFontSize(9);
      doc.text(`Previous In Hand: ${this.formatCurrency(record.previousInHand)}`, this.margin, y);
      y += 4;
      doc.text(`Counter: ${this.formatCurrency(record.counter)}`, this.margin, y);
      y += 4;
      doc.text(`Total Expense: ${this.formatCurrency(record.totalExpense)}`, this.margin, y);
      y += 4;
      doc.text(`Closing In Hand: ${this.formatCurrency(record.closingInHand)}`, this.margin, y);
      y += 6;

      if (record.expenses.length) {
        autoTable(doc, {
          startY: y,
          head: [['Description', 'Category', 'Amount', 'Time', 'Notes']],
          body: record.expenses.map((expense) => [expense.description, expense.category, this.formatCurrency(expense.amount), expense.time, expense.notes]),
          theme: 'grid',
          styles: { fontSize: 8.5, textColor, cellPadding: 2 },
          headStyles: { fillColor: '#f1f5f9', textColor: titleColor, fontStyle: 'bold' },
          columnStyles: {
            2: { halign: 'right' },
          },
          margin: { left: this.margin, right: this.margin },
          didDrawPage: (data) => {
            if (data.cursor) {
              y = data.cursor.y + 4;
            }
          },
        });
      } else {
        doc.setFontSize(9);
        doc.text('No Expenses', this.margin, y);
        y += 8;
      }
    });

    const totalPagesFinal = doc.getNumberOfPages();
    for (let i = 1; i <= totalPagesFinal; i++) {
      doc.setPage(i);
      addFooter(i, totalPagesFinal);
    }

    doc.save(payload.fileName);
  }

  private drawCategoryList(doc: jsPDF, categories: PdfReportPayload['categorySummary'], x: number, y: number) {
    categories.forEach((item, index) => {
      const blockHeight = 8;
      const yPos = y + index * (blockHeight + 2);
      doc.setFillColor(item.color);
      doc.rect(x, yPos - 4, 4, blockHeight, 'F');
      doc.setFontSize(9);
      doc.setTextColor('#0f172a');
      doc.text(`${item.category} (${item.percentage}%)`, x + 8, yPos + 2);
      doc.setTextColor('#475569');
      doc.text(this.formatCurrency(item.amount), this.pageWidth - this.margin, yPos + 2, { align: 'right' });
    });
  }

  private estimateTotalPages(rows: number): number {
    return Math.max(4, Math.ceil(rows / 25) + 2);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(value);
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
      trendChartImage: payload.trendChartImage,
    };
  }
}
