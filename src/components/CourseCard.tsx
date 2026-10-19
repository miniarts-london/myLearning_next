import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { fileUrl } from '@/lib/files';
import { ProgressBar } from './ProgressBar';

interface Props {
  id: number;
  name: string;
  image?: string;
  progress?: number | null;
}

export function CourseCard({ id, name, image, progress }: Props) {
  return (
    <Card component="article"
      sx={{ transition: 'transform .25s, box-shadow .25s', '&:hover, &:focus-within': { transform: 'translateY(-.25rem)', boxShadow: '0 1rem 2rem rgba(0, 0, 0, .12)' } }}>
      {/* The link holds just the image and title, so its accessible name is the course name. */}
      <CardActionArea href={`/courses/${id}`}>
        {image && (
          <CardMedia component="img" image={fileUrl(image)} alt="" loading="lazy"
            sx={{ aspectRatio: '16 / 9', objectFit: 'cover', bgcolor: 'grey.100' }} />
        )}
        <CardContent sx={{ pb: typeof progress === 'number' ? 0 : 2 }}>
          <Typography variant="h3" component="h3">{name}</Typography>
        </CardContent>
      </CardActionArea>
      {typeof progress === 'number' && (
        <CardContent sx={{ pt: 0 }}>
          <ProgressBar value={progress} label={`${name} progress`} />
        </CardContent>
      )}
    </Card>
  );
}
