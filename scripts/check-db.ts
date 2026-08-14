import { db } from '../src/lib/db';

async function main() {
  const products = await db.product.findMany({ select: { name: true, currentQuantity: true, status: true, barcode: true, sku: true } });
  console.log('Products:', JSON.stringify(products, null, 2));
  const pm = await db.paymentMethod.findMany();
  console.log('PaymentMethods:', JSON.stringify(pm, null, 2));
  const sales = await db.sale.findMany({ select: { id: true, transactionNumber: true, total: true, status: true, paymentMethod: true } });
  console.log('Sales:', JSON.stringify(sales, null, 2));
  await db.$disconnect();
}
main();
