// [hardware] [all tenants]
// One-time "load sample data" generator — lets a hardware-shop owner populate
// their own shop with ~1 year of realistic demo data to explore/demo the app.
import { getDb, uuid } from './index';

function pad(n: number, len = 2) { return String(n).padStart(len, '0'); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtDateTime(d: Date) {
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randFloat(a: number, b: number) { return Math.random() * (b - a) + a; }
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

async function batchInsert(db: any, sql: string, rowsOfValues: any[][], colsPerRow: number, batchSize = 150) {
  for (let i = 0; i < rowsOfValues.length; i += batchSize) {
    const chunk = rowsOfValues.slice(i, i + batchSize);
    const placeholders = chunk.map(() => `(${Array(colsPerRow).fill('?').join(',')})`).join(',');
    const flat = chunk.flat();
    await db.execute(`${sql} VALUES ${placeholders}`, flat);
  }
}

const PRODUCT_DEFS: [string, string, string, string, string, number, number, number, string][] = [
  ['Tractor Emulsion White', 'Paints', 'Asian Paints', 'litre', '1L', 180, 240, 18, '3209'],
  ['Tractor Emulsion White', 'Paints', 'Asian Paints', 'litre', '4L', 650, 850, 18, '3209'],
  ['Tractor Emulsion White', 'Paints', 'Asian Paints', 'litre', '20L', 2900, 3650, 18, '3209'],
  ['Apex Weatherproof Exterior', 'Paints', 'Asian Paints', 'litre', '4L', 1450, 1850, 18, '3209'],
  ['Apex Weatherproof Exterior', 'Paints', 'Asian Paints', 'litre', '20L', 6800, 8400, 18, '3209'],
  ['Easy Clean Interior Emulsion', 'Paints', 'Berger', 'litre', '1L', 210, 270, 18, '3209'],
  ['Easy Clean Interior Emulsion', 'Paints', 'Berger', 'litre', '10L', 1900, 2400, 18, '3209'],
  ['WeatherCoat Exterior Paint', 'Paints', 'Berger', 'litre', '20L', 6200, 7600, 18, '3209'],
  ['Impressions Wall Putty', 'Paints', 'JK Cement', 'kg', '20kg', 480, 620, 18, '3214'],
  ['Birla Wall Putty', 'Paints', 'Birla', 'kg', '40kg', 850, 1080, 18, '3214'],
  ['Excel Anti-Peel Emulsion', 'Paints', 'Nerolac', 'litre', '4L', 700, 900, 18, '3209'],
  ['Synthetic Enamel Paint Red', 'Paints', 'Nerolac', 'litre', '1L', 260, 330, 18, '3208'],
  ['Synthetic Enamel Paint Black', 'Paints', 'Nerolac', 'litre', '1L', 260, 330, 18, '3208'],
  ['Primer White', 'Paints', 'Asian Paints', 'litre', '4L', 520, 680, 18, '3208'],
  ['Distemper Premium', 'Paints', 'JK Cement', 'kg', '5kg', 320, 420, 18, '3210'],
  ['Claw Hammer 500g', 'Hand Tools', 'Stanley', 'piece', '', 220, 320, 18, '8205'],
  ['Screwdriver Set 6pc', 'Hand Tools', 'Taparia', 'set', '', 280, 420, 18, '8205'],
  ['Combination Plier 8inch', 'Hand Tools', 'Taparia', 'piece', '', 180, 280, 18, '8203'],
  ['Adjustable Wrench 10inch', 'Hand Tools', 'Stanley', 'piece', '', 260, 380, 18, '8204'],
  ['Measuring Tape 5m', 'Hand Tools', 'Freemans', 'piece', '', 90, 150, 18, '9017'],
  ['Hacksaw Frame with Blade', 'Hand Tools', 'Stanley', 'piece', '', 130, 210, 18, '8202'],
  ['Spirit Level 24inch', 'Hand Tools', 'Taparia', 'piece', '', 320, 460, 18, '9015'],
  ['Wheelbarrow Heavy Duty', 'Hand Tools', 'Local', 'piece', '', 1800, 2400, 18, '8716'],
  ['Impact Drill Machine 13mm', 'Power Tools', 'Bosch', 'piece', '', 2600, 3400, 18, '8467'],
  ['Angle Grinder 4inch', 'Power Tools', 'Bosch', 'piece', '', 1900, 2500, 18, '8467'],
  ['Jigsaw Machine', 'Power Tools', 'Black & Decker', 'piece', '', 3200, 4100, 18, '8467'],
  ['Cut-off Wheel 4inch (Pack of 5)', 'Power Tools', 'Bosch', 'pack', '', 220, 320, 18, '6804'],
  ['PVC Pipe 1inch (3m)', 'Plumbing', 'Supreme', 'piece', '', 180, 250, 18, '3917'],
  ['PVC Pipe 2inch (3m)', 'Plumbing', 'Supreme', 'piece', '', 340, 460, 18, '3917'],
  ['CPVC Pipe 0.75inch (3m)', 'Plumbing', 'Astral', 'piece', '', 260, 360, 18, '3917'],
  ['Brass Bib Cock', 'Plumbing', 'Jaquar', 'piece', '', 260, 380, 18, '8481'],
  ['Pillar Cock Chrome', 'Plumbing', 'Jaquar', 'piece', '', 480, 680, 18, '8481'],
  ['PTFE Tape (Pack of 10)', 'Plumbing', 'Local', 'pack', '', 60, 110, 18, '3919'],
  ['Gate Valve 1inch', 'Plumbing', 'Astral', 'piece', '', 320, 460, 18, '8481'],
  ['Overhead Tank Float Valve', 'Plumbing', 'Local', 'piece', '', 140, 220, 18, '8481'],
  ['Copper Wire 1.5sqmm (90m)', 'Electrical', 'Polycab', 'coil', '', 1450, 1850, 18, '8544'],
  ['Copper Wire 2.5sqmm (90m)', 'Electrical', 'Polycab', 'coil', '', 2200, 2750, 18, '8544'],
  ['Modular Switch 6A', 'Electrical', 'Anchor', 'piece', '', 35, 60, 18, '8536'],
  ['MCB 32A Single Pole', 'Electrical', 'Havells', 'piece', '', 140, 220, 18, '8536'],
  ['LED Bulb 9W', 'Electrical', 'Philips', 'piece', '', 60, 110, 18, '8539'],
  ['LED Tube Light 20W', 'Electrical', 'Philips', 'piece', '', 220, 340, 18, '8539'],
  ['Ceiling Fan 1200mm', 'Electrical', 'Havells', 'piece', '', 1450, 1950, 18, '8414'],
  ['Extension Board 4 Socket', 'Electrical', 'Anchor', 'piece', '', 220, 340, 18, '8536'],
  ['Wood Screws 1.5inch (Box 100)', 'Fasteners', 'Local', 'box', '', 90, 150, 12, '7318'],
  ['Concrete Nails 3inch (Kg)', 'Fasteners', 'Local', 'kg', '', 110, 170, 12, '7317'],
  ['Hex Bolt & Nut M8 (Box 50)', 'Fasteners', 'Local', 'box', '', 180, 280, 12, '7318'],
  ['Door Hinges 4inch (Pair)', 'Fasteners', 'Local', 'pair', '', 70, 120, 12, '8302'],
  ['Tower Bolt 8inch', 'Fasteners', 'Local', 'piece', '', 60, 100, 12, '8302'],
  ['Cabinet Handle Steel', 'Fasteners', 'Local', 'piece', '', 40, 80, 12, '8302'],
  ['Wash Basin White Wall-Hung', 'Sanitary', 'Hindware', 'piece', '', 1450, 1950, 18, '6910'],
  ['Floor Mounted Commode', 'Sanitary', 'Hindware', 'piece', '', 4200, 5400, 18, '6910'],
  ['Health Faucet Set', 'Sanitary', 'Jaquar', 'piece', '', 380, 540, 18, '8481'],
  ['Bathroom Mirror 18x24', 'Sanitary', 'Local', 'piece', '', 320, 480, 18, '7009'],
  ['Fevicol SR 998 (1kg)', 'Adhesives', 'Pidilite', 'piece', '', 240, 340, 18, '3506'],
  ['M-Seal Epoxy Putty', 'Adhesives', 'Pidilite', 'piece', '', 70, 120, 18, '3506'],
  ['Araldite Standard 90g', 'Adhesives', 'Huntsman', 'piece', '', 110, 180, 18, '3506'],
  ['Silicone Sealant White', 'Adhesives', 'Dr. Fixit', 'piece', '', 180, 270, 18, '3214'],
];

const STAFF_DEFS: [string, string, string, number][] = [
  ['Ramesh Verma', '9755512301', 'manager', 18000],
  ['Sunil Kumar', '9755512302', 'salesman', 12000],
  ['Anita Sahu', '9755512303', 'salesman', 11000],
  ['Deepak Yadav', '9755512304', 'helper', 8000],
  ['Pooja Tiwari', '9755512305', 'accountant', 14000],
];

const SUPPLIER_DEFS: [string, string, string, string][] = [
  ['Asian Paints Distributor — Durg', '9893300101', 'Industrial Area, Durg', '22ABCDE1111F1Z5'],
  ['Berger Paints C&F Bhilai', '9893300102', 'Hathkhoj, Bhilai', '22ABCDE2222F1Z5'],
  ['Polycab Electricals Wholesale', '9893300103', 'Power House Road, Bhilai', '22ABCDE3333F1Z5'],
  ['Taparia Tools Distributor CG', '9893300104', 'Station Road, Durg', '22ABCDE4444F1Z5'],
  ['Hindware Sanitary Agency', '9893300105', 'GE Road, Bhilai', '22ABCDE5555F1Z5'],
  ['Local Hardware Wholesale Mart', '9893300106', 'Indira Market, Durg', '22ABCDE6666F1Z5'],
];

const CREDIT_CUSTOMER_DEFS: [string, string, string][] = [
  ['Shree Construction Co.', '9826611001', 'Civil Lines, Durg'],
  ['Mahesh Building Contractors', '9826611002', 'Station Road, Durg'],
  ['Ganesh Plumbing Works', '9826611003', 'Padmanabhpur, Durg'],
  ['Royal Interiors', '9826611004', 'Supela, Bhilai'],
  ['Sai Electricals & Co.', '9826611005', 'Power House, Bhilai'],
  ['Krishna Tiles & Sanitary', '9826611006', 'Junwani Road, Bhilai'],
  ['New India Builders', '9826611007', 'Khursipar, Bhilai'],
  ['Om Sai Painters', '9826611008', 'Smriti Nagar, Bhilai'],
  ['Bhilai Steel Traders', '9826611009', 'Vaishali Nagar, Bhilai'],
  ['Patel Hardware Mart', '9826611010', 'Nehru Nagar, Bhilai'],
  ['Lakshmi Furniture Works', '9826611011', 'Risali, Bhilai'],
  ['Durg Civil Engineers', '9826611012', 'Indira Market, Durg'],
];

export interface DemoSeedProgress { stage: string; done: number; total: number; }

/**
 * Generates ~1 year of realistic demo data for a hardware/paint shop —
 * products, sales, staff, attendance, credit accounts, quotations, suppliers,
 * stock movements and salary records — so an owner can explore or demo the app.
 * Safe to run only once per tenant; aborts if hw_products already has rows.
 */
export async function seedHwDemoData(tenantId: string, onProgress?: (p: DemoSeedProgress) => void): Promise<{ skipped: boolean }> {
  const db = await getDb();

  const existing = await db.select<any[]>('SELECT COUNT(*) as c FROM hw_products WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
  if ((existing?.[0]?.c ?? 0) > 0) return { skipped: true };

  const report = (stage: string, done: number, total: number) => onProgress?.({ stage, done, total });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = addDays(today, -365);
  const stamp = fmtDateTime(today);

  // ── Suppliers ──────────────────────────────────────────────────────────
  report('Adding suppliers', 0, 1);
  const supplierIds = SUPPLIER_DEFS.map(() => uuid());
  await batchInsert(db,
    `INSERT INTO suppliers (id, tenant_id, name, phone, email, address, gstin, drug_license_no, notes, deleted_at, created_at, updated_at, total_payable, total_paid)`,
    SUPPLIER_DEFS.map(([name, phone, addr, gstin], i) => {
      const payable = Math.round(randFloat(8000, 60000) * 100) / 100;
      const paid = Math.round(payable * randFloat(0.4, 0.9) * 100) / 100;
      return [supplierIds[i], tenantId, name, phone, '', addr, gstin, '', '', null, fmtDateTime(start), stamp, payable, paid];
    }), 14);

  // ── Products ───────────────────────────────────────────────────────────
  report('Adding products', 0, PRODUCT_DEFS.length);
  const productIds = PRODUCT_DEFS.map(() => uuid());
  const products = PRODUCT_DEFS.map(([name, , , unit, , pp, sp, gst], i) => ({
    id: productIds[i], name, unit, purchasePrice: pp, sellingPrice: sp, gst,
  }));
  await batchInsert(db,
    `INSERT INTO hw_products (id, tenant_id, name, category, unit, brand, stock, min_stock, purchase_price, selling_price, updated_at, deleted_at, barcode, hsn_code, gst_rate, variant, supplier_id)`,
    PRODUCT_DEFS.map(([name, cat, brand, unit, variant, pp, sp, gst, hsn], i) => {
      const stock = randInt(15, 220);
      const minStock = Math.max(5, Math.floor(stock * randFloat(0.08, 0.2)));
      const barcode = `890${randInt(1000000000, 9999999999)}`;
      return [productIds[i], tenantId, name, cat, unit, brand, stock, minStock, pp, sp, stamp, null, barcode, hsn, gst, variant, pick(supplierIds)];
    }), 17);

  // ── Staff ──────────────────────────────────────────────────────────────
  report('Adding staff', 0, STAFF_DEFS.length);
  const staffIds = STAFF_DEFS.map(() => uuid());
  await batchInsert(db,
    `INSERT INTO hardware_staff (id, tenant_id, name, phone, role, is_active, monthly_salary, joining_date, deduct_half_day, deduct_full_day_leave, created_at, updated_at, deleted_at)`,
    STAFF_DEFS.map(([name, phone, role, salary], i) => {
      const joinDate = fmtDate(addDays(start, -randInt(30, 400)));
      return [staffIds[i], tenantId, name, phone, role, 1, salary, joinDate, 1, 0, fmtDateTime(start), stamp, null];
    }), 13);

  // ── Attendance (1 yr) ──────────────────────────────────────────────────
  const attendanceRows: any[][] = [];
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const isSunday = d.getDay() === 0;
    for (const sid of staffIds) {
      let status: string;
      const r = Math.random();
      if (isSunday) status = r < 0.7 ? 'absent' : 'present';
      else status = r < 0.86 ? 'present' : r < 0.94 ? 'half_day' : 'absent';
      attendanceRows.push([uuid(), tenantId, sid, fmtDate(d), status, null, fmtDateTime(d), null]);
    }
  }
  report('Recording attendance', 0, attendanceRows.length);
  await batchInsert(db,
    `INSERT OR IGNORE INTO hardware_attendance (id, tenant_id, staff_id, date, status, note, updated_at, deleted_at)`,
    attendanceRows, 8);

  // ── Salary payments + advances ─────────────────────────────────────────
  const salaryPaymentRows: any[][] = [];
  const salaryAdvanceRows: any[][] = [];
  const months: Date[] = [];
  for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= today; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    months.push(m);
  }
  for (const mdate of months.slice(0, -1)) {
    const monthStr = `${mdate.getFullYear()}-${pad(mdate.getMonth() + 1)}`;
    const payDate = addDays(mdate, 28 + randInt(1, 4));
    STAFF_DEFS.forEach(([, , , salary], i) => {
      const amountPaid = Math.round(salary * randFloat(0.92, 1.0) * 100) / 100;
      const method = pick(['cash', 'cash', 'upi', 'bank']);
      salaryPaymentRows.push([uuid(), tenantId, staffIds[i], monthStr, amountPaid, method, 'Monthly salary', fmtDateTime(payDate), fmtDateTime(payDate), null]);
      if (Math.random() < 0.25) {
        const advAmt = Math.round(salary * randFloat(0.1, 0.3) * 100) / 100;
        const advDate = addDays(mdate, randInt(2, 15));
        salaryAdvanceRows.push([uuid(), tenantId, staffIds[i], monthStr, advAmt, 'Advance against salary', fmtDateTime(advDate), fmtDateTime(advDate), fmtDateTime(advDate), null]);
      }
    });
  }
  report('Recording salary records', 0, salaryPaymentRows.length);
  await batchInsert(db,
    `INSERT INTO hardware_salary_payments (id, tenant_id, staff_id, month, amount_paid, payment_method, note, paid_at, updated_at, deleted_at)`,
    salaryPaymentRows, 10);
  await batchInsert(db,
    `INSERT INTO hardware_salary_advances (id, tenant_id, staff_id, month, amount, note, given_at, created_at, updated_at, deleted_at)`,
    salaryAdvanceRows, 10);

  // ── Credit accounts (created up front, balances computed after sales) ──
  const creditAccountIds = CREDIT_CUSTOMER_DEFS.map(() => uuid());
  const accountBalance = new Map<string, number>(creditAccountIds.map(id => [id, 0]));

  // ── Bill sequence ──────────────────────────────────────────────────────
  await db.execute(
    `INSERT OR IGNORE INTO bill_sequences (id, tenant_id, sequence_type, prefix, current_number) VALUES (?, ?, 'hardware', 'HW', 0)`,
    [uuid(), tenantId]
  );
  const seqRow = await db.select<any[]>(`SELECT current_number FROM bill_sequences WHERE tenant_id = ? AND sequence_type = 'hardware'`, [tenantId]);
  const startCounter = (seqRow?.[0]?.current_number ?? 0) + 1;

  // ── Sales + items + stock movements + credit debit txns ────────────────
  const PAYMENT_MODES = ['cash', 'cash', 'upi', 'upi', 'card', 'credit'];
  const WALKIN_NAMES = ['Walk-in Customer', 'Walk-in Customer', 'Walk-in Customer', 'Ravi Sharma', 'Anil Patel', 'Suresh Nair', 'Manoj Gupta', 'Vikas Singh'];
  const saleRows: any[][] = [];
  const saleItemRows: any[][] = [];
  const saleStockMoveRows: any[][] = [];
  const creditTxnRows: any[][] = [];
  let billSeq = 0;

  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const isSunday = d.getDay() === 0;
    const nBills = (isSunday && Math.random() < 0.55) ? 0 : randInt(3, 10);
    for (let b = 0; b < nBills; b++) {
      const saleId = uuid();
      const billNo = `HW${pad(startCounter + billSeq, 5)}`;
      billSeq++;
      const saleTime = new Date(d); saleTime.setHours(randInt(9, 20), randInt(0, 59), 0);
      const isBulk = Math.random() < 0.12;
      const nItems = isBulk ? randInt(2, 6) : randInt(1, 3);
      const chosen = sample(products, Math.min(nItems, products.length));

      let subtotal = 0, taxTotal = 0;
      const items: { p: typeof products[0]; qty: number; rate: number }[] = [];
      for (const p of chosen) {
        const qmax = isBulk ? randInt(4, 12) : randInt(1, 3);
        const qty = Math.max(1, Math.round(randFloat(1, qmax)));
        const rate = p.sellingPrice;
        const lineAmount = Math.round(qty * rate * 100) / 100;
        const lineTax = Math.round(lineAmount * p.gst / 100 * 100) / 100;
        subtotal += lineAmount;
        taxTotal += lineTax;
        items.push({ p, qty, rate });
        saleStockMoveRows.push([uuid(), tenantId, p.id, p.name, -qty, 'sale', 'sale', saleId, `Sold via bill ${billNo}`, fmtDateTime(saleTime), fmtDateTime(saleTime), null]);
      }
      const discount = Math.round(subtotal * pick([0, 0, 0, 0.02, 0.05]) * 100) / 100;
      const total = Math.round((subtotal - discount + taxTotal) * 100) / 100;
      const mode = pick(PAYMENT_MODES);
      let custName: string, custPhone: string, paid: number;
      if (mode === 'credit') {
        const idx = randInt(0, creditAccountIds.length - 1);
        const accId = creditAccountIds[idx];
        custName = CREDIT_CUSTOMER_DEFS[idx][0];
        custPhone = CREDIT_CUSTOMER_DEFS[idx][1];
        paid = 0;
        accountBalance.set(accId, (accountBalance.get(accId) ?? 0) + total);
        creditTxnRows.push([uuid(), tenantId, accId, 'debit', total, `Purchase - Bill ${billNo}`, fmtDate(d), fmtDateTime(saleTime), null, billNo]);
      } else {
        custName = pick(WALKIN_NAMES);
        custPhone = custName === 'Walk-in Customer' ? '' : `98${randInt(10000000, 99999999)}`;
        paid = total;
      }
      const staffId = pick(staffIds);
      saleRows.push([saleId, tenantId, billNo, custName, custPhone, total, paid, mode, fmtDate(d), fmtDateTime(saleTime), null,
        Math.round(subtotal * 100) / 100, discount, Math.round(taxTotal * 100) / 100, staffId]);
      for (const { p, qty, rate } of items) {
        const lineAmount = Math.round(qty * rate * 100) / 100;
        const lineTax = Math.round(lineAmount * p.gst / 100 * 100) / 100;
        saleItemRows.push([uuid(), tenantId, saleId, p.id, p.name, p.unit, qty, rate, Math.round((lineAmount + lineTax) * 100) / 100, fmtDateTime(saleTime), null, p.gst, 0]);
      }
    }
  }
  report('Recording sales', 0, saleRows.length);
  await batchInsert(db,
    `INSERT INTO hw_sales (id, tenant_id, bill_no, customer_name, customer_phone, total, paid, payment_mode, sale_date, updated_at, deleted_at, subtotal, discount, tax_total, staff_id)`,
    saleRows, 15);
  report('Recording sale items', 0, saleItemRows.length);
  await batchInsert(db,
    `INSERT INTO hw_sale_items (id, tenant_id, sale_id, product_id, product_name, unit, quantity, rate, amount, updated_at, deleted_at, gst_rate, discount)`,
    saleItemRows, 13);
  await db.execute(`UPDATE bill_sequences SET current_number = ?, updated_at = ? WHERE tenant_id = ? AND sequence_type = 'hardware'`,
    [startCounter + billSeq - 1, stamp, tenantId]);

  // ── Credit accounts + payments (now that balances are known) ───────────
  const accountRows: any[][] = [];
  CREDIT_CUSTOMER_DEFS.forEach(([name, phone, addr], i) => {
    const accId = creditAccountIds[i];
    let bal = accountBalance.get(accId) ?? 0;
    const nPayments = randInt(2, 6);
    for (let p = 0; p < nPayments; p++) {
      if (bal <= 500) break;
      const payAmt = Math.round(Math.min(bal, randFloat(1000, 8000)) * 100) / 100;
      bal -= payAmt;
      const payDate = addDays(start, randInt(10, 360));
      creditTxnRows.push([uuid(), tenantId, accId, 'credit', payAmt, 'Payment received', fmtDate(payDate), fmtDateTime(payDate), null, '']);
    }
    accountRows.push([accId, tenantId, name, phone, addr, Math.round(bal * 100) / 100, stamp, null]);
  });
  report('Adding credit accounts', 0, accountRows.length);
  await batchInsert(db,
    `INSERT INTO hw_credit_accounts (id, tenant_id, customer_name, phone, address, balance, updated_at, deleted_at)`,
    accountRows, 8);
  report('Recording credit transactions', 0, creditTxnRows.length);
  await batchInsert(db,
    `INSERT INTO hw_credit_transactions (id, tenant_id, account_id, type, amount, description, date, updated_at, deleted_at, reference_bill_no)`,
    creditTxnRows, 10);

  // ── Stock movements — monthly purchases (stock-in) ─────────────────────
  const purchaseRows: any[][] = [];
  for (let m = new Date(start); m <= today; m = addDays(m, 30)) {
    const nPurchases = randInt(6, 14);
    for (let i = 0; i < nPurchases; i++) {
      const p = pick(products);
      const qty = randInt(20, 120);
      const pdate = addDays(m, randInt(0, 27));
      if (pdate > today) continue;
      purchaseRows.push([uuid(), tenantId, p.id, p.name, qty, 'purchase', 'purchase', '', `Stock-in — Invoice #${randInt(10000, 99999)}`, fmtDateTime(pdate), fmtDateTime(pdate), null]);
    }
  }
  report('Recording stock movements', 0, purchaseRows.length + saleStockMoveRows.length);
  await batchInsert(db,
    `INSERT INTO hw_stock_movements (id, tenant_id, product_id, product_name, qty_delta, reason, reference_type, reference_id, note, created_at, updated_at, deleted_at)`,
    purchaseRows, 12);
  await batchInsert(db,
    `INSERT INTO hw_stock_movements (id, tenant_id, product_id, product_name, qty_delta, reason, reference_type, reference_id, note, created_at, updated_at, deleted_at)`,
    saleStockMoveRows, 12);

  // ── Quotations ─────────────────────────────────────────────────────────
  const quoteCustomers = CREDIT_CUSTOMER_DEFS.slice(0, 8);
  const quoteRows: any[][] = [];
  const quoteItemRows: any[][] = [];
  for (let q = 0; q < 28; q++) {
    const qdate = addDays(start, randInt(0, 360));
    const qId = uuid();
    const quoteNo = `QT${pad(q + 1, 4)}`;
    const cust = pick(quoteCustomers);
    const chosen = sample(products, randInt(2, 6));
    let subtotal = 0, taxTotal = 0;
    const items: { p: typeof products[0]; qty: number; rate: number }[] = [];
    for (const p of chosen) {
      const qty = randInt(2, 25);
      const amount = Math.round(qty * p.sellingPrice * 100) / 100;
      const lineTax = Math.round(amount * p.gst / 100 * 100) / 100;
      subtotal += amount;
      taxTotal += lineTax;
      items.push({ p, qty, rate: p.sellingPrice });
    }
    const discount = Math.round(subtotal * pick([0, 0.03, 0.05, 0.08]) * 100) / 100;
    const total = Math.round((subtotal - discount + taxTotal) * 100) / 100;
    const validUntil = fmtDate(addDays(qdate, 15));
    const status = weightedPick(['draft', 'sent', 'accepted', 'expired', 'converted'], [1, 2, 3, 2, 3]);
    quoteRows.push([qId, tenantId, quoteNo, cust[0], cust[1], Math.round(subtotal * 100) / 100, discount, Math.round(taxTotal * 100) / 100, total, validUntil, status, '', fmtDateTime(qdate), fmtDateTime(qdate), null]);
    for (const { p, qty, rate } of items) {
      const amount = Math.round(qty * rate * 100) / 100;
      quoteItemRows.push([uuid(), tenantId, qId, p.id, p.name, p.unit, qty, rate, p.gst, 0, amount, fmtDateTime(qdate), null]);
    }
  }
  report('Adding quotations', 0, quoteRows.length);
  await batchInsert(db,
    `INSERT INTO hw_quotations (id, tenant_id, quote_no, customer_name, customer_phone, subtotal, discount, tax_total, total, valid_until, status, notes, created_at, updated_at, deleted_at)`,
    quoteRows, 15);
  await batchInsert(db,
    `INSERT INTO hw_quotation_items (id, tenant_id, quotation_id, product_id, product_name, unit, quantity, rate, gst_rate, discount, amount, updated_at, deleted_at)`,
    quoteItemRows, 13);

  report('Done', 1, 1);
  return { skipped: false };
}
