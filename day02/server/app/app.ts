import express,{type Application} from 'express';
import * as dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.ts';
import userRoutes from './routes/user.routes.ts';
import errorHandler from './middleware/error.middleware.ts';
dotenv.config();

const app: Application = express();
app.use(express.json());
const port=process.env.PORT;


app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use(errorHandler);


export default app;