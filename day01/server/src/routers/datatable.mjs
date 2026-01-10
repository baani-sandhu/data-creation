import express from "express";
const dtrouter = express.Router();

const data = [];

for (let i = 0; i <= 1000; i++) {
  data.push({
    id: i + 1,
    name: `Item ${i + 1}`,
  });
}

dtrouter.get("/", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const end = start + limit;

  const pdata = data.slice(start, end);
  console.log(pdata);
  res.json({
    data: pdata,
    hasMore: end < data.length,
  });
});

export { dtrouter };
