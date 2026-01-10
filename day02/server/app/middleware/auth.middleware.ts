import type {Request,Response,NextFunction} from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

export interface AuthRequest extends Request{
    user?: JwtPayload | string;
}

const authMiddleware=(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const authHeader=req.headers.authorization;

    if(!authHeader || authHeader.startsWith('Bearer')){
        res.status(401).json({message:'Unauthorized'});
        return;
    }

    const token=authHeader.split(' ')[1];

    try{
        const decoded=jwt.verify(
            token as string ,process.env.JWT_SECRET_KEY as string
        );
        req.user=decoded;
        next();
    }
    catch (error){
        res.status(401).json({message:'Invalid Token'})
    }
};

export default authMiddleware;

