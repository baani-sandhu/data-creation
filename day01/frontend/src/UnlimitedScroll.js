import { useEffect, useRef, useState } from "react";

function UnlimitedScroll() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loader = useRef(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:5000/datatable?page=${page}&limit=10`)
      .then((res) => res.json())
      .then((data) => {
        setItems((prev) => [...prev, ...data.data]);
        setHasMore(data.hasMore);
      });
  }, [page]);

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 1 },
    );
    if (loader.current) observer.observe(loader.current);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold text-center mb-6 text-blue-600">
        Infinite Scroll
      </h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 bg-white rounded shadow hover:bg-blue-50 transition"
          >
            {item.name}
          </div>
        ))}
      </div>
      {hasMore && (
        <div
          ref={loader}
          className="mt-6 p-4 text-center font-semibold text-gray-700"
        >
          Loading...
        </div>
      )}
    </div>
  );
}

export default UnlimitedScroll;
