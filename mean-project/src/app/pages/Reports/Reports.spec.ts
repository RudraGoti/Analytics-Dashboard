import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Reports } from './Reports';

describe('Reports', () => {
  let component: Reports;
  let fixture: ComponentFixture<Reports>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Reports);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/expenses') && request.params.has('dateFrom')).flush([]);
    http.expectOne((request) => request.url.endsWith('/expenses/balance')).flush({
      before: component.range.from, totalCounter: 0, totalExpenses: 0, balance: 0,
    });
  });

  afterEach(() => http.verify());

  it('should create', () => expect(component).toBeTruthy());
});
