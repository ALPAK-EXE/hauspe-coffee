import WhatsAppPreview from './WhatsAppPreview'
import { REMINDER_DAYS, daysUntil, fmtDay, isDue, pauseSub, pushChat, reminderText, updateSub } from '../data/subs'

// Recordatorio predictivo de WhatsApp: se calcula a partir de la próxima entrega de la suscripción
export default function ReminderChat({ sub, onChange, interactive = true }) {
  const due = isDue(sub)
  const days = daysUntil(sub.nextDelivery)
  const stored = sub.chat || []
  const preview = !stored.length && !due
  const messages = stored.length ? stored : [{ from: 'bot', text: reminderText(sub, due ? days : REMINDER_DAYS) }]
  const canReply = interactive && !preview && sub.status === 'active' && !sub.replied

  const reply = (text, answer, after) => () => {
    const intro = stored.length ? [] : [{ from: 'bot', text: messages[0].text }]
    pushChat(sub.id, [...intro, { from: 'user', text }, { from: 'bot', text: answer }])
    updateSub(sub.id, { replied: true })
    after?.()
    onChange?.()
  }

  const actions = canReply
    ? [
        { label: 'Sí, enviar', onClick: reply('Sí, envíalo', `Perfecto. Tu entrega sale el ${fmtDay(sub.nextDelivery)}.`) },
        { label: 'Pausar', onClick: reply('Pausa mi suscripción', 'Listo, pausamos tu suscripción. Escríbenos cuando quieras reanudar.', () => pauseSub(sub.id)) },
      ]
    : []

  const note = preview
    ? `Vista previa: así llegará el aviso ${REMINDER_DAYS} días antes de tu entrega del ${fmtDay(sub.nextDelivery)}.`
    : undefined

  return <WhatsAppPreview messages={messages} actions={actions} note={note} />
}
