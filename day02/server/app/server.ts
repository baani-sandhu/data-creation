import app from './app.ts';
import dotenv from 'dotenv';
dotenv.config();
const PORT = process.env.PORT

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
