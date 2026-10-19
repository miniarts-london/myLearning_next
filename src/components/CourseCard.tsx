import Link from 'next/link';
import { fileUrl } from '@/lib/files';
import { ProgressBar } from './ProgressBar';

interface Props {
  id: number;
  name: string;
  image?: string;
  progress?: number | null;
  meta?: string;
}

export function CourseCard({ id, name, image, progress, meta }: Props) {
  return (
    <article className="card">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- Moodle images go through /api/file, not next/image.
        <img className="card__image" src={fileUrl(image)} alt="" loading="lazy" />
      )}
      <div className="card__body">
        {meta && <p className="card__meta">{meta}</p>}
        <h3 className="card__title">
          <Link href={`/courses/${id}`} className="card__link">{name}</Link>
        </h3>
        {typeof progress === 'number' && <ProgressBar value={progress} label={`${name} progress`} />}
      </div>
    </article>
  );
}
