import * as expenseService from "../services/expenseService.js";

// Validates and normalises the editable fields of an income or expense entry.
const parseTransaction = (body) => {
  const type = body.type;
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const amount = Number(body.amount);
  const date = String(body.date ?? "");
  if (!["income", "expense"].includes(type)) return { error: "Type must be income or expense" };
  if (!name) return { error: "Name is required" };
  if (name.length > 120 || description.length > 500) return { error: "Name or description is too long" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be greater than zero" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "A valid date is required" };
  return { value: { type, name, description, amount: Math.round(amount * 100) / 100, date } };
};

export const listTransactions = async (req, res) => {
  try {
    const data = await expenseService.listTransactions();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const { value, error } = parseTransaction(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const data = await expenseService.createTransaction(value, req.user);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const { value, error } = parseTransaction(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const data = await expenseService.updateTransaction(req.params.id, value, req.user);
    if (!data) return res.status(404).json({ success: false, message: "Entry not found" });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const deleted = await expenseService.deleteTransaction(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Entry not found" });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
