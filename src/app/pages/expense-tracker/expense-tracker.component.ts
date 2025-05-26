import { Component } from '@angular/core';

interface Expense {
  description: string;
  amount: number;
  category: string;
  date: Date;
}

@Component({
  selector: 'app-expense-tracker',
  templateUrl: './expense-tracker.component.html',
  styleUrls: ['./expense-tracker.component.scss']
})
export class ExpenseTrackerComponent {
  expenses: Expense[] = [];
  description: string = '';
  amount: number | null = null;
  category: string = 'General';
  categories: string[] = ['Food', 'Travel', 'Utilities', 'Entertainment', 'General'];

  addExpense(): void {
    if (this.description && this.amount !== null && this.amount > 0) {
      this.expenses.push({
        description: this.description,
        amount: this.amount,
        category: this.category,
        date: new Date()
      });

      // Clear input fields
      this.description = '';
      this.amount = null;
      this.category = 'General';
    }
  }

  get total(): number {
    return this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }
}
