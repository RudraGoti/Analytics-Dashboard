import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
	selector: 'app-add-expense',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './AddExpense.html',
	styleUrls: ['./AddExpense.css']
})
export class AddExpense {

	private http = inject(HttpClient);

	today = new Date();
	counter = 0;

	categoryOptions = [
		{ label: 'Github', icon: 'assets/github.png' },
		{ label: 'Instagram', icon: 'assets/instagram.png' },
		{ label: 'LinkedIn', icon: 'assets/linkedin.png' },
		{ label: 'Facebook', icon: 'assets/facebook.png' },
		{ label: 'Twitter', icon: 'assets/twitter.png' }
	];

	expenses = [
		{
			title: '',
			category: null,
			amount: 0,
			paymentStatus: 'Paid',
			paymentMode: 'Cash',
			open: false
		}
	];

	addExpense() {
		this.expenses.push({
			title: '',
			category: null,
			amount: 0,
			paymentStatus: 'Paid',
			paymentMode: 'Cash',
			open: false
		});
	}

	removeExpense(i: number) {
		this.expenses.splice(i, 1);
	}

	toggleDropdown(index: number) {
		this.expenses.forEach((e, i) => {
			e.open = i === index ? !e.open : false;
		});
	}

	selectCategory(index: number, item: any, event: Event) {
		event.stopPropagation();

		this.expenses[index].category = item;
		this.expenses[index].open = false;
	}

	totalExpense() {
		return this.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
	}

	saveAll() {
		const payload = {
			date: this.today,
			counter: this.counter,
			expenses: this.expenses
		};

		this.http.post('http://localhost:5000/api/expenses', payload)
			.subscribe({
				next: (res) => {
					console.log('Saved successfully', res);
					alert('Saved to MongoDB successfully!');
				},
				error: (err) => {
					console.error('Error saving data', err);
					alert('Failed to save data');
				}
			});
	}
}