import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Panel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/panel')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!data)  return <p>Cargando...</p>;

  return (
    <div>
      <h1>Panel</h1>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <StatCard titulo="Ventas hoy"  valor={`$${data.ventasHoy.total.toFixed(2)}`} />
        <StatCard titulo="Ingresos"    valor={`$${data.balance.ingresos.toFixed(2)}`} />
        <StatCard titulo="Egresos"     valor={`$${data.balance.egresos.toFixed(2)}`} />
        <StatCard titulo="Stock bajo"  valor={data.stockBajoCount} />
      </div>
    </div>
  );
}

function StatCard({ titulo, valor }) {
  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: 8, minWidth: 120 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{titulo}</p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>{valor}</p>
    </div>
  );
}
