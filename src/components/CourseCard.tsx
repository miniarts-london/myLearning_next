import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { fileUrl } from '@/lib/files';
import styles from '@/css/CourseCard.module.css';
import { ProgressBar } from './ProgressBar';

interface Props {
  id: number;
  name: string;
  image?: string;
  progress?: number | null;
}

export function CourseCard({ id, name, image, progress }: Props) {
  const hasProgress = typeof progress === 'number';
  const titleClass = image ? styles.titleOverImage : hasProgress ? styles.titleAboveProgress : styles.title;
  return (
    <Card component="article" className={styles.card}>
      {/* The link holds just the image and title, so its accessible name is the course name. */}
      <CardActionArea href={`/courses/${id}`}>
        {image && <CardMedia component="img" image={fileUrl(image)} alt="" loading="lazy" className={styles.image} />}
        <CardContent className={titleClass}>
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
