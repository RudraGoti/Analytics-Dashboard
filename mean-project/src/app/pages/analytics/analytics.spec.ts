import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { Analytics } from './analytics';

describe('Analytics', () => {
  let component: Analytics;
  let fixture: ComponentFixture<Analytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Analytics, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(Analytics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate totals and category breakdown from expense records', () => {
    const records = [
      {
        date: '2024-05-01',
        expenses: [
          { amount: 100, status: 'Paid', category: 'Food' },
          { amount: 200, status: 'Pending', category: 'Travel' }
        ]
      },
      {
        date: '2024-05-02',
        expenses: [
          { amount: 300, status: 'Paid', category: 'Food' },
          { amount: 50, status: 'Paid', category: 'Bills' }
        ]
      }
    ];

    const summary = component.calculateAnalytics(records);

    expect(summary.totalExpenses).toBe(650);
    expect(summary.totalPaid).toBe(400);
    expect(summary.totalPending).toBe(200);
    expect(summary.totalEntries).toBe(4);
    expect(summary.categoryBreakdown[0].name).toBe('Food');
    expect(summary.categoryBreakdown[0].value).toBe(2);
    expect(summary.monthlyTrend[0].month).toBe('May 2024');
  });
});
