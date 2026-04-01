export default function StatsComparativa({ stats }) {
  if (!stats || stats.length === 0)
    return <p className="sc-empty">Sin datos suficientes para comparar.</p>;

  const cols = [
    { key: 'operario',            label: 'Operario' },
    { key: 'totalRegistros',      label: 'Registros',       fmt: v => v },
    { key: 'totalQQ',             label: 'Total QQ',        fmt: v => v?.toFixed(1) },
    { key: 'totalTandas',         label: 'Total Tandas',    fmt: v => v },
    { key: 'promedioRendimiento', label: 'Rend. prom.',     fmt: v => `${((v ?? 0) * 100).toFixed(1)}%` },
    { key: 'promedioVelocidad',   label: 'Vel. prom.',      fmt: v => `${(v ?? 0).toFixed(1)} qq/h` },
  ];

  // Color del mejor valor por columna numérica
  function mejor(key) {
    const vals = stats.map(s => s[key] ?? 0);
    return Math.max(...vals);
  }

  return (
    <div className="sc-wrap">
      <table className="sc-table">
        <thead>
          <tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.operarioId}>
              {cols.map(c => {
                const val = s[c.key];
                const isName = c.key === 'operario';
                const isBest = !isName && val === mejor(c.key) && val > 0;
                return (
                  <td key={c.key} className={isBest ? 'best' : ''}>
                    {isName
                      ? <span className="sc-nombre">{val}</span>
                      : (c.fmt ? c.fmt(val) : val)
                    }
                    {isBest && <span className="sc-star">★</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .sc-empty { color: var(--text-secondary); font-size: 14px; text-align: center; padding: 20px; }
        .sc-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .sc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sc-table th {
          padding: 10px 14px; text-align: left;
          font-size: 12px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .sc-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .sc-table tr:last-child td { border-bottom: none; }
        .sc-table tr:hover td { background: rgba(255,255,255,0.02); }
        .sc-nombre { font-weight: 700; color: var(--accent-purple); }
        .best { color: var(--accent-green); font-weight: 700; }
        .sc-star { margin-left: 4px; font-size: 12px; }
      `}</style>
    </div>
  );
}
