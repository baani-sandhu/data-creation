import { Router } from "express";
import type { Request, Response } from "express";
import authMiddleware, {
  type AuthRequest,
} from "../middleware/auth.middleware.ts";

const router = Router();

router.get("/", authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ users: [], user: req.user });
});

router.post("/", authMiddleware, (req: AuthRequest, res: Response) => {
  res.status(201).json({ message: "User Created" });
});

router.put("/:id", authMiddleware, (req: Request, res: Response) => {
  res.json({ message: "User Updated" });
});

router.delete("/:id", authMiddleware, (req: Request, res: Response) => {
  res.json({ message: "User Deleted" });
});

export default router;
