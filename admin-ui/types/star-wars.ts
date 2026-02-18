type Movie = {
  id: string;
  title: string;
  release_date: string;
};

type MovieDetails = Movie & {
  director: string;
  producer: string;
};

export type { Movie, MovieDetails };
