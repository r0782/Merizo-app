-- Adds an optional free-text notes field to expenses, set from the
-- AddExpenseSheet "Notes" field in frontend/app/split/[id].tsx and shown
-- under the expense row in LedgerTab.

alter table expenses
  add column if not exists notes text;
