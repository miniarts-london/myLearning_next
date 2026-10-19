import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { LoginForm } from '@/app/login/LoginForm';

export function LoginScreen() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'grey.100', px: 2, py: 4 }}>
      <Paper component="section" aria-labelledby="login-title" elevation={0} sx={{ width: '100%', maxWidth: '26rem', p: { xs: 3, sm: 5 } }}>
        <Typography id="login-title" variant="h1" sx={{ mb: 4 }}>
          <Typography component="span" sx={{ display: 'block', color: 'text.primary' }}>Welcome to</Typography>
          MyLearning
        </Typography>
        <LoginForm />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Use your Moodle username and password.
        </Typography>
      </Paper>
    </Box>
  );
}
