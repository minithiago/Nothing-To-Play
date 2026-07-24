import config from '../../../../config'
import type { Film } from '@/vf/utils'

export const FilmBackdrop = ({ film }: { film: Film }) => {
  return (
    <img
      src={`${config.backdropBaseUrl}${film.backdrop}`}
      alt=''
      className='h-auto w-full'
    />
  )
}
