import { one, query } from '../db/pool';

export const gstInvoice = {
  async generate(orgId: string, opts: { contactId: string; amount: number; taxPct?: number; description?: string; paymentId?: string }) {
    const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [orgId]);
    const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1`, [opts.contactId]);
    if (!org || !contact) throw new Error('Org or contact not found');

    const taxPct = opts.taxPct ?? Number(org.default_tax_pct) ?? 18;
    const taxAmount = (opts.amount * taxPct) / 100;
    const total = opts.amount + taxAmount;

    // Next invoice number
    const last = await one<{ invoice_number: string }>(
      `SELECT invoice_number FROM gst_invoices WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    const prefix = org.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    const seq = last?.invoice_number?.match(/(\d+)$/)?.[1];
    const next = String(Number(seq || 0) + 1).padStart(5, '0');
    const invoiceNumber = `${prefix}/${year}/${next}`;

    const invoiceData = {
      orgName: org.name,
      orgGstin: org.gstin,
      customerName: contact.name,
      customerPhone: contact.phone,
      customerEmail: contact.email,
      description: opts.description || 'Professional services',
      taxPct,
      taxAmount,
      total,
      generatedAt: new Date().toISOString(),
    };

    return await one(
      `INSERT INTO gst_invoices (org_id, invoice_number, contact_id, payment_id, amount, tax_pct, tax_amount, total, gstin, status, invoice_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10::jsonb) RETURNING *`,
      [orgId, invoiceNumber, opts.contactId, opts.paymentId || null, opts.amount, taxPct, taxAmount, total, org.gstin || null, JSON.stringify(invoiceData)]
    );
  },
};
