import { Invoice } from '../api/invoices'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const STATUS_LABELS: Record<string, string> = {
  QUEUE:    'В ожидании оплаты',
  PAYED:    'Оплачен',
  CANCELED: 'Отменён',
}

const SESSION_STATUS: Record<string, string> = {
  ACTIVE:   'Активен',
  FINISHED: 'Завершён',
  CANCELED: 'Отменён',
  QUEUE:    'Ожидание',
}

export function printInvoice(invoice: Invoice) {
  const sessionsRows = invoice.sessions.map(s => `
    <tr>
      <td>Устройство #${s.instance_id}</td>
      <td>${s.time} мин</td>
      <td>${SESSION_STATUS[s.status] ?? s.status}</td>
      <td>${s.serviced_by_name ?? '—'}</td>
      <td class="num">${s.price} AZN</td>
      <td class="num">${s.discount ? `-${s.discount * 10}%` : '—'}</td>
      <td class="num bold">${s.end_price} AZN</td>
    </tr>
  `).join('')

  const snackRows = invoice.snack_sales.map(s => `
    <tr>
      <td>${s.snack}</td>
      <td class="num">× ${s.quantity}</td>
      <td class="num">${s.price} AZN</td>
      <td class="num bold">${s.total} AZN</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Счёт #${invoice.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #111; padding: 32px; max-width: 640px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; letter-spacing: 2px; text-transform: uppercase; }
    .header p { font-size: 12px; color: #555; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-bottom: 20px; }
    .meta-item { font-size: 12px; }
    .meta-item span { display: block; color: #888; font-size: 11px; margin-bottom: 2px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-queue    { background: #fef3c7; color: #92400e; }
    .badge-payed    { background: #d1fae5; color: #065f46; }
    .badge-canceled { background: #f3f4f6; color: #6b7280; }
    section { margin-bottom: 20px; }
    section h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; color: #888; font-weight: 600; padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 6px 6px; font-size: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .num { text-align: right; }
    .bold { font-weight: 700; }
    .total-row { margin-top: 16px; border-top: 2px solid #111; padding-top: 12px; display: flex; justify-content: space-between; align-items: baseline; }
    .total-row .label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .total-row .amount { font-size: 22px; font-weight: 700; }
    .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px dashed #ddd; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎮 Phober VR</h1>
    <p>Счёт № ${invoice.id}</p>
  </div>

  <div class="meta">
    <div class="meta-item">
      <span>Клиент</span>
      ${invoice.customer ?? 'Quest (без имени)'}
    </div>
    <div class="meta-item">
      <span>Статус</span>
      <span class="badge badge-${invoice.status.toLowerCase()}">${STATUS_LABELS[invoice.status] ?? invoice.status}</span>
    </div>
    ${invoice.sessions[0] ? `
    <div class="meta-item">
      <span>Дата</span>
      ${fmtDate(invoice.sessions[0].created_at)}
    </div>` : ''}
    ${invoice.payment_method?.length ? `
    <div class="meta-item">
      <span>Способ оплаты</span>
      ${invoice.payment_method.join(', ')}
    </div>` : ''}
  </div>

  ${invoice.sessions.length ? `
  <section>
    <h2>Сеансы</h2>
    <table>
      <thead>
        <tr>
          <th>Устройство</th><th>Время</th><th>Статус</th><th>Сотрудник</th>
          <th class="num">Цена</th><th class="num">Скидка</th><th class="num">Итого</th>
        </tr>
      </thead>
      <tbody>${sessionsRows}</tbody>
    </table>
  </section>` : ''}

  ${invoice.snack_sales.length ? `
  <section>
    <h2>Снеки</h2>
    <table>
      <thead>
        <tr><th>Наименование</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Итого</th></tr>
      </thead>
      <tbody>${snackRows}</tbody>
    </table>
  </section>` : ''}

  <div class="total-row">
    <span class="label">Итого к оплате</span>
    <span class="amount">${invoice.total} AZN</span>
  </div>

  <div class="footer">Спасибо за посещение Phober VR!</div>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=700,height=800')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}
