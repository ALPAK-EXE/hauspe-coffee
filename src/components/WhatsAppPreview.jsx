// Vista previa de una conversación de WhatsApp simulada (no envía nada)
export default function WhatsAppPreview({ messages, actions = [], title = 'HausPe Coffee', note }) {
  return (
    <figure className="wa" aria-label={`Conversación de WhatsApp simulada con ${title}`}>
      <figcaption className="wa__head">
        <span className="wa__avatar" aria-hidden="true">h.</span>
        <span>
          <strong>{title}</strong>
          <small>WhatsApp, simulado</small>
        </span>
      </figcaption>
      <ol className="wa__body">
        {messages.map((m, i) => (
          <li key={i} className={`wa__msg wa__msg--${m.from}`}>
            {m.text}
            {m.at && (
              <time dateTime={new Date(m.at).toISOString()}>
                {new Date(m.at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </time>
            )}
          </li>
        ))}
      </ol>
      {actions.length > 0 && (
        <div className="wa__actions">
          {actions.map((a) => (
            <button key={a.label} type="button" className="btn btn--ghost btn--sm" onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {note && <p className="wa__note">{note}</p>}
    </figure>
  )
}
