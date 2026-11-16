import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DateService } from '../../services/date.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DateService).setSingleDate('2025-03-10');
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.match((request) => request.url.endsWith('/expenses'))
      .forEach((request) => request.flush(request.request.params.has('date') ? null : []));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should create', () => expect(component).toBeTruthy());

  it('shows a friendly empty day with zero-valued KPIs', () => {
    expect(component.recordFound).toBe(false);
    expect(component.summary.counter).toBe(0);
    expect(component.summary.totalExpenses).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No entry for 10 March 2025');
    expect(fixture.nativeElement.textContent).toContain('Add entry for this date');
  });

  it('shows four summary cards without the categories-used card', () => {
    const summaryCards = fixture.nativeElement.querySelectorAll('.summary-grid .dash-card:not(.skeleton-card)');

    expect(summaryCards).toHaveLength(4);
    expect(fixture.nativeElement.textContent).not.toContain('Categories used');
    expect(fixture.nativeElement.textContent).not.toContain('Daily overview');
    expect(fixture.nativeElement.querySelector('.dashboard-heading')).toBeNull();
    expect(component.loadingCards).toHaveLength(4);
  });

  it('ignores a late response for the previously selected date', () => {
    const dateService = TestBed.inject(DateService);
    dateService.setSingleDate('2025-03-11');
    const previousDateRequests = http.match((request) => request.url.endsWith('/expenses'));

    dateService.setSingleDate('2025-03-12');
    const selectedDateRequests = http.match((request) => request.url.endsWith('/expenses'));
    selectedDateRequests.forEach((request) => {
      const { params } = request.request;
      if (params.get('date') === '2025-03-12') {
        request.flush({ counter: 200, expenses: [{ amount: 40, status: 'Paid' }] });
      } else if (params.has('date')) {
        request.flush({ counter: 100, expenses: [] });
      } else {
        request.flush([]);
      }
    });

    previousDateRequests.forEach((request) => {
      if (request.request.params.has('date')) {
        request.flush({ counter: 500, expenses: [] });
      } else {
        request.flush([]);
      }
    });
    fixture.detectChanges();

    expect(component.selectedDate).toBe('2025-03-12');
    expect(component.summary.counter).toBe(200);
  });
});
