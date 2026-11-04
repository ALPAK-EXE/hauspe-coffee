import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { DownloadSimple } from '@phosphor-icons/react'

// QR real y escaneable. Se genera como PNG, que también sirve para la descarga.
export default function QrImage({ value, label, filename = 'qr', className = '', download = false }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#22372b', light: '#ffffff' },
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [value])

  return (
    <div className={`qr ${className}`}>
      {src ? <img src={src} alt={label} width="512" height="512" data-qr-value={value} /> : <div className="qr__ph" aria-hidden="true" />}
      {download && src && (
        <a className="btn btn--ghost btn--sm" href={src} download={`${filename}.png`}>
          <DownloadSimple size={16} /> Descargar PNG
        </a>
      )}
    </div>
  )
}
