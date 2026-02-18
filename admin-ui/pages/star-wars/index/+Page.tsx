import { useData } from "vike-react/useData";
import type { Data } from "./+data";
import { Link } from "@/components/Link";

export const Page = () => {
  const { movies } = useData<Data>();
  return (
    <>
      <h1>Star Wars Movies</h1>
      <ol>
        {movies.map(({ id, title, release_date }) => (
          <li key={id}>
            <Link href={`/star-wars/${id}`}>{title}</Link> ({release_date})
          </li>
        ))}
      </ol>
      <p>
        Source: <a href="https://brillout.github.io/star-wars">brillout.github.io/star-wars</a>.
      </p>
    </>
  );
};
