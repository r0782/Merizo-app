import os
import google.generativeai as genai
from .prompts import SETTLEMENT_EXPLAIN_PROMPT, EXPLAIN_BALANCE_PROMPT

def minimize_transactions(balances: dict) -> list:
    debtors = sorted([(amt, name) for name, amt in balances.items() if amt < -0.01])
    creditors = sorted([(amt, name) for name, amt in balances.items() if amt > 0.01], reverse=True)
    transactions = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debt_amt, debtor = debtors[i]
        cred_amt, creditor = creditors[j]
        settle = min(-debt_amt, cred_amt)
        transactions.append({"from": debtor, "to": creditor, "amount": round(settle, 2)})
        debtors[i] = (debt_amt + settle, debtor)
        creditors[j] = (cred_amt - settle, creditor)
        if abs(debtors[i][0]) < 0.01: i += 1
        if abs(creditors[j][0]) < 0.01: j += 1
    return transactions
async def explain_settlement(transactions: list, currency: str, language: str = "en") -> str:
    model = genai.Client(api_key=os.environ.get("GEMINI_API_KEY","")).models
    tx_text = "\n".join([f"{t['from']} pays {t['to']}: {currency}{t['amount']}" for t in transactions])
    response = model.generate_content(SETTLEMENT_EXPLAIN_PROMPT.format(currency=currency, transactions=tx_text, language=language))
    return response.text
async def explain_balances(balances: dict, currency: str, language: str = "en") -> str:
    model = genai.Client(api_key=os.environ.get("GEMINI_API_KEY","")).models
    response = model.generate_content(EXPLAIN_BALANCE_PROMPT.format(currency=currency, balances=str(balances), language=language))
    return response.text
