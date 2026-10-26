import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { courseImageUrl } from '@/lib/files';
import styles from '@/css/CourseCard.module.css';
import { ProgressBar } from '../../progressCircle/ProgressBar';

interface Props {
  id: number;
  name: string;
  image?: string;
  progress?: number | null;
}

export function CourseCard({ id, name, image, progress }: Props) {
  const hasProgress = typeof progress === 'number';

  return (
    <Card component="article" className={styles.card}>
      {/* The link holds just the image and title, so its accessible name is the course name. */}
      <CardActionArea href={`/courses/${id}`}>
        {/* Every card has a picture: the course's own, or the default one (see lib/files.ts). */}
        <CardMedia component="img" image={courseImageUrl(image)} alt="" loading="lazy" className={styles.image} />
        <CardContent className={styles.titleOverImage}>
          <Typography variant="h3" component="h3">{name}</Typography>
        </CardContent>
      </CardActionArea>
      {hasProgress && (
        <CardContent className={styles.progress}>
          <ProgressBar value={progress} label={`${name} progress`} size={100} color="info" />
        </CardContent>
      )}
    </Card>
  );
}
