# backend/ai/settle.py
from collections import defaultdict

def minimize_transactions(balances: dict) -> list:
    """
    Greedy debt minimization algorithm.
    Input:  {"Alice": -200, "Bob": 100, "Charlie": 100}
    Output: [{"from": "Alice", "to": "Bob", "amount": 100}, ...]
    """
    debtors = sorted([(amt, name) for name, amt in balances.items() if amt < 0])
    creditors = sorted([(amt, name) for name, amt in balances.items() if amt > 0], reverse=True)
    
    transactions = []
    i, j = 0, 0
    
    while i < len(debtors) and j < len(creditors):
        debt_amt, debtor = debtors[i]
        cred_amt, creditor = creditors[j]
        
        settle = min(-debt_amt, cred_amt)
        transactions.append({
            "from": debtor,
            "to": creditor,
            "amount": round(settle, 2)
        })
        
        debtors[i] = (debt_amt + settle, debtor)
        creditors[j] = (cred_amt - settle, creditor)
        
        if abs(debtors[i][0]) < 0.01: i += 1
        if abs(creditors[j][0]) < 0.01: j += 1
    
    return transactions

async def explain_settlement(transactions: list, currency: str, language: str) -> str:
    import google.generativeai as genai
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    tx_text = "\n".join([f"{t['from']} pays {t['to']}: {currency}{t['amount']}" 
                          for t in transactions])
    
    prompt = f"""Explain this settlement plan in simple, friendly language (language: {language}).
Make it sound easy and clear, like talking to a friend.
Transactions:
{tx_text}

Keep it under 3 sentences. Use emojis."""
    
    response = model.generate_content(prompt)
    return response.text