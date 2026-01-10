import express from "express";
import cors from "cors";
import { dtrouter } from "./routers/datatable.mjs";

const app = express();
app.use(cors());
app.use("/datatable", dtrouter);
app.use(express.json());
const PORT = 5000;

app.get("/", (req, res) => {
  res.json({ Hello: "12" });
});

app.listen(PORT, () => {
  console.log("Server running on port `PORT`");
});
