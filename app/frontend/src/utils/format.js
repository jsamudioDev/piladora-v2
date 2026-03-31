const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function formatMoney(n) {
  const num = Number(n) || 0;
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatQQ(n) {
  const num = Number(n) || 0;
  return `${num % 1 === 0 ? num : num.toFixed(1)} qq`;
}
