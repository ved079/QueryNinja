// rowStatus (optional): per-row status string ('match' | 'diff' | 'missing' | 'extra')
// aligned with result.rows — anything other than 'match' gets highlighted.
// columnStatus (optional): per-column booleans — true marks a mismatched header.
export default function ResultsTable({ result, empty = 'No rows.', rowStatus, columnStatus }) {
  if (!result || !result.columns.length) return <p className="muted">{empty}</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {result.columns.map((c, i) => (
              <th key={c} className={columnStatus?.[i] ? 'cell-bad' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => {
            const status = rowStatus?.[i];
            return (
              <tr key={i} className={status && status !== 'match' ? `row-${status}` : undefined}>
                {row.map((cell, j) => (
                  <td key={j}>
                    {cell === null ? <span className="null">null</span> : String(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {result.rows.length === 0 && <p className="muted">{empty}</p>}
    </div>
  );
}
