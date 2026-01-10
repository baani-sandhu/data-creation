import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string,{expiresIn: "1h"});
};

const verifyToken=(token:string):jwt.JwtPayload=>{
    return jwt.verify(token,process.env.JWT_SECRET_KEY as string) as jwt.JwtPayload;
};

