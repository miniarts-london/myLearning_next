import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { LoginForm } from '@/app/login/LoginForm';
import styles from '@/css/Login.module.css';

// `demo`: the "Or try a demo" buttons, when the page has any (streamed in after the form).
export function LoginScreen({ demo }: { demo?: React.ReactNode }) {
  return (
    <Box component="main" className={styles.page}>
      <Paper component="section" aria-labelledby="login-title" elevation={0} className={styles.card}>
        <Typography id="login-title" variant="h1" className={styles.title}>
          <Typography component="span" className={styles.welcome}>Welcome to</Typography>
          MyLearning
        </Typography>
        <LoginForm />
        {demo}
        <Typography variant="body2" className={styles.hint}>
          Use your Moodle username and password.
        </Typography>
      </Paper>
    </Box>
  );
}
