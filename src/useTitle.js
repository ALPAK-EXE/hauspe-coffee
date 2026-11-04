import { useEffect } from 'react'

// Título de pestaña por página
export default function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | HausPe Coffee` : 'HausPe Coffee'
  }, [title])
}
