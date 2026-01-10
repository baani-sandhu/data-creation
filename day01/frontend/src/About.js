import { useEffect, useState } from "react";

function About() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(null);
  const limit = 10;

  useEffect(() => {
    fetch(`http://127.0.0.1:5000/datatable?page=${page}&limit=${limit}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.data);
        setHasMore(data.hasMore);
      })
      .finally(() => setLoading(false));
  }, [page]);
  const nextPage = () => {
    if (hasMore) setPage((prev) => prev + 1);
  };
  const prevPage = () => {
    if (page > 1) setPage((prev) => prev - 1);
  };
  return (
    <div className="container">
      <h2 className="text-3xl font-bold text-center mb-6 text-blue-600">
        Paginated Data
      </h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="table-auto w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
              <th className="border border-gray-300 px-4 py-2 text-left">
                Name
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="border border-gray-300 px-4 py-2">{item.id}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {item.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button
          onClick={prevPage}
          disabled={page === 1}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          Previous
        </button>

        <button
          onClick={nextPage}
          disabled={!hasMore}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          Next
        </button>
        <span>Page {page}</span>
      </div>
    </div>
  );
}

export default About;
